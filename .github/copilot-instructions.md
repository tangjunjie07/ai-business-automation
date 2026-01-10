# Copilot Instructions for ai-business-automation

This repository contains an MVP prototype for an AI-driven accounting and
business automation platform. The project is organized as a monorepo with
microservices and frontend apps. These instructions explain the repository
layout, development practices, and guidance for AI-assisted code generation.

Repository structure
- `services/ingestion-service/`: FastAPI service that handles file uploads,
	tenant-aware middleware, and storage adapters (local/S3/Azure).
- `sql/`: Database schema and RLS (Row-Level Security) setup scripts.
- `scripts/`: helper scripts such as `apply_rls.py` to apply DB schema.
- `apps/web/`, `apps/mobile/`: front-end app placeholders (Web first MVP).
- `Docs/`: architecture, requirements, and planning documents.

Development environment
- Python: 3.11+ recommended (project uses a `.venv` in repository root).
- Postgres: `postgres:16` in `docker-compose.yml` for local development.
- Run services locally with the venv Python and `uvicorn` for FastAPI.

Key conventions
- Multi-tenant isolation is enforced using PostgreSQL RLS. The FastAPI
	middleware sets the session variable `app.current_tenant_id` for each
	request. SQL and services must respect this mechanism.
- `services/*/requirements.txt` should reflect the project's `.venv`
	(`pip freeze`) to ensure reproducible installs.
- Storage adapters implement the same interface and are configurable via
	environment variables; default dev storage is local filesystem under
	`/tmp/aba_files`.

How Copilot should assist
- Prefer minimal, well-scoped edits that follow existing project style.
- When modifying DB-related code or SQL, ensure changes are idempotent and
	compatible with RLS policies. Add migration or apply scripts when needed.
- For API endpoints: include request validation (Pydantic models), error
	handling, and tenant checks. Keep changes small and testable.
- For new files or services, provide a short README, `requirements.txt`,
	and a simple local run command.

Local testing checklist
- Start Postgres via `docker-compose up -d` and ensure `ai_business_automation_dev`
	database exists and `DATABASE_URL` points to it.
- Run `python scripts/apply_rls.py` using the project's venv Python to apply
	schema and RLS policies.
- Start the ingestion service:

	/Users/junjietang/Projects/ai-business-automation/.venv/bin/uvicorn app.main:app --port 8000 --host 0.0.0.0

- Test file upload with a tenant UUID set in `X-Tenant-ID` header and
	verify `invoices` and `ocr_results` rows appear under that tenant.

Security & best practices
- Do not hardcode secrets — use environment variables (e.g. `DATABASE_URL`,
	`AZURE_STORAGE_CONNECTION_STRING`, `AWS_ACCESS_KEY_ID`).
- Keep RLS policies minimal and explicit. When adding new tables, add
	matching RLS policies and indexes.

CI guidance
- CI should install dependencies from `services/ingestion-service/requirements.txt`,
	run linting and a small smoke test (start service and POST a sample file).

Contact / context
- Author: project maintainer (local workspace). For ambiguous design choices,
	prefer the simplest solution that preserves tenant isolation and testability.

