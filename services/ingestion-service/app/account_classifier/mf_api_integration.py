from __future__ import annotations

import base64
import hashlib
import json
import os
import time
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Dict, Mapping, Optional, Sequence, Tuple

import httpx


class MFError(RuntimeError):
    """Base error for Money Forward API integration."""


class MFAuthError(MFError):
    """Authentication / authorization error."""


class MFRateLimitError(MFError):
    """429 rate limited."""


class MFTransientError(MFError):
    """Retryable errors (5xx / timeouts / network)."""


@dataclass(frozen=True)
class RetryConfig:
    max_attempts: int = 5
    base_delay_seconds: float = 0.5
    max_delay_seconds: float = 8.0
    timeout_seconds: float = 20.0


@dataclass
class OAuth2Token:
    access_token: str
    token_type: str = "Bearer"
    refresh_token: Optional[str] = None
    expires_at_epoch: Optional[float] = None
    scope: Optional[str] = None

    @staticmethod
    def from_token_response(payload: Mapping[str, Any]) -> "OAuth2Token":
        # Standard RFC 6749 fields.
        access_token = str(payload.get("access_token") or "")
        token_type = str(payload.get("token_type") or "Bearer")
        refresh_token = payload.get("refresh_token")
        scope = payload.get("scope")

        expires_in = payload.get("expires_in")
        expires_at = None
        try:
            if expires_in is not None:
                expires_at = time.time() + float(expires_in)
        except Exception:
            expires_at = None

        if not access_token:
            raise MFAuthError(f"Token response missing access_token: {dict(payload)}")

        return OAuth2Token(
            access_token=access_token,
            token_type=token_type,
            refresh_token=str(refresh_token) if refresh_token else None,
            expires_at_epoch=expires_at,
            scope=str(scope) if scope else None,
        )

    def is_expired(self, skew_seconds: float = 30.0) -> bool:
        if self.expires_at_epoch is None:
            return False
        return time.time() >= (self.expires_at_epoch - skew_seconds)


@dataclass(frozen=True)
class MFConfig:
    """Configuration for OAuth2 + API calls.

    Notes:
    - Step 1 ("apply for API permissions") is not code: you must register your app
      in Money Forward and obtain client credentials + allowed redirect URIs.
    """

    client_id: str
    client_secret: str
    redirect_uri: str
    auth_url: str
    token_url: str
    api_base_url: str
    scopes: Sequence[str]

    # API paths are product-specific; keep them configurable.
    virtual_account_transactions_path_template: str = "/virtual_accounts/{virtual_account_id}/transactions"

    @staticmethod
    def from_env(prefix: str = "MF_") -> "MFConfig":
        # These are intentionally generic because Money Forward has multiple products/APIs.
        client_id = os.getenv(f"{prefix}CLIENT_ID", "").strip()
        client_secret = os.getenv(f"{prefix}CLIENT_SECRET", "").strip()
        redirect_uri = os.getenv(f"{prefix}REDIRECT_URI", "").strip()
        auth_url = os.getenv(f"{prefix}AUTH_URL", "").strip()
        token_url = os.getenv(f"{prefix}TOKEN_URL", "").strip()
        api_base_url = os.getenv(f"{prefix}API_BASE_URL", "").strip().rstrip("/")
        scopes = [s.strip() for s in os.getenv(f"{prefix}SCOPES", "").split() if s.strip()]
        vat_path = os.getenv(
            f"{prefix}VIRTUAL_ACCOUNT_TRANSACTIONS_PATH",
            "/virtual_accounts/{virtual_account_id}/transactions",
        ).strip()

        missing = [
            name
            for name, value in (
                (f"{prefix}CLIENT_ID", client_id),
                (f"{prefix}CLIENT_SECRET", client_secret),
                (f"{prefix}REDIRECT_URI", redirect_uri),
                (f"{prefix}AUTH_URL", auth_url),
                (f"{prefix}TOKEN_URL", token_url),
                (f"{prefix}API_BASE_URL", api_base_url),
            )
            if not value
        ]
        if missing:
            raise ValueError(f"Missing required Money Forward env vars: {', '.join(missing)}")

        if not scopes:
            raise ValueError(f"Missing required Money Forward env var: {prefix}SCOPES")

        return MFConfig(
            client_id=client_id,
            client_secret=client_secret,
            redirect_uri=redirect_uri,
            auth_url=auth_url,
            token_url=token_url,
            api_base_url=api_base_url,
            scopes=scopes,
            virtual_account_transactions_path_template=vat_path,
        )


# --- PKCE helpers (recommended for OAuth2 authorization code flow) ---

def generate_pkce_verifier(length: int = 64) -> str:
    raw = os.urandom(max(32, min(96, length)))
    return base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")


def pkce_challenge_from_verifier(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest).decode("utf-8").rstrip("=")


TokenGetter = Callable[[str], Awaitable[Optional[OAuth2Token]]]
TokenSaver = Callable[[str, OAuth2Token], Awaitable[None]]


