# Ingestion Service (FastAPI)

This service handles document ingestion and sets `app.current_tenant_id` per-request for RLS.

Quick start (local):

1. Create a Python virtualenv and install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Ensure Postgres is running and run `sql/rls_setup.sql` to create tables/policies.

3. Start the app:

```bash
uvicorn app.main:app --reload --port 8000
```

4. Example request (X-Tenant-ID header required):

```bash
curl -X POST http://localhost:8000/api/invoices/upload -H "X-Tenant-ID: <tenant-uuid>"
```
# Ingestion Service (FastAPI)

Placeholder for Document Ingestion Service (FastAPI). Handles upload, virus scan, storage, and emits events.
