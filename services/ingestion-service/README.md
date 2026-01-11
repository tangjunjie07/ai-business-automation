# Ingestion Service (FastAPI)

This service handles document ingestion, OCR processing, AI-based account classification, and sets `app.current_tenant_id` per-request for RLS.

## Features
- File upload and storage (Local, S3, Azure Blob)
- OCR extraction using Azure Document Intelligence
- AI-powered account classification using OpenAI GPT-4
- Multi-tenant support with PostgreSQL RLS

## Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `STORAGE_PROVIDER`: Storage backend (`local`, `s3`, `azure`)
- `LOCAL_STORAGE_PATH`: Local storage path (default: `/tmp/aba_files`)
- `S3_BUCKET`: S3 bucket name
- `AZURE_BLOB_CONNECTION_STRING`: Azure Blob connection string
- `AZURE_BLOB_CONTAINER`: Azure Blob container name
- `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT`: Azure Document Intelligence endpoint
- `AZURE_DOCUMENT_INTELLIGENCE_KEY`: Azure Document Intelligence key
- `OPENAI_API_KEY`: OpenAI API key (optional if using Azure OpenAI)
- `AZURE_OPENAI_ENDPOINT`: Azure OpenAI endpoint
- `AZURE_OPENAI_API_KEY`: Azure OpenAI API key
- `AZURE_OPENAI_API_VERSION`: Azure OpenAI API version (default: 2023-12-01-preview)
- `AZURE_OPENAI_DEPLOYMENT`: Azure OpenAI deployment name (default: gpt-4o-mini)
- `OPENAI_MODEL`: OpenAI model name (default: gpt-4o-mini)

## Quick Start (Local)

1. Create a Python virtualenv and install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Ensure Postgres is running and run `sql/rls_setup.sql` to create tables/policies.

3. Set environment variables (example):

```bash
export DATABASE_URL="postgresql://postgres:example@localhost:5432/ai_business_automation_dev"
export STORAGE_PROVIDER="local"
export AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT="your-endpoint"
export AZURE_DOCUMENT_INTELLIGENCE_KEY="your-key"
export OPENAI_API_KEY="your-key"
```

4. Start the app:

```bash
uvicorn app.main:app --reload --port 8000
```

5. Example request (X-Tenant-ID header required):

```bash
curl -X POST http://localhost:8000/api/invoices/upload \
  -H "X-Tenant-ID: <tenant-uuid>" \
  -F "file=@sample_invoice.pdf"
```

## API Endpoints
- `POST /api/invoices/upload`: Upload invoice file, perform OCR and AI analysis
- `GET /health`: Health check

## Testing
Run unit tests:
```bash
python -m pytest
```
# Ingestion Service (FastAPI)

Placeholder for Document Ingestion Service (FastAPI). Handles upload, virus scan, storage, and emits events.
