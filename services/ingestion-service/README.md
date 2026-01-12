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
  # Ingestion Service (FastAPI)

  This service handles document ingestion, OCR processing, AI-based account classification, and sets `app.current_tenant_id` per-request for PostgreSQL RLS.

  ## Features
  - File upload and storage (Local, S3, Azure Blob)
  - OCR extraction using Azure Document Intelligence
  - AI-powered account classification using OpenAI / Azure OpenAI
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
  - `OPENAI_API_KEY` / `AZURE_OPENAI_API_KEY`: OpenAI / Azure OpenAI credentials
  - `AZURE_OPENAI_DEPLOYMENT`: Azure OpenAI deployment name (default: gpt-4o-mini)

  ## Quick Start (Local)

  1. Create a Python virtualenv and install dependencies:

  ```bash
  python -m venv .venv
  source .venv/bin/activate
  pip install -r services/ingestion-service/requirements.txt
  ```

  2. Ensure Postgres is running and apply schema / RLS policies (see `sql/`).

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

  ## API Endpoints (主要)
  - `POST /chat`: ファイルと／またはメッセージを受け取り、invoice レコードを作成しバックグラウンド処理を開始する。
  - `GET /chat/init`: 初期メッセージとサジェストを返す。
  - `POST /chat/{job_id}/cancel`: ジョブ（invoice）をキャンセルする。
  - WebSocket: `/ws/progress/{job_id}`（推奨） または `/ws/progress`（レガシー登録フロー）

  ## テスト
  ユニット・統合テストは `services/ingestion-service/tests/` に配置されています。

  ローカル実行例:

  ```bash
  source .venv/bin/activate
  PYTHONPATH=services/ingestion-service python -m pytest services/ingestion-service/tests -q
  ```

  ## `/chat` API 仕様（簡潔）

  - レスポンス（成功）: `ChatResponse`
    - `jobId`: string
    - `status`: `success` | `error` | `canceled`
    - `messages`: Message[]

  - `Message`:
    - `id`: string
    - `role`: string
    - `type`: string (`invoice_card` | `text` ...)
    - `content`: string
    - `invoiceData` (optional): `{ invoice_id, file_url, ocr_result }`
    - `suggestions`: array

  初期の `/chat` レスポンスは楽観的（`ocr_result` が null）です。最終結果は WebSocket のイベントで配信されます。

  ## Cancel エンドポイント (挙動)

  - URL: `POST /chat/{job_id}/cancel`
  - 必須ヘッダ: `X-Tenant-ID`, `X-USER-ID`
  - 動作: DB の invoice を `canceled` にマークし、バックグラウンドタスクを cancel() し、`CANCELED` イベントを WebSocket に送出（接続済みクライアントへは即時、未接続ならサーバ内部バッファに格納）
  - 成功レスポンス例:

  ```json
  { "jobId": "<invoice-id>", "status": "canceled" }
  ```

  ## WebSocket 進捗イベント

  - 推奨接続: `ws://<host>/ws/progress/{job_id}`（シンプルに job_id をパスで渡す）
  - レガシー: `ws://<host>/ws/progress` に接続して `{ "job_id": "..." }` を送る登録フロー

  イベントの基本スキーマ:

  ```json
  { "event": "<EVENT_NAME>", "job_id": "<invoice_id>", "payload": { /* 任意 */ } }
  ```

  代表イベント:
  - `DOC_RECEIVED`, `OCR_PROCESSING`, `AI_THINKING`, `ANALYSIS_COMPLETE`, `CANCELED`, `TIMED_OUT`

  サーバはクライアントが未接続でもイベントを `websocket_event_buffers[job_id]` に蓄えます。クライアント接続時に順次フラッシュされます。

  ## Manual verification（手動検証手順）

  1) サービスを起動する（上記参照）

  2) 必須ヘッダを用意する: `X-Tenant-ID` (UUID or code), `X-USER-ID`

  3) `/chat` にファイルを送る（戻り値から `invoice_id` を取り出す）

  ```bash
  curl -v -X POST "http://localhost:8000/chat" \
    -H "X-Tenant-ID: <tenant-uuid>" \
    -H "X-USER-ID: <user-id>" \
    -F "files=@sample_invoice.pdf;type=application/pdf"
  ```

  レスポンス例（抜粋）:

  ```json
  {
    "jobId": "<batch-id>",
    "status": "success",
    "messages": [
      { "id": "inv-...", "invoiceData": { "invoice_id": "inv-...", "file_url": "/tmp/...", "ocr_result": null } }
    ]
  }
  ```

  4) WebSocket で受信する

  - path 形式で接続: `ws://localhost:8000/ws/progress/<invoice_id>` に `X-Tenant-ID` と `X-USER-ID` をヘッダに入れて接続

  例（websocat）:

  ```bash
  websocat -H "X-Tenant-ID: <tenant-uuid>" -H "X-USER-ID: <user-id>" \
    "ws://localhost:8000/ws/progress/<invoice_id>"
  ```

  受信は順次イベント(JSON)が来ます。`ANALYSIS_COMPLETE` 到達後に `ai_result` が DB に入ることを確認できます。

  5) キャンセルの検証

  ```bash
  curl -X POST "http://localhost:8000/chat/<invoice_id>/cancel" \
    -H "X-Tenant-ID: <tenant-uuid>" \
    -H "X-USER-ID: <user-id>"
  ```

  - 受信済みクライアント: 即座に `CANCELED` イベントが届く
  - 未接続クライアント: 接続時にバッファから `CANCELED` がフラッシュされる

  6) DB 確認

  ```sql
  SELECT id, ocr_result, ai_result, status FROM "Invoice" WHERE id = '<invoice_id>';
  ```

  `ai_result` は `ANALYSIS_COMPLETE` 到達後に更新されます。

  ---

  フィードバック: ここに追加したいスニペット（wscat の代替例、Python クライアント、CI のテストケースリンクなど）があれば教えてください。


