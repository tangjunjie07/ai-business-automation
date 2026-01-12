import json
import uuid
from typing import Any, Dict, Optional


async def create_invoice(conn: Any, tenant_id: str) -> Optional[str]:
    # Some DB setups may not have a default generator for id; generate one here.
    new_id = str(uuid.uuid4())
    row = await conn.fetchrow(
        '''
        INSERT INTO "Invoice" (id, tenant_id, file_url, status, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        RETURNING id
        ''' ,
        new_id, tenant_id, "", "processing"
    )
    return str(row["id"]) if row else None


async def update_file_url(conn: Any, invoice_id: str, file_url: str) -> None:
    await conn.execute('UPDATE "Invoice" SET file_url = $1 WHERE id = $2', file_url, invoice_id)


async def mark_invoice_failed(conn: Any, invoice_id: str, reason: str) -> None:
    await conn.execute('UPDATE "Invoice" SET status = \'failed\', error_message = $1 WHERE id = $2', reason, invoice_id)


async def update_ocr_result(conn: Any, invoice_id: str, ocr_result: Dict) -> None:
    await conn.execute(
        'UPDATE "Invoice" SET ocr_result = $1, status = $2 WHERE id = $3',
        json.dumps(ocr_result), "completed" if "error" not in ocr_result else "failed", invoice_id
    )


async def update_ai_result(conn: Any, invoice_id: str, ai_result: Dict) -> None:
    # Persist AI inference output into a dedicated column (ai_result).
    # Note: DB schema must include `ai_result` jsonb column on Invoice model.
    await conn.execute(
        'UPDATE "Invoice" SET ai_result = $1, status = $2 WHERE id = $3',
        json.dumps(ai_result), "completed" if "error" not in ai_result else "failed", invoice_id
    )


async def update_project_id(conn: Any, invoice_id: str, project_id: str) -> None:
    if not project_id:
        return
    await conn.execute('UPDATE "Invoice" SET project_id = $1 WHERE id = $2', project_id, invoice_id)


async def mark_invoice_canceled(conn: Any, invoice_id: str, reason: str = "canceled") -> None:
    """Mark an invoice as canceled with an optional reason message."""
    await conn.execute('UPDATE "Invoice" SET status = $1, error_message = $2 WHERE id = $3', 'canceled', reason, invoice_id)
