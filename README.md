# AI業務自動化プロジェクト

## 概要
このリポジトリは、AIを活用した経理・業務自動化のMVPプロトタイプです。Webダッシュボード（Next.js）を最優先に、将来的にモバイル（React Native）を追加する設計のマイクロサービス型モノレポです。

## 主要構成
- **apps/web/**: Next.js ベースのWebダッシュボード（認証機能付き）
- **apps/mobile/**: React Native ベースのモバイルアプリ（将来）
- **packages/**: 共通ライブラリ（APIクライアント、型定義、UIコンポーネント、ユーティリティ）
- **services/ingestion-service/**: FastAPI ベースのファイル受取・OCR パイプライン
- **services/payment-service/**: Node.js ベースの決済サービス（将来）
- **sql/**: データベーススキーマとRLS設定
- **docs/**: プロジェクトドキュメント

## 技術スタック
- **フロントエンド**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **バックエンド**: Next.js API Routes, FastAPI (Python)
- **データベース**: PostgreSQL with Prisma ORM, Row-Level Security
- **認証**: NextAuth.js with Credentials Provider, bcrypt パスワードハッシュ化
- **ストレージ**: アダプタパターン（ローカル/S3/Azure）

## 認証システム
- **プロバイダー**: NextAuth.js Credentials
- **認証情報**: メールアドレス + パスワード（bcrypt ハッシュ化）
- **ユーザー管理**: 管理者ロールのみ新規ユーザー作成可能
- **ページ保護**: middleware でダッシュボード（/dashboard）と管理者ページ（/admin）を保護
- **デフォルト管理者**: `admin@example.com` / `password`

## 機能概要
- **一般ユーザー**:
  - ファイルアップロード（PDF/JPG/PNG）
  - AIチャットアシスタント
- **管理者**:
  - ユーザー管理（新規作成）
  - システム統計表示

## ローカル開発セットアップ
1. **リポジトリクローン**
   ```bash
   git clone <repository-url>
   cd ai-business-automation
   ```

2. **Python環境設定**
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # Windows: .venv\Scripts\activate
   pip install -r services/ingestion-service/requirements.txt
   ```

3. **データベース起動**
   ```bash
   docker-compose up -d
   export DATABASE_URL=postgresql://eitp:eitp@localhost:5432/ai_business_automation_dev
   python scripts/apply_rls.py
   ```

4. **Webアプリ起動**
   ```bash
   cd apps/web
   npm install
   npm run dev
   ```

5. **アクセス**
   - Webアプリ: http://localhost:3000
   - ログイン: admin@example.com / password

## API仕様
- **POST /api/auth/signin**: ログイン
- **POST /api/users**: 管理者専用ユーザー作成（email, name, password 必須）
- **POST /api/upload**: ファイルアップロード
- **POST /api/chat**: AIチャット

## 開発者向け
- **スキーマ変更**: `cd apps/web && npx prisma migrate dev --name <migration-name>`
- **Prismaクライアント生成**: `npx prisma generate`
- **テスト**: 各サービスのテストスクリプト参照

## 注意事項
- パスワードはbcryptでハッシュ化されています
- 管理者権限がないとユーザー作成できません
- RLSによりテナント分離されています

## 本番環境デプロイ

### 前提条件
- Docker & Docker Compose
- PostgreSQLデータベース（マネージド推奨）
- Azure Document Intelligence アカウント
- Azure OpenAI アカウント
- クラウドストレージ（Azure Blob Storage または AWS S3）
- ドメインとSSL証明書

### バックエンド設定 (ingestion-service)

#### 環境変数設定
`.env.production` ファイルを作成し、以下の環境変数を設定：

```bash
# データベース
DATABASE_URL=postgresql://user:password@production-db-host:5432/ai_business_automation_prod

# Azure Document Intelligence
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
AZURE_DOCUMENT_INTELLIGENCE_KEY=your-document-intelligence-key

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://your-openai-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-openai-api-key
AZURE_OPENAI_API_VERSION=2024-12-01-preview
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini

# ストレージ設定（Azure Blob推奨）
STORAGE_PROVIDER=azure
AZURE_BLOB_CONNECTION_STRING=your-azure-blob-connection-string
AZURE_BLOB_CONTAINER=your-container-name

# またはAWS S3の場合
STORAGE_PROVIDER=s3
AWS_S3_BUCKET=your-s3-bucket
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key

# ログ設定
LOG_LEVEL=INFO
```

#### CORS設定修正
`services/ingestion-service/app/main.py` のCORS設定を本番ドメインに変更：

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-production-domain.com"],  # 本番ドメイン
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

#### データベース初期化
```bash
# 本番データベースでRLSを適用
export DATABASE_URL=postgresql://user:password@production-db-host:5432/ai_business_automation_prod
python scripts/apply_rls.py
```

### フロントエンド設定 (apps/web)

#### 環境変数設定
`apps/web/.env.production` ファイルを作成：

```bash
# NextAuth設定
NEXTAUTH_URL=https://your-production-domain.com
NEXTAUTH_SECRET=your-very-strong-random-secret-here

# API設定
NEXT_PUBLIC_API_BASE_URL=https://api.your-production-domain.com

# データベース（Prisma）
DATABASE_URL=postgresql://user:password@production-db-host:5432/ai_business_automation_prod

# Dify API設定
DIFY_API_BASE=https://api.dify.ai/v1
DIFY_API_KEY=your-dify-api-key
```

#### Next.js設定修正
`apps/web/next.config.ts` に本番設定を追加：

```typescript
const nextConfig = {
  // 本番環境設定
  env: {
    API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  },
  // セキュリティ強化
  poweredByHeader: false,
  // 本番ビルド最適化
  swcMinify: true,
}

export default nextConfig
```

#### 自動デプロイ設定

このプロジェクトではGitHub Actionsを使用した自動デプロイをサポートしています。

##### Vercelへのデプロイ（推奨）

1. [Vercel](https://vercel.com)でアカウントを作成
2. GitHubリポジトリを接続
3. 以下の環境変数をVercelのダッシュボードで設定：
   - `DATABASE_URL`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL`
   - `DIFY_API_BASE`
   - `DIFY_API_KEY`

4. GitHub Actionsのシークレットを設定：
   ```bash
   # GitHubリポジトリのSettings > Secrets and variables > Actionsで設定
   VERCEL_TOKEN=your-vercel-token
   VERCEL_ORG_ID=your-vercel-org-id
   VERCEL_PROJECT_ID=your-vercel-project-id
   DATABASE_URL=your-database-url
   NEXTAUTH_SECRET=your-nextauth-secret
   NEXTAUTH_URL=your-nextauth-url
   DIFY_API_BASE=your-dify-api-base
   DIFY_API_KEY=your-dify-api-key
   ```

##### Renderへのデプロイ（代替）

1. [Render](https://dashboard.render.com/)でアカウントを作成
2. `render.yaml`ファイルが既に設定されています
3. GitHubリポジトリを接続
4. PostgreSQLデータベースを作成
5. Web Serviceを作成し、以下の環境変数を設定：
   - `DATABASE_URL`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL`
   - `DIFY_API_BASE`
   - `DIFY_API_KEY`

6. GitHub Actionsのシークレットを設定：
   ```bash
   # GitHubリポジトリのSettings > Secrets and variables > Actionsで設定
   RENDER_API_KEY=your-render-api-key
   RENDER_SERVICE_ID=your-render-service-id
   DATABASE_URL=your-database-url
   NEXTAUTH_SECRET=your-nextauth-secret
   NEXTAUTH_URL=your-nextauth-url
   DIFY_API_BASE=your-dify-api-base
   DIFY_API_KEY=your-dify-api-key
   ```

デプロイワークフローは`.github/workflows/`に設定されており、mainブランチへのpushで自動デプロイされます。

### Docker Compose (本番用)

`docker-compose.prod.yml` を作成：

```yaml
version: '3.8'

services:
  ingestion-service:
    build:
      context: ./services/ingestion-service
      dockerfile: Dockerfile.prod
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT=${AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT}
      - AZURE_DOCUMENT_INTELLIGENCE_KEY=${AZURE_DOCUMENT_INTELLIGENCE_KEY}
      - AZURE_OPENAI_ENDPOINT=${AZURE_OPENAI_ENDPOINT}
      - AZURE_OPENAI_API_KEY=${AZURE_OPENAI_API_KEY}
      - STORAGE_PROVIDER=${STORAGE_PROVIDER}
      - AZURE_BLOB_CONNECTION_STRING=${AZURE_BLOB_CONNECTION_STRING}
      - AZURE_BLOB_CONTAINER=${AZURE_BLOB_CONTAINER}
    ports:
      - "8000:8000"
    restart: unless-stopped

  web:
    build:
      context: ./apps/web
      dockerfile: Dockerfile.prod
    environment:
      - NEXTAUTH_URL=${NEXTAUTH_URL}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
      - DATABASE_URL=${DATABASE_URL}
    ports:
      - "3000:3000"
    restart: unless-stopped
```

### Dockerfile作成

#### バックエンド用 Dockerfile.prod
`services/ingestion-service/Dockerfile.prod`：

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# 依存関係インストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ソースコードコピー
COPY . .

# 本番ポート
EXPOSE 8000

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### フロントエンド用 Dockerfile.prod
`apps/web/Dockerfile.prod`：

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# 依存関係インストール
COPY package*.json ./
RUN npm ci --only=production

# ソースコードコピー
COPY . .

# 本番ビルド
RUN npm run build

FROM node:18-alpine AS runner

WORKDIR /app

# 本番用依存関係のみコピー
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# 本番ポート
EXPOSE 3000

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["npm", "start"]
```

### Nginx設定（リバースプロキシ）

`nginx.conf`：

```nginx
upstream backend {
    server ingestion-service:8000;
}

upstream frontend {
    server web:3000;
}

server {
    listen 80;
    server_name your-production-domain.com;

    # SSLリダイレクト
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-production-domain.com;

    # SSL証明書
    ssl_certificate /path/to/ssl/cert.pem;
    ssl_certificate_key /path/to/ssl/key.pem;

    # セキュリティヘッダー
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # APIルーティング
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # フロントエンド
    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### デプロイスクリプト

`scripts/deploy.sh`：

```bash
#!/bin/bash

# 環境変数読み込み
set -a
source .env.production
set +a

# Dockerイメージビルド
docker-compose -f docker-compose.prod.yml build

# コンテナ起動
docker-compose -f docker-compose.prod.yml up -d

# マイグレーション実行
docker-compose -f docker-compose.prod.yml exec ingestion-service python scripts/apply_rls.py

echo "Deployment completed successfully"
```

### デプロイ手順

1. **環境変数ファイル作成**
   ```bash
   cp .env.example .env.production
   # .env.production を編集して本番値を設定
   ```

2. **SSL証明書取得**
   ```bash
   # Let's Encrypt などを使用してSSL証明書を取得
   certbot certonly --nginx -d your-production-domain.com
   ```

3. **Docker Composeでデプロイ**
   ```bash
   chmod +x scripts/deploy.sh
   ./scripts/deploy.sh
   ```

4. **Nginx設定適用**
   ```bash
   sudo cp nginx.conf /etc/nginx/sites-available/your-app
   sudo ln -s /etc/nginx/sites-available/your-app /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

5. **動作確認**
   - Webアプリ: https://your-production-domain.com
   - API: https://your-production-domain.com/api/docs

### セキュリティ考慮事項

- **シークレット管理**: 環境変数をGitにコミットしない
- **データベース**: SSL接続を使用
- **APIキー**: Azure/OpenAIキーを定期的にローテーション
- **監視**: ログ集約とアラート設定
- **バックアップ**: データベースとストレージの定期バックアップ

## 貢献
小さな変更やドキュメント改善はプルリクエストで歓迎します。
