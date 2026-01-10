AI業務自動化プロジェクト
=====================

概要
--
このリポジトリは、AIを活用した経理・業務自動化のMVPプロトタイプです。Webダッシュボード（Next.js）を最優先に、将来的にモバイル（React Native）を追加する設計のマイクロサービス型モノレポです。

主要構成（最新）
--
プロジェクト実際名称/
- apps/
  - web/                # Next.js (Web Dashboard)
  - mobile/             # React Native (iOS/Android App)
- packages/
  - api-client/         # Axios/TanStack Query の共通ラッパー
  - types/              # TypeScript の共通型定義
  - ui-components/      # 共通 UI コンポーネント
  - utils/              # 共通ユーティリティ（為替やバリデーション等）
- services/
  - ingestion-service/  # FastAPI ベースのファイル受取・OCR パイプライン
  - payment-service/    # Node.js ベースの決済サービス（将来的）
- docker-compose.yml    # 開発用 DB 等の compose 定義

主要技術スタック
--
- フロントエンド: Next.js（Web）、React Native（将来）
- バックエンド: FastAPI（Python）
- DB: PostgreSQL（Row-Level Security を利用したマルチテナント）
- ストレージ: ローカル・S3・Azure Blob を切替可能なアダプタ

ローカル開発（簡易）
--
1. リポジトリをクローン

2. Python 仮想環境作成（ルートに .venv を想定）

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r services/ingestion-service/requirements.txt
```

3. Postgres を起動（`docker-compose up -d`）し、`DATABASE_URL` を設定

```bash
export DATABASE_URL=postgresql://<user>:<pass>@localhost:5432/ai_business_automation_dev
python scripts/apply_rls.py
```

4. Ingestion サービス起動

```bash
.venv/bin/uvicorn services/ingestion-service.app.main:app --host 0.0.0.0 --port 8000
```

5. ファイルアップロード例

```bash
curl -H "X-Tenant-ID: <tenant-uuid>" -F "file=@./sample.pdf" http://127.0.0.1:8000/api/invoices/upload
```

運用・注意
--
- 秘密情報（DBパスワード、クラウドキー等）は環境変数で管理してください。
- RLS（Row-Level Security）を利用しているため、各リクエストで `X-Tenant-ID` をセットするミドルウェアが必要です。

貢献
--
- 小さな変更やドキュメントの改善はプルリクエストで歓迎します。

連絡先
--
- リポジトリ所有者（ローカル作業者）に問い合わせてください。
