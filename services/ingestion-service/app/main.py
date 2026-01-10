from fastapi import FastAPI, Request, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
import asyncpg
import os
import uuid
import asyncio
from .storage import get_storage

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:example@localhost:5432/ai_business_automation_dev")

app = FastAPI()


async def get_tenant_id_from_header(request: Request) -> str:
    tenant = request.headers.get("X-Tenant-ID")
    if not tenant:
        raise HTTPException(status_code=400, detail="X-Tenant-ID header required")
    return tenant


@app.on_event("startup")
async def startup():
    app.state.db_pool = await asyncpg.create_pool(DATABASE_URL)
    # prepare storage backend
    app.state.storage = get_storage()


@app.on_event("shutdown")
async def shutdown():
    await app.state.db_pool.close()


@app.middleware("http")
async def tenant_middleware(request: Request, call_next):
    try:
        tenant_id = await get_tenant_id_from_header(request)
    except HTTPException as exc:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    async with app.state.db_pool.acquire() as conn:
        await conn.execute("SELECT set_config('app.current_tenant_id', $1, false);", tenant_id)
        request.state.db_conn = conn
        request.state.tenant_id = tenant_id
        response = await call_next(request)
    return response


@app.post("/api/invoices/upload")
async def upload_invoice(file: UploadFile = File(...), request: Request = None):
    """Accept a file upload, store it in configured storage, insert invoice and ocr_result records."""
    conn: asyncpg.Connection = request.state.db_conn
    tenant_id = request.state.tenant_id

    # create invoice record (minimal fields)
    invoice_row = await conn.fetchrow(
        "INSERT INTO invoices (tenant_id, vendor_name, amount, currency) VALUES ($1, $2, $3, $4) RETURNING id",
        tenant_id,
        file.filename,
        0.0,
        "JPY",
    )
    invoice_id = invoice_row["id"]

    # read file bytes
    content = await file.read()

    # store file using storage backend
    storage = app.state.storage
    filename = f"{tenant_id}/{uuid.uuid4()}_{file.filename}"
    try:
        file_url = await storage.save(filename, content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"storage error: {e}")

    # insert ocr_results record with reference to invoice
    import json
    await conn.execute(
        "INSERT INTO ocr_results (invoice_id, tenant_id, raw, extracted) VALUES ($1, $2, $3::jsonb, $4::jsonb)",
        invoice_id,
        tenant_id,
        json.dumps({"file_url": file_url}),
        json.dumps({}),
    )

    # In real system: enqueue OCR job to message broker (Kafka/Celery)

    return {"invoice_id": str(invoice_id), "file_url": file_url}


@app.get("/health")
async def health():
    return {"status": "ok"}
