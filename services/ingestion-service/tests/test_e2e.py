import io
import json
import asyncio
import pytest

from fastapi.testclient import TestClient

import services.ingestion_service.app.main as main_mod


@pytest.mark.timeout(30)
def test_post_chat_and_receive_analysis_complete(monkeypatch):
    """E2E: POST /chat with a file (stub mode) and receive ANALYSIS_COMPLETE via WebSocket path endpoint."""

    # Monkeypatch DB init and storage to avoid external dependencies in test
    async def fake_init_db_pool(app, database_url):
        app.state.db_pool = None

    monkeypatch.setattr(main_mod, 'init_db_pool', fake_init_db_pool)

    # Ensure stub mode
    monkeypatch.setenv('INGESTION_USE_REAL', 'false')

    app = main_mod.app

    with TestClient(app) as client:
        # Prepare a small dummy file
        files = {
            'files': ('invoice.pdf', io.BytesIO(b'%PDF-1.4 test pdf'), 'application/pdf')
        }
        headers = {
            'X-Tenant-ID': '00000000-0000-0000-0000-000000000000',
            'X-USER-ID': 'test-user'
        }

        resp = client.post('/chat', headers=headers, files=files, data={'message': 'テスト'})
        assert resp.status_code == 200
        body = resp.json()
        assert 'invoiceIds' in body and isinstance(body['invoiceIds'], list) and len(body['invoiceIds']) > 0

        invoice_id = body['invoiceIds'][0]

        # Connect to websocket path and wait for ANALYSIS_COMPLETE
        with client.websocket_connect(f"/ws/progress/{invoice_id}") as ws:
            # receive messages until ANALYSIS_COMPLETE
            found = False
            for _ in range(30):
                msg = ws.receive_json(timeout=5)
                # some messages may be pings or other events
                if isinstance(msg, dict) and msg.get('event') == 'ANALYSIS_COMPLETE':
                    payload = msg
                    assert 'result' in payload
                    assert 'ai_result' in payload
                    assert 'file_name' in payload
                    found = True
                    break
            assert found, 'ANALYSIS_COMPLETE event not received'
