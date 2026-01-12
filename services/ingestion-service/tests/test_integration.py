import uuid
import pytest
from httpx import AsyncClient

from app import main as ingestion_main
from app.main import app


@pytest.mark.asyncio
async def test_chat_init_and_file_upload(monkeypatch):
    """Integration-like test that exercises /chat/init and a file upload to /chat.

    The test monkeypatches DB/repo functions to avoid needing a real Postgres.
    """

    class FakeConn:
        async def execute(self, query: str):
            return None

    class FakePool:
        async def acquire(self):
            return FakeConn()

        async def release(self, conn):
            return None

    # install fake pool on app state
    app.state.db_pool = FakePool()

    # Monkeypatch repository helpers used by middleware and handlers
    async def fake_resolve_by_id_or_code(conn, raw):
        return str(uuid.uuid4())

    async def fake_exists_under_tenant(conn, user_id, tenant_id):
        return True

    monkeypatch.setattr(ingestion_main, "resolve_by_id_or_code", fake_resolve_by_id_or_code)
    monkeypatch.setattr(ingestion_main, "exists_under_tenant", fake_exists_under_tenant)

    async def fake_create_invoice(conn, tenant_id):
        return "inv-test-123"

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

    monkeypatch.setattr(ingestion_main, "create_invoice", fake_create_invoice)
    monkeypatch.setattr(ingestion_main, "update_file_url", fake_update_file_url)
    monkeypatch.setattr(ingestion_main, "update_ocr_result", fake_update_ocr_result)
    monkeypatch.setattr(ingestion_main, "update_ai_result", fake_update_ai_result)
    monkeypatch.setattr(ingestion_main, "mark_invoice_failed", fake_mark_invoice_failed)
    monkeypatch.setattr(ingestion_main, "mark_invoice_canceled", fake_mark_invoice_canceled)

    tenant_id = str(uuid.uuid4())
    headers = {"X-Tenant-ID": tenant_id, "X-USER-ID": "user-1"}

    async with AsyncClient(app=app, base_url="http://testserver") as ac:
        # GET /chat/init (middleware requires tenant/user headers)
        r = await ac.get("/chat/init", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert "message" in data

        # POST /chat with a single file (use allowed content type)
        files = {"files": ("test.pdf", b"hello world", "application/pdf")}
        r2 = await ac.post("/chat", headers=headers, files=files)
        assert r2.status_code == 200
        j = r2.json()
        assert j["status"] == "success"
        assert isinstance(j["messages"], list)
        assert j["messages"][0]["invoiceData"]["invoice_id"] == "inv-test-123"
