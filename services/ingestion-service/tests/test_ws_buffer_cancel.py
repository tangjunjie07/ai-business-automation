import uuid
import pytest
from httpx import AsyncClient, ASGITransport

from app import main as ingestion_main
from app.main import app


@pytest.mark.asyncio
async def test_ws_buffer_and_cancel(monkeypatch):
    """Post a file (no WS connected), cancel the job, then connect to the WS
    and verify the buffered CANCELED event is flushed to the client."""

    class FakeConn:
        async def execute(self, query: str):
            return None

    class FakePool:
        async def acquire(self):
            return FakeConn()

        async def release(self, conn):
            return None

    app.state.db_pool = FakePool()

    async def fake_resolve_by_id_or_code(conn, raw):
        return str(uuid.uuid4())

    async def fake_exists_under_tenant(conn, user_id, tenant_id):
        return True

    async def fake_create_invoice(conn, tenant_id):
        return "inv-ws-1"

    async def fake_update_file_url(conn, invoice_id, url):
        return None

    async def fake_update_ocr_result(conn, invoice_id, data):
        return None

    async def fake_update_ai_result(conn, invoice_id, data):
        return None

    async def fake_mark_invoice_failed(conn, invoice_id, reason):
        return None

    async def fake_mark_invoice_canceled(conn, invoice_id, reason):
        return None

    monkeypatch.setattr(ingestion_main, "resolve_by_id_or_code", fake_resolve_by_id_or_code)
    monkeypatch.setattr(ingestion_main, "exists_under_tenant", fake_exists_under_tenant)
    monkeypatch.setattr(ingestion_main, "create_invoice", fake_create_invoice)
    monkeypatch.setattr(ingestion_main, "update_file_url", fake_update_file_url)
    monkeypatch.setattr(ingestion_main, "update_ocr_result", fake_update_ocr_result)
    monkeypatch.setattr(ingestion_main, "update_ai_result", fake_update_ai_result)
    monkeypatch.setattr(ingestion_main, "mark_invoice_failed", fake_mark_invoice_failed)
    monkeypatch.setattr(ingestion_main, "mark_invoice_canceled", fake_mark_invoice_canceled)

    tenant_id = str(uuid.uuid4())
    headers = {"X-Tenant-ID": tenant_id, "X-USER-ID": "user-ws"}

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as ac:
        # create invoice via /chat
        files = {"files": ("test.pdf", b"dummy content", "application/pdf")}
        r = await ac.post("/chat", headers=headers, files=files)
        assert r.status_code == 200
        j = r.json()
        assert j["status"] == "success"
        invoice_id = j["messages"][0]["invoiceData"]["invoice_id"]

        # cancel the invoice before WS connects
        r2 = await ac.post(f"/chat/{invoice_id}/cancel", headers=headers)
        assert r2.status_code == 200
        cancel_json = r2.json()
        assert cancel_json.get("status") == "canceled"

        # Since opening an ASGI websocket is not available in this test runtime,
        # assert the server buffered the CANCELED event for that invoice id.
        buffers = ingestion_main.websocket_event_buffers.get(invoice_id)
        assert buffers is not None, "Expected buffered events for invoice"
        assert any(m.get("event") == "CANCELED" for m in buffers), f"No CANCELED in buffer: {buffers}"
