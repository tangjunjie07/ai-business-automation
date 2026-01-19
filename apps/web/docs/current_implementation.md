# 現在の実装仕様

## 概要
AI業務自動化プロジェクトのWebアプリケーション（Next.js）の現在の実装状態を記載。

## 技術スタック
- **Frontend**: Next.js 16, React 19, TypeScript
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL with Prisma ORM v7
- **Authentication**: NextAuth.js with Credentials Provider
- **Styling**: Tailwind CSS, Radix UI
- **Password Hashing**: bcrypt

## 認証システム
### 機能
- メールアドレス + パスワードによるログイン
- パスワードはbcryptでハッシュ化
- JWTベースのセッション管理
- ロールベースアクセス制御（user/admin）

### ユーザー管理
- 管理者ロールのみ新規ユーザー作成可能
- ユーザー作成API: POST /api/users
  - 必須フィールド: email, password
  - オプションフィールド: name
- デフォルト管理者: admin@example.com / password

### ページ保護
- `/dashboard`: 認証済みユーザーのみアクセス
- `/admin`: adminロールのみアクセス
- middleware.ts でアクセス制御

## 主要ページ
### /auth/signin
- ログインフォーム
- NextAuthのSignInPage

### /dashboard
- 一般ユーザー向けダッシュボード
- 機能:
  - ファイルアップロード（PDF/JPG/PNG）
  - AIチャットインターフェース（モック）
- 管理者ユーザーの場合、管理者ダッシュボードへのリンク表示

### /admin
- 管理者専用ダッシュボード
- 機能:
  - 新規ユーザー作成フォーム
  - システム統計表示（未実装）

## APIエンドポイント
### Authentication
- POST /api/auth/[...nextauth]
  - signin: ログイン処理
  - session: セッション取得

### User Management
- POST /api/users
  - 管理者専用: 新規ユーザー作成
  - Body: { email, name, password }

### File Upload
- POST /api/upload
  - ファイルアップロード（未実装）

### Chat
- POST /api/chat
  - AIチャット（モック実装）

## データベーススキーマ
```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  password      String?
  role          String    @default("user")
  accounts      Account[]
  sessions      Session[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String
  expires    DateTime

  @@unique([identifier, token])
}
```

## セキュリティ対策
- パスワードハッシュ化（bcrypt, salt rounds: 10）
- セッション管理（NextAuth JWT）
- ロールベースアクセス制御
- Row-Level Security（RLS）適用（別途）

## 開発環境
- Node.js: 18+
- PostgreSQL: 16
- Docker Compose for DB

## 起動手順
1. `docker-compose up -d` (DB起動)
2. `cd apps/web && npm install`
3. `npm run dev`
4. http://localhost:3000 にアクセス

## 未実装機能
- AI OCR処理
- 実際のチャット機能
- ファイル処理パイプライン
- モバイルアプリ
- 決済サービス
- システム統計の実装

## 注意点
- デモ用にパスワードを固定値で使用
- 本番環境では適切なパスワードポリシーを実装
- 管理者ユーザーは手動でDBに挿入済み