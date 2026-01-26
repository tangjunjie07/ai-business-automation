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
// ========================================
// アカウント関連テーブル
// ========================================

model Account {
  id                String  @id @default(cuid())
  userId            String  @map("user_id")
  type              String
  provider          String
  providerAccountId String  @map("provider_account_id")
  refreshToken      String? @map("refresh_token")
  accessToken       String? @map("access_token")
  expiresAt         Int?    @map("expires_at")
  tokenType         String? @map("token_type")
  scope             String?
  idToken           String? @map("id_token")
  sessionState      String? @map("session_state")

  user AppUser @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

// ========================================
// セッション管理テーブル
// ========================================

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique @map("session_token")
  userId       String   @map("user_id")
  expires      DateTime
  user         AppUser     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}

// ========================================
// ユーザー管理テーブル
// ========================================

model AppUser {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime? @map("email_verified")
  image         String?
  password      String?
  role          String    @default("user")
  tenantId      String?   @map("tenant_id")
  createdAt     DateTime  @default(now()) @map("created_at")
  tenant        Tenant?   @relation(fields: [tenantId], references: [id])
  accounts      Account[]
  sessions      Session[]
  chatSessions  ChatSession[]

  @@map("app_users")
}

// ========================================
// 認証トークン管理テーブル
// ========================================

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
  @@map("verification_tokens")
}

// ========================================
// テナント管理テーブル
// ========================================

model Tenant {
  id           String   @id @default(cuid())
  code         String   @unique
  name         String
  countryCode  String   @map("country_code")
  createdAt    DateTime @default(now()) @map("created_at")
  users        AppUser[]
  chatFiles    ChatFile[]
  ocrResults   OcrResult[]
  reconciliations Reconciliation[]
  journalEntries JournalEntry[]
  claudePredictions ClaudePrediction[]
  mfJournalEntries MfJournalEntry[]

  @@map("tenants")
}

// ========================================
// チャットファイル処理テーブル
// ========================================
model ChatFile {
  id               String    @id @default(cuid())
  difyId           String    @map("dify_id")
  tenantId         String?   @map("tenant_id")
  fileUrl          String?   @map("file_url")
  fileName         String?   @map("file_name")
  fileSize         Int?      @map("file_size")
  mimeType         String?   @map("mime_type")
  ocrResult        String?   @map("ocr_result")
  aiResult         Json?     @map("ai_result")
  extractedAmount  Float?    @map("extracted_amount")
  extractedDate    DateTime? @map("extracted_date")
  status           String?   @default("pending") @map("status")
  errorMessage     String?   @map("error_message")
  processedAt      DateTime? @map("processed_at")
  createdAt        DateTime  @default(now()) @map("created_at")
  updatedAt        DateTime  @updatedAt @map("updated_at")

  tenant           Tenant?   @relation(fields: [tenantId], references: [id])
  chatSession      ChatSession @relation(fields: [difyId], references: [difyId], onDelete: Cascade)
  ocrResults       OcrResult[]
  claudePredictions ClaudePrediction[]

  @@index([difyId])
  @@index([status])
  @@map("chat_files")
}

// ========================================
// OCR結果保存テーブル
// ========================================
model OcrResult {
  id         String   @id @default(cuid())
  tenantId   String?  @map("tenant_id")
  chatFileId String?  @map("chat_file_id")
  fileName   String   @map("file_name")
  ocrResult  String   @map("ocr_result")
  confidence Float?   @default(0.0)
  status     String?  @default("processing")
  createdAt  DateTime @default(now()) @map("created_at")

  tenant     Tenant?   @relation(fields: [tenantId], references: [id])
  chatFile   ChatFile? @relation(fields: [chatFileId], references: [id])

  @@map("ocr_results")
}

// ========================================
// 照合管理テーブル
// ========================================
model Reconciliation {
  id            String   @id @default(cuid())
  tenantId      String?  @map("tenant_id")
  chatFileId    String?  @map("chat_file_id")
  journalEntryId String  @map("journal_entry_id")
  status        String?  @default("pending")
  notes         String?
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  tenant        Tenant?     @relation(fields: [tenantId], references: [id])
  chatFile      ChatFile?   @relation(fields: [chatFileId], references: [id])
  journalEntry  JournalEntry @relation(fields: [journalEntryId], references: [id])

  @@map("reconciliations")
}

