"""
Claude 3.5 Sonnetを使った勘定科目予測器
services/ingestion-service/app/account_classifier/predictor_claude.py
"""
import json
import logging
import os
import re
import difflib
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


@dataclass
class AccountPrediction:
    """勘定科目（マスタ照合）+ 取引先マスタ照合の予測結果"""
    # 勘定科目（基本はマスタの name）
    account: str
    # 勘定科目の信頼度
    confidence: float
    reasoning: Optional[str] = None

    # 勘定科目マスタ照合結果（Claude による推定）
    matched_account_code: Optional[str] = None
    matched_account_name: Optional[str] = None
    account_confidence: Optional[float] = None

    # 取引先マスタ照合結果（Claude による推定）
    matched_vendor_id: Optional[str] = None
    matched_vendor_name: Optional[str] = None
    vendor_confidence: Optional[float] = None

    # デバッグ/保存用途（best-effort）
    raw_response: Optional[str] = None
    model: Optional[str] = None
    tokens_used: Optional[int] = None


@dataclass
class ClaudePredictor:
    """Claude 3.5 Sonnetを使った勘定科目予測器"""

    api_key: Optional[str] = None
    # デフォルトは "latest" を使い、アカウント側の提供モデル差分に追随できるようにする
    model: str = "claude-3-5-sonnet-latest"
    max_tokens: int = 500
    temperature: float = 0.0

    def __post_init__(self):
        # API キーの取得
        if self.api_key is None:
            self.api_key = os.getenv("ANTHROPIC_API_KEY")

        if not self.api_key:
            raise ValueError(
                "ANTHROPIC_API_KEY is required. "
                "Set it in environment variables or pass as parameter."
            )

        # モデルは環境変数で上書きできるようにする（例: claude-3-5-sonnet-latest）
        self.model = os.getenv("ANTHROPIC_MODEL", self.model)

        # ※ この時点では API 呼び出しは行われていない（初期化ログ）
        logger.info("Claude predictor initialized with model=%s", self.model)

        try:
            from anthropic import Anthropic
        except ImportError as e:
            raise RuntimeError(
                "Anthropic library is required. "
                "Install with: pip install anthropic"
            ) from e

        self.client = Anthropic(api_key=self.api_key)

    def predict(
        self,
        vendor: str,
        description: str,
        amount: float,
        direction: str,
        *,
        vendor_masters: Optional[List[Dict[str, Any]]] = None,
        account_masters: Optional[List[Dict[str, Any]]] = None,
    ) -> AccountPrediction:
        """
        勘定科目を予測し、取引先マスタ照合も行う（best-effort）。

        Args:
            vendor: 取引先名
            description: 摘要・内容
            amount: 金額
            direction: 取引方向 ("income" or "expense")

        Returns:
            AccountPrediction: 予測結果
        """
        vendor_candidates = self._select_vendor_candidates(vendor, vendor_masters=vendor_masters)
        account_candidates = self._select_account_candidates(
            vendor=vendor,
            description=description,
            direction=direction,
            account_masters=account_masters,
        )
        system_prompt = self._build_system_prompt()
        user_prompt = self._build_user_prompt(vendor, description, amount, direction, vendor_candidates, account_candidates)

        try:
            logger.debug(f"Predicting account for: {vendor} - {description}")

            # ここが「実際に Claude API を呼び出す直前」
            # このログが出たら、Claude 呼び出し経路に入っていることが確定
            logger.info(
                "🔥 Calling Claude API model=%s vendor=%s amount=%s direction=%s",
                self.model, vendor, amount, direction
            )

            used_model = self.model
            try:
                response = self.client.messages.create(
                    model=used_model,
                    max_tokens=self.max_tokens,
                    temperature=self.temperature,
                    system=system_prompt,
                    messages=[{"role": "user", "content": user_prompt}]
                )
            except Exception as e:
                # 404 (model not found) の場合は、代表的な "latest" へ自動フォールバックして再試行
                # ※ 権限/提供モデル差分で発生しがち
                msg = str(e)
                is_model_not_found = (
                    e.__class__.__name__ == "NotFoundError"
                    or "not_found_error" in msg
                    or "model:" in msg
                )
                if is_model_not_found:
                    for alt in ("claude-3-5-sonnet-latest", "claude-3-5-haiku-latest"):
                        if alt == used_model:
                            continue
                        try:
                            logger.warning("Claude model '%s' not available; retrying with '%s'", used_model, alt)
                            response = self.client.messages.create(
                                model=alt,
                                max_tokens=self.max_tokens,
                                temperature=self.temperature,
                                system=system_prompt,
                                messages=[{"role": "user", "content": user_prompt}]
                            )
                            used_model = alt
                            break
                        except Exception:
                            continue
                    else:
                        raise
                else:
                    raise

            tokens_used: Optional[int] = None
            try:
                usage = getattr(response, "usage", None)
                if usage is not None:
                    in_toks = getattr(usage, "input_tokens", None)
                    out_toks = getattr(usage, "output_tokens", None)
                    if isinstance(in_toks, int) or isinstance(out_toks, int):
                        tokens_used = int((in_toks or 0) + (out_toks or 0))
            except Exception:
                tokens_used = None

            # Claude のレスポンスは複数 block になる可能性があるため、text を連結して扱う
            content = ""
            for block in response.content:
                if hasattr(block, "text") and block.text:
                    content += block.text
            content = content.strip()

            # JSON部分を抽出
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0].strip()
            elif "```" in content:
                content = content.split("```")[1].split("```")[0].strip()

            try:
                result = json.loads(content)
            except Exception as e:
                # 例外は握りつぶさず、必ず traceback を出す（調査用）
                logger.exception(f"Failed to parse Claude response: {e}")
                return self._fallback_prediction(direction)

            account = result.get("account", "")
            confidence = float(result.get("confidence", 0.5))
            reasoning = result.get("reasoning", "")

            matched_account_code: Optional[str] = None
            matched_account_name: Optional[str] = None
            account_confidence: Optional[float] = None

            account_match = result.get("account_match")
            if isinstance(account_match, dict):
                matched_account_code = account_match.get("code")
                matched_account_name = account_match.get("name")
                if account_match.get("confidence") is not None:
                    try:
                        account_confidence = float(account_match.get("confidence"))
                    except Exception:
                        account_confidence = None

            # 後方互換: フラットキーも許容
            if not matched_account_name:
                matched_account_name = result.get("matched_account_name") or result.get("matchedAccountName")
            if not matched_account_code:
                matched_account_code = result.get("matched_account_code") or result.get("matchedAccountCode")
            if account_confidence is None:
                if result.get("account_confidence") is not None:
                    try:
                        account_confidence = float(result.get("account_confidence"))
                    except Exception:
                        account_confidence = None
                elif result.get("accountConfidence") is not None:
                    try:
                        account_confidence = float(result.get("accountConfidence"))
                    except Exception:
                        account_confidence = None

            # account_match が返る場合はそれを優先して account に反映
            if matched_account_name:
                account = str(matched_account_name)
                if account_confidence is not None:
                    confidence = float(account_confidence)

            matched_vendor_id: Optional[str] = None
            matched_vendor_name: Optional[str] = None
            vendor_confidence: Optional[float] = None

            vendor_match = result.get("vendor_match")
            if isinstance(vendor_match, dict):
                matched_vendor_id = vendor_match.get("id")
                matched_vendor_name = vendor_match.get("name")
                if vendor_match.get("confidence") is not None:
                    try:
                        vendor_confidence = float(vendor_match.get("confidence"))
                    except Exception:
                        vendor_confidence = None
            else:
                # 念のため、フラットキーも許容
                matched_vendor_id = result.get("matched_vendor_id") or result.get("matchedVendorId")
                matched_vendor_name = result.get("matched_vendor_name") or result.get("matchedVendorName")
                if result.get("vendor_confidence") is not None:
                    try:
                        vendor_confidence = float(result.get("vendor_confidence"))
                    except Exception:
                        vendor_confidence = None
                elif result.get("vendorConfidence") is not None:
                    try:
                        vendor_confidence = float(result.get("vendorConfidence"))
                    except Exception:
                        vendor_confidence = None

            # 勘定科目の検証（マスタ候補から選ばれているか）
            valid_accounts = self._get_valid_account_names(account_masters)
            if valid_accounts and account not in valid_accounts:
                logger.warning("Invalid account returned by Claude (not in masters): %s", account)
                account = self._get_fallback_account(direction)
                confidence = min(confidence, 0.4)
                reasoning = f"マスタに存在しない科目({result.get('account')})のためフォールバック"
            elif not valid_accounts:
                # 互換: マスタがない場合は従来の許可リストでチェック
                if not self._is_valid_account(account):
                    logger.warning(f"Invalid account returned by Claude: {account}")
                    account = self._get_fallback_account(direction)
                    confidence = min(confidence, 0.4)
                    reasoning = f"不正な科目({result.get('account')})のためフォールバック"

            return AccountPrediction(
                account=account,
                confidence=confidence,
                reasoning=reasoning,
                matched_account_code=str(matched_account_code) if matched_account_code else None,
                matched_account_name=str(matched_account_name) if matched_account_name else None,
                account_confidence=account_confidence,
                matched_vendor_id=str(matched_vendor_id) if matched_vendor_id else None,
                matched_vendor_name=str(matched_vendor_name) if matched_vendor_name else None,
                vendor_confidence=vendor_confidence,
                raw_response=content,
                model=getattr(response, "model", None) or used_model,
                tokens_used=tokens_used,
            )

        except Exception:
            # 例外は握りつぶさず、必ず traceback を出す（調査用）
            logger.exception("Claude prediction failed, falling back")
            return self._fallback_prediction(direction)

    def _build_system_prompt(self) -> str:
        """システムプロンプトを構築"""
        return """あなたは日本の会計実務に精通した経理AIアシスタントです。
取引情報から適切な勘定科目を識別し、勘定科目マスタ候補と取引先マスタ候補からそれぞれ最も適切なものを照合することがあなたの役割です。

# 勘定科目マスタ照合について
- ユーザーから「勘定科目マスタ候補（code/name/description/examples）」が渡されます。
- 必ずその候補の中から 1 件を選び、account_match に返してください（新しい科目を作らない）。

# 判断基準
- 取引先名と摘要から取引内容を推定
- 金額の規模も考慮（高額なら固定費/人件費の可能性）
- 不明な場合は最も近い科目を選択（候補の中から）

# 具体例
- 電気・ガス・水道 → 水道光熱費
- 携帯・ネット回線 → 通信費
- 事務所家賃 → 地代家賃
- 電車・タクシー・宿泊 → 旅費交通費
- Amazon広告・SNS広告 → 広告宣伝費
- 文房具・PC周辺機器 → 消耗品費
- カフェでの打ち合わせ → 会議費
- 高額な取引先接待 → 接待交際費

# 取引先マスタ照合について
- ユーザーから「取引先マスタ候補（id/name/aliases）」が渡されます。
- その候補の中から最も適切な取引先を選んでください。
- 該当がない場合は vendor_match を null にしてください。

# 回答形式（必ずこの形式で）
{
    "account_match": {
        "code": "8006",
        "name": "消耗品費",
        "confidence": 0.95
    },
    "account": "消耗品費",
    "confidence": 0.95,
    "reasoning": "判断理由(1-2文で簡潔に)",
    "vendor_match": {
        "id": "V001",
        "name": "株式会社ABC商事",
        "confidence": 0.90
    }
}

vendor_match は該当がない場合 null を返してください。
"""

    def _build_user_prompt(
        self,
        vendor: str,
        description: str,
        amount: float,
        direction: str,
        vendor_candidates: List[Dict[str, Any]],
        account_candidates: List[Dict[str, Any]],
    ) -> str:
        """ユーザープロンプトを構築"""
        direction_jp = "収入" if direction == "income" else "支出"
        candidates_json = json.dumps(vendor_candidates or [], ensure_ascii=False)
        accounts_json = json.dumps(account_candidates or [], ensure_ascii=False)
        return f"""以下の取引情報から適切な勘定科目を選択し、取引先マスタ候補から照合してください。

取引先: {vendor}
摘要: {description}
金額: {amount}円
取引種別: {direction_jp}

勘定科目マスタ候補（この中から 1 件を選択）:
{accounts_json}

取引先マスタ候補（この中から選択。該当なしなら vendor_match=null）:
{candidates_json}

上記の勘定科目リストから最も適切なものを1つ選んでください。"""

    def _get_valid_account_names(self, account_masters: Optional[List[Dict[str, Any]]]) -> set[str]:
        if not account_masters:
            return set()
        out: set[str] = set()
        for a in account_masters:
            try:
                name = a.get("name")
                if isinstance(name, str) and name:
                    out.add(name)
            except Exception:
                continue
        return out

    def _select_account_candidates(
        self,
        *,
        vendor: str,
        description: str,
        direction: str,
        account_masters: Optional[List[Dict[str, Any]]],
        limit: int = 25,
    ) -> List[Dict[str, Any]]:
        """Claude に渡す勘定科目マスタ候補を整形（件数は少ない想定だが安全に制限）。"""
        if not account_masters:
            return []

        # まずは全件を minimal に整形（この repo の account_masters は少数なので基本は全件）
        out: List[Dict[str, Any]] = []
        for a in account_masters[: max(1, limit)]:
            try:
                item: Dict[str, Any] = {
                    "code": a.get("code"),
                    "name": a.get("name"),
                }
                desc = a.get("description")
                if isinstance(desc, str) and desc:
                    item["description"] = desc
                examples = a.get("examples")
                if isinstance(examples, list) and examples:
                    item["examples"] = examples[:6]
                out.append(item)
            except Exception:
                continue
        return out

    def _select_vendor_candidates(
        self,
        vendor: str,
        *,
        vendor_masters: Optional[List[Dict[str, Any]]],
        limit: int = 25,
    ) -> List[Dict[str, Any]]:
        """Claude に渡す取引先マスタ候補を絞り込み（トークン節約のため）。"""
        if not vendor_masters:
            return []

        vendor_text = str(vendor or "").strip()
        if not vendor_text:
            return []

        corp_re = re.compile(r"(株式会社|有限会社|合同会社|合名会社|合資会社|\(株\)|\(有\)|㈱|\s|　|・|\.|,|，|\-|－|—|ー|_)")

        def norm(s: str) -> str:
            return corp_re.sub("", str(s)).strip().lower()

        vin = norm(vendor_text)
        if not vin:
            return []

        scored: List[Tuple[float, Dict[str, Any]]] = []
        for v in vendor_masters:
            try:
                vid = v.get("id")
                vname = v.get("name")
                if not vid or not vname:
                    continue

                candidates = [str(vname)]
                aliases = v.get("aliases")
                if isinstance(aliases, list):
                    candidates.extend([str(a) for a in aliases if a])

                best = 0.0
                for c in candidates:
                    vn = norm(c)
                    if not vn:
                        continue
                    if vin == vn:
                        score = 1.0
                    elif vin in vn or vn in vin:
                        score = 0.92
                    else:
                        score = difflib.SequenceMatcher(a=vin, b=vn).ratio()
                    if score > best:
                        best = score

                scored.append((best, v))
            except Exception:
                continue

        scored.sort(key=lambda x: x[0], reverse=True)
        top = [v for _, v in scored[: max(1, limit)]]

        out: List[Dict[str, Any]] = []
        for v in top:
            item: Dict[str, Any] = {"id": v.get("id"), "name": v.get("name")}
            aliases = v.get("aliases")
            if isinstance(aliases, list) and aliases:
                item["aliases"] = aliases[:10]
            out.append(item)

        return out

    def _is_valid_account(self, account: str) -> bool:
        """勘定科目が有効かチェック"""
        valid_accounts = {
            "水道光熱費", "通信費", "地代家賃", "旅費交通費",
            "広告宣伝費", "消耗品費", "会議費", "接待交際費",
            "給料賃金", "福利厚生費", "支払手数料", "雑費", "売上高"
        }
        return account in valid_accounts

    def _get_fallback_account(self, direction: str) -> str:
        """フォールバック勘定科目を取得"""
        return "売上高" if direction == "income" else "雑費"

    def _fallback_prediction(self, direction: str) -> AccountPrediction:
        """フォールバック予測（エラー時）"""
        account = self._get_fallback_account(direction)
        logger.warning(f"Using fallback prediction: {account}")
        return AccountPrediction(
            account=account,
            confidence=0.3,
            reasoning="自動判定に失敗したため、デフォルト科目を使用",
            # DB 側で claude_model が NOT NULL のため、最低限のメタを入れておく
            model=self.model or "unknown",
            raw_response=None,
            tokens_used=0,
        )