class MoneyForwardOAuthClient:
    """OAuth2 Authorization Code (+ PKCE) helper.

    This class does:
    - build authorization URL
    - exchange authorization code -> access token
    - refresh access token when expired

    You still need to implement the web callback endpoint yourself (in FastAPI/Next.js)
    and then call `exchange_code_for_token()`.
    """

    def __init__(self, config: MFConfig, retry: Optional[RetryConfig] = None):
        self.config = config
        self.retry = retry or RetryConfig()

    def build_authorization_url(
        self,
        state: str,
        code_challenge: Optional[str] = None,
        extra_params: Optional[Mapping[str, str]] = None,
    ) -> str:
        params = {
            "response_type": "code",
            "client_id": self.config.client_id,
            "redirect_uri": self.config.redirect_uri,
            "scope": " ".join(self.config.scopes),
            "state": state,
        }
        if code_challenge:
            params["code_challenge"] = code_challenge
            params["code_challenge_method"] = "S256"
        if extra_params:
            for k, v in extra_params.items():
                if v is not None:
                    params[str(k)] = str(v)

        return str(httpx.URL(self.config.auth_url).copy_merge_params(params))

    async def exchange_code_for_token(self, code: str, code_verifier: Optional[str] = None) -> OAuth2Token:
        data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": self.config.redirect_uri,
            "client_id": self.config.client_id,
            "client_secret": self.config.client_secret,
        }
        if code_verifier:
            data["code_verifier"] = code_verifier

        payload = await _request_json_with_retry(
            method="POST",
            url=self.config.token_url,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            data=data,
            retry=self.retry,
        )
        return OAuth2Token.from_token_response(payload)

    async def refresh_token(self, refresh_token: str) -> OAuth2Token:
        data = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": self.config.client_id,
            "client_secret": self.config.client_secret,
        }

        payload = await _request_json_with_retry(
            method="POST",
            url=self.config.token_url,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            data=data,
            retry=self.retry,
        )
        return OAuth2Token.from_token_response(payload)


class MoneyForwardApiClient:
    """Async API client with automatic token refresh + retries.

    You provide (tenant_id -> token) getters/savers so this stays storage-agnostic.
    """

    def __init__(
        self,
        config: MFConfig,
        token_getter: TokenGetter,
        token_saver: TokenSaver,
        oauth: Optional[MoneyForwardOAuthClient] = None,
        retry: Optional[RetryConfig] = None,
    ):
        self.config = config
        self.retry = retry or RetryConfig()
        self.token_getter = token_getter
        self.token_saver = token_saver
        self.oauth = oauth or MoneyForwardOAuthClient(config=config, retry=self.retry)

    async def _get_valid_token(self, tenant_id: str) -> OAuth2Token:
        token = await self.token_getter(tenant_id)
        if token is None:
            raise MFAuthError("No OAuth token found for tenant")

        if not token.is_expired():
            return token

        if not token.refresh_token:
            raise MFAuthError("Access token expired and no refresh_token available")

        new_token = await self.oauth.refresh_token(token.refresh_token)
        # Keep refresh_token if API doesn't return a new one.
        if not new_token.refresh_token:
            new_token.refresh_token = token.refresh_token
        await self.token_saver(tenant_id, new_token)
        return new_token

    async def request(
        self,
        tenant_id: str,
        method: str,
        path: str,
        *,
        params: Optional[Mapping[str, Any]] = None,
        json_body: Optional[Mapping[str, Any]] = None,
        headers: Optional[Mapping[str, str]] = None,
    ) -> Dict[str, Any]:
        token = await self._get_valid_token(tenant_id)
        url = f"{self.config.api_base_url}{path}"

        merged_headers: Dict[str, str] = {
            "Authorization": f"{token.token_type} {token.access_token}",
            "Accept": "application/json",
        }
        if headers:
            merged_headers.update({str(k): str(v) for k, v in headers.items()})

        return await _request_json_with_retry(
            method=method,
            url=url,
            headers=merged_headers,
            params=params,
            json=json_body,
            retry=self.retry,
        )

    async def add_virtual_account_transaction(
        self,
        *,
        tenant_id: str,
        virtual_account_id: str,
        external_id: str,
        occurred_on: str,
        amount: float,
        description: str,
        counterparty: Optional[str] = None,
        extra: Optional[Mapping[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Add a transaction line to a Money Forward 'virtual account'.

        IMPORTANT: The exact endpoint/payload is product-specific.
        Configure MF_VIRTUAL_ACCOUNT_TRANSACTIONS_PATH if your API uses a different route.

        The idea for your step (3):
        - POST transaction detail line(s) into MF
        - MF will apply its journaling rules to generate accounting entries
        - You can then fetch the resulting journal/notes via another endpoint
        """

        path = self.config.virtual_account_transactions_path_template.format(
            virtual_account_id=virtual_account_id
        )

        body: Dict[str, Any] = {
            "external_id": external_id,
            "occurred_on": occurred_on,
            "amount": amount,
            "description": description,
        }
        if counterparty:
            body["counterparty"] = counterparty
        if extra:
            body.update(dict(extra))

        return await self.request(
            tenant_id=tenant_id,
            method="POST",
            path=path,
            json_body=body,
        )


async def _request_json_with_retry(
    *,
    method: str,
    url: str,
    retry: RetryConfig,
    headers: Optional[Mapping[str, str]] = None,
    params: Optional[Mapping[str, Any]] = None,
    json: Optional[Mapping[str, Any]] = None,
    data: Optional[Mapping[str, Any]] = None,
) -> Dict[str, Any]:
    """HTTP request with exponential backoff and sane error mapping."""

    last_exc: Optional[BaseException] = None

    for attempt in range(1, retry.max_attempts + 1):
        try:
            async with httpx.AsyncClient(timeout=retry.timeout_seconds) as client:
                resp = await client.request(
                    method=method,
                    url=url,
                    headers=dict(headers) if headers else None,
                    params=params,
                    json=json,
                    data=data,
                )

            # Rate limiting
            if resp.status_code == 429:
                retry_after = resp.headers.get("Retry-After")
                delay = _compute_delay_seconds(retry, attempt)
                if retry_after:
                    try:
                        delay = max(delay, float(retry_after))
                    except Exception:
                        pass
                if attempt >= retry.max_attempts:
                    raise MFRateLimitError(f"Rate limited (429): {resp.text}")
                await _sleep(delay)
                continue

            # Auth issues: do not retry by default
            if resp.status_code in (401, 403):
                raise MFAuthError(f"Auth error ({resp.status_code}): {resp.text}")

            # Transient server errors
            if 500 <= resp.status_code <= 599:
                if attempt >= retry.max_attempts:
                    raise MFTransientError(f"Server error ({resp.status_code}): {resp.text}")
                await _sleep(_compute_delay_seconds(retry, attempt))
                continue

            resp.raise_for_status()

            if not resp.content:
                return {}

            try:
                return resp.json()
            except Exception as e:
                raise MFError(f"Non-JSON response: {resp.text}") from e

        except (httpx.TimeoutException, httpx.NetworkError) as e:
            last_exc = e
            if attempt >= retry.max_attempts:
                raise MFTransientError(f"Network/timeout after retries: {e}") from e
            await _sleep(_compute_delay_seconds(retry, attempt))
            continue
        except MFError:
            raise
        except Exception as e:
            last_exc = e
            if attempt >= retry.max_attempts:
                raise MFError(f"Unexpected HTTP error: {e}") from e
            await _sleep(_compute_delay_seconds(retry, attempt))
            continue

    if last_exc:
        raise MFError(f"Request failed: {last_exc}")

    raise MFError("Request failed")


def _compute_delay_seconds(retry: RetryConfig, attempt: int) -> float:
    # Exponential backoff capped.
    delay = retry.base_delay_seconds * (2 ** max(0, attempt - 1))
    return min(delay, retry.max_delay_seconds)


async def _sleep(seconds: float) -> None:
    # Isolated for testability.
    import asyncio

    await asyncio.sleep(max(0.0, seconds))


# ---- Optional: a simple in-memory token store (MVP only) ----

class InMemoryTokenStore:
    """Non-persistent token store.

    Production should store encrypted tokens (DB/KeyVault/etc). This is here to make
    the integration code runnable for dev.
    """

    def __init__(self):
        self._tokens: Dict[str, OAuth2Token] = {}

    async def get(self, tenant_id: str) -> Optional[OAuth2Token]:
        return self._tokens.get(str(tenant_id))

    async def save(self, tenant_id: str, token: OAuth2Token) -> None:
        self._tokens[str(tenant_id)] = token


# ---- Convenience helpers for Step 1 (non-code) ----

def build_mf_api_permission_checklist() -> Dict[str, Any]:
    """Return a checklist payload for MF API onboarding.

    This does NOT apply for permissions automatically (that is manual),
    but it helps you verify all required pieces are ready.
    """

    return {
        "what_you_must_do_manually": [
            "Register an application in Money Forward developer console",
            "Obtain OAuth2 client_id/client_secret",
            "Whitelist redirect URI (MF_REDIRECT_URI)",
            "Confirm scopes (MF_SCOPES) for: read/write transactions, journals, etc.",
        ],
        "env_vars_required": [
            "MF_CLIENT_ID",
            "MF_CLIENT_SECRET",
            "MF_REDIRECT_URI",
            "MF_AUTH_URL",
            "MF_TOKEN_URL",
            "MF_API_BASE_URL",
            "MF_SCOPES",
            "MF_VIRTUAL_ACCOUNT_TRANSACTIONS_PATH (optional)",
        ],
        "security_notes": [
            "Never log tokens/client_secret",
            "Store tokens encrypted at rest",
            "Rotate secrets regularly",
        ],
    }