// ========================================
// 仕訳データ保存テーブル
// ========================================
model JournalEntry {
  id            String   @id @default(cuid())
  tenantId      String   @map("tenant_id")
  date          DateTime
  description   String
  debitAccount  String   @map("debit_account")
  creditAccount String   @map("credit_account")
  amount        Float
  currency      String?  @default("JPY")
  reference     String?
  createdAt     DateTime @default(now()) @map("created_at")
  updatedAt     DateTime @updatedAt @map("updated_at")

  tenant        Tenant          @relation(fields: [tenantId], references: [id])
  reconciliations Reconciliation[]

  @@map("journal_entries")
}

// ========================================
// Claude予測結果保存テーブル
// ========================================
model ClaudePrediction {
  id                  String    @id @default(cuid())
  tenantId            String?   @map("tenant_id")
  chatFileId          String?   @map("chat_file_id")
  inputVendor         String    @map("input_vendor")
  inputDescription    String    @map("input_description")
  inputAmount         Float     @map("input_amount")
  inputDirection      String    @map("input_direction")
  predictedAccount    String    @map("predicted_account")
  accountConfidence   Float     @map("account_confidence")
  reasoning           String?   @map("reasoning")
  matchedVendorId     String?   @map("matched_vendor_id")
  matchedVendorCode   String?   @map("matched_vendor_code")
  matchedVendorName   String?   @map("matched_vendor_name")
  vendorConfidence    Float?    @map("vendor_confidence")
  matchedAccountId    String?   @map("matched_account_id")
  matchedAccountCode  String?   @map("matched_account_code")
  matchedAccountName  String?   @map("matched_account_name")
  claudeModel         String    @map("claude_model")
  tokensUsed          Int?      @map("tokens_used")
  rawResponse         String?   @map("raw_response") @db.Text
  status              String    @default("completed") @map("status")
  errorMessage        String?   @map("error_message")
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")
  tenant              Tenant?   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  chatFile            ChatFile? @relation(fields: [chatFileId], references: [id], onDelete: SetNull)
  @@index([tenantId, createdAt])
  @@index([chatFileId])
  @@index([status])
  @@map("claude_predictions")
}

// ========================================
// Money Forward仕訳データ保存テーブル
// ========================================
model MfJournalEntry {
  id                  String    @id @default(cuid())
  tenantId            String    @map("tenant_id")
  claudePredictionId  String?   @map("claude_prediction_id")
  transactionDate     DateTime  @map("transaction_date")
  transactionType     String    @map("transaction_type")
  incomeAmount        Float?    @map("income_amount")
  expenseAmount       Float?    @map("expense_amount")
  accountSubject      String    @map("account_subject")
  matchedAccountId    String?   @map("matched_account_id")
  matchedAccountCode  String?   @map("matched_account_code")
  vendor              String?   @map("vendor")
  matchedVendorId     String?   @map("matched_vendor_id")
  matchedVendorCode   String?   @map("matched_vendor_code")
  description         String?   @map("description")
  accountBook         String?   @map("account_book")
  taxCategory         String?   @map("tax_category")
  memo                String?   @map("memo")
  tagNames            String?   @map("tag_names")
  csvExported         Boolean   @default(false) @map("csv_exported")
  csvExportedAt       DateTime? @map("csv_exported_at")
  mfImported          Boolean   @default(false) @map("mf_imported")
  mfImportedAt        DateTime? @map("mf_imported_at")
  mfJournalId         String?   @map("mf_journal_id")
  status              String    @default("draft") @map("status")
  errorMessage        String?   @map("error_message")
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")
  tenant              Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  @@index([tenantId, transactionDate])
  @@index([status])
  @@index([csvExported])
  @@index([mfImported])
  @@map("mf_journal_entries")
}

// ========================================
// Dify連携用チャットセッション管理テーブル
// ========================================
model ChatSession {
  id         String   @id @default(uuid())
  userId     String   @map("user_id")
  difyId     String   @map("dify_id")
  title      String?
  isPinned   Boolean  @default(false) @map("is_pinned")
  updatedAt  DateTime @updatedAt @map("updated_at")
  createdAt  DateTime @default(now()) @map("created_at")
  user       AppUser     @relation(fields: [userId], references: [id], onDelete: Cascade)
  chatFiles  ChatFile[]
  @@index([userId, updatedAt])
  @@unique([difyId])
  @@map("chat_sessions")
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