from fastapi import FastAPI, Request, HTTPException, UploadFile, File, Depends, WebSocket
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import asyncpg
import os
import uuid
import asyncio
import json
import logging
from typing import Dict, Any, Optional, List
from dotenv import load_dotenv
from .storage import get_storage
from .ocr_ai import analyze_document

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is required")

app = FastAPI(
    title="AI Business Automation - Ingestion Service",
    description="Document ingestion and OCR processing service",
    version="1.0.0"
)

# Global WebSocket connections for progress updates
websocket_connections: Dict[str, WebSocket] = {}

async def send_progress_event(job_id: str, event: str, data: Dict[str, Any] = None):
    """
    Send progress event to WebSocket client.
    """
    if job_id in websocket_connections:
        try:
            message = {"event": event, "job_id": job_id}
            if data:
                message.update(data)
            await websocket_connections[job_id].send_json(message)
            logger.info(f"Sent progress event {event} for job {job_id}")
        except Exception as e:
            logger.error(f"Failed to send WebSocket event: {e}")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def get_tenant_id_from_header(request: Request) -> str:
    """
    Extract and validate tenant ID from request headers.

    Args:
        request: FastAPI request object.

    Returns:
        Validated tenant UUID string.

    Raises:
        HTTPException: If tenant ID is missing or invalid.
    """
    tenant_id = request.headers.get("X-Tenant-ID")
    if not tenant_id:
        logger.warning("Missing X-Tenant-ID header")
        raise HTTPException(status_code=400, detail="X-Tenant-ID header is required")

    try:
        # Validate UUID format
        uuid.UUID(tenant_id)
        return tenant_id
    except ValueError:
        logger.warning(f"Invalid tenant ID format: {tenant_id}")
        raise HTTPException(status_code=400, detail="X-Tenant-ID must be a valid UUID")


@app.on_event("startup")
async def startup():
    """Initialize database connection pool and storage on startup."""
    try:
        app.state.db_pool = await asyncpg.create_pool(DATABASE_URL)
        logger.info("Database connection pool created successfully")

        app.state.storage = get_storage()
        logger.info("Storage backend initialized successfully")

    except Exception as e:
        logger.error(f"Startup failed: {e}")
        raise


@app.on_event("shutdown")
async def shutdown():
    """Clean up resources on shutdown."""
    try:
        if hasattr(app.state, 'db_pool') and app.state.db_pool:
            await app.state.db_pool.close()
            logger.info("Database connection pool closed")

    except Exception as e:
        logger.error(f"Shutdown error: {e}")


@app.middleware("http")
async def tenant_middleware(request: Request, call_next):
    """
    Middleware to handle tenant isolation and database connections.

    Sets up tenant-specific database session and connection for each request.
    """
    # Skip tenant check for health endpoint
    if request.url.path == "/health":
        response = await call_next(request)
        return response

    try:
        tenant_id = await get_tenant_id_from_header(request)
        request.state.tenant_id = tenant_id

        # Acquire database connection
        conn = await app.state.db_pool.acquire()
        request.state.db_conn = conn

        # Set RLS session variable
        await conn.execute(f"SET SESSION app.current_tenant_id = '{tenant_id}'")

        # Process request
        response = await call_next(request)
        return response

    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Middleware error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        # Always release connection
        if hasattr(request.state, 'db_conn'):
            try:
                await app.state.db_pool.release(request.state.db_conn)
            except Exception as e:
                logger.error(f"Error releasing database connection: {e}")


@app.post("/api/invoices/upload")
async def upload_invoice(
    files: List[UploadFile] = File(...),
    request: Request = None
) -> Dict[str, Any]:
    """
    Upload and process invoice documents.

    Performs OCR analysis and AI inference on the uploaded files.

    Args:
        files: List of uploaded invoice files.
        request: FastAPI request object.

    Returns:
        Dict containing list of invoice IDs, file URLs, and OCR results.

    Raises:
        HTTPException: For upload or processing errors.
    """
    conn = None
    results = []
    try:
        tenant_id = request.state.tenant_id
        conn = request.state.db_conn

        logger.info(f"Starting invoice upload for tenant {tenant_id}, files: {[f.filename for f in files]}")

        for file in files:
            allowed_types = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
            if file.content_type not in allowed_types:
                logger.warning(f"Unsupported file type: {file.content_type} for file {file.filename}")
                continue  # Skip invalid files instead of failing all

            # Create invoice record
        invoice_row = await conn.fetchrow(
            """
            INSERT INTO invoices (tenant_id, file_url, status, created_at)
            VALUES ($1, $2, $3, NOW())
            RETURNING id
            """,
            tenant_id, "", "processing"
            invoice_id = str(invoice_row["id"])
            logger.info(f"Created invoice record: {invoice_id}")

            # Send initial progress event
            await send_progress_event(invoice_id, "DOC_RECEIVED")

            # Read file content
            content = await file.read()
            if len(content) == 0:
                logger.warning(f"Empty file: {file.filename}")
                await conn.execute(
                    "UPDATE invoices SET status = 'failed', error_message = $1 WHERE id = $2",
                    "Empty file", invoice_id
                )
                continue

            # Store file
            storage = app.state.storage
            filename = f"{tenant_id}/{invoice_id}_{file.filename}"
            file_url = await storage.save(filename, content)
            logger.info(f"File stored at: {file_url}")

            # Update invoice with file URL
            await conn.execute(
                "UPDATE invoices SET file_url = $1 WHERE id = $2",
                file_url, invoice_id
            )

                # Perform OCR and AI analysis
            try:
                logger.info(f"Starting OCR analysis for invoice {invoice_id}")
                await send_progress_event(invoice_id, "OCR_PROCESSING")
                ocr_result = await analyze_document(file_url)
                logger.info(f"OCR analysis completed for invoice {invoice_id}")
                await send_progress_event(invoice_id, "AI_THINKING")

            except Exception as e:
                logger.error(f"OCR analysis failed for invoice {invoice_id}: {e}")
                ocr_result = {"error": str(e), "error_type": type(e).__name__}

            # Update invoice with results
            await conn.execute(
                "UPDATE invoices SET ocr_result = $1, status = $2 WHERE id = $3",
                json.dumps(ocr_result), "completed" if "error" not in ocr_result else "failed",
                invoice_id
            )

            logger.info(f"Invoice processing completed: {invoice_id}")
            await send_progress_event(invoice_id, "ANALYSIS_COMPLETE", {"result": ocr_result})

            results.append({
                "invoice_id": invoice_id,
                "file_url": file_url,
                "ocr_result": ocr_result
            })

        return {"results": results}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        if conn and 'invoice_id' in locals():
            try:
                await conn.execute(
                    "UPDATE invoices SET status = 'failed', error_message = $1 WHERE id = $2",
                    str(e), invoice_id
                )
            except Exception as db_error:
                logger.error(f"Failed to update invoice status: {db_error}")

        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@app.get("/health")
async def health_check():
    """
    Health check endpoint.

    Returns service status and basic information.
    """
    try:
        # Check database connection
        conn = await app.state.db_pool.acquire()
        await conn.fetchval("SELECT 1")
        await app.state.db_pool.release(conn)

        return {
            "status": "healthy",
            "service": "ingestion-service",
            "version": "1.0.0",
            "database": "connected"
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "service": "ingestion-service",
            "error": str(e)
        }


@app.websocket("/ws/progress")
async def websocket_progress(websocket: WebSocket):
    """
    WebSocket endpoint for real-time progress updates during document processing.
    """
    await websocket.accept()
    job_id = None
    try:
        # Receive initial job_id from client
        data = await websocket.receive_json()
        job_id = data.get("job_id")
        if job_id:
            websocket_connections[job_id] = websocket
            logger.info(f"WebSocket registered for job {job_id}")

        while True:
            # Keep connection alive
            await asyncio.sleep(30)
            await websocket.send_json({"type": "ping"})

    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        if job_id and job_id in websocket_connections:
            del websocket_connections[job_id]
        logger.info(f"WebSocket connection closed for job {job_id}")
