import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

import { config } from 'dotenv'
config({ path: '.env.local' })

const connectionString = process.env.DATABASE_URL
if (connectionString) {
  if (process.env.NODE_ENV === 'development') {
    const masked = connectionString.replace(/(:\/\/)(.*@)/, '$1***@')
    console.log('DATABASE_URL:', masked)
  } else {
    console.log('DATABASE_URL is set')
  }
} else {
  console.log('DATABASE_URL is not set')
}
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Initializing database...')

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "tenants" (
      "id" TEXT PRIMARY KEY,
      "code" TEXT UNIQUE NOT NULL,
      "name" TEXT NOT NULL,
      "country_code" TEXT NOT NULL,
      "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "app_users" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT,
      "email" TEXT UNIQUE NOT NULL,
      "email_verified" TIMESTAMP WITH TIME ZONE,
      "image" TEXT,
      "password" TEXT,
      "role" TEXT DEFAULT 'user',
      "tenant_id" TEXT REFERENCES "Tenant"("id"),
      "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "accounts" (
      "id" TEXT PRIMARY KEY,
      "user_id" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "type" TEXT NOT NULL,
      "provider" TEXT NOT NULL,
      "provider_account_id" TEXT NOT NULL,
      "refresh_token" TEXT,
      "access_token" TEXT,
      "expires_at" INTEGER,
      "token_type" TEXT,
      "scope" TEXT,
      "id_token" TEXT,
      "session_state" TEXT,
      UNIQUE("provider", "provider_account_id")
    );
  `

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "sessions" (
      "id" TEXT PRIMARY KEY,
      "session_token" TEXT UNIQUE NOT NULL,
      "user_id" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "expires" TIMESTAMP WITH TIME ZONE NOT NULL
    );
  `

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "verification_tokens" (
      "identifier" TEXT NOT NULL,
      "token" TEXT UNIQUE NOT NULL,
      "expires" TIMESTAMP WITH TIME ZONE NOT NULL,
      UNIQUE("identifier", "token")
    );
  `

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "chat_sessions" (
      "id" TEXT PRIMARY KEY,
      "user_id" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "dify_id" TEXT UNIQUE NOT NULL,
      "title" TEXT,
      "is_pinned" BOOLEAN DEFAULT FALSE,
      "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `

    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "chat_files" (
        "id" TEXT PRIMARY KEY,
        "dify_id" TEXT NOT NULL REFERENCES "chat_sessions"("dify_id") ON DELETE CASCADE,
        "tenant_id" TEXT REFERENCES "Tenant"("id"),
        "file_url" TEXT,
        "file_name" TEXT,
        "file_size" INTEGER,
        "mime_type" TEXT,
        "ocr_result" TEXT,
        "ai_result" JSONB,
        "extracted_amount" REAL,
        "extracted_date" TIMESTAMP WITH TIME ZONE,
        "status" TEXT DEFAULT 'pending',
        "error_message" TEXT,
        "processed_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
  `

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "ocr_results" (
      "id" TEXT PRIMARY KEY,
      "tenant_id" TEXT REFERENCES "Tenant"("id"),
      "chat_file_id" TEXT REFERENCES "chat_files"("id"),
      "file_name" TEXT NOT NULL,
      "ocr_result" TEXT NOT NULL,
      "confidence" REAL DEFAULT 0.0,
      "status" TEXT DEFAULT 'processing',
      "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "journal_entries" (
      "id" TEXT PRIMARY KEY,
      "tenant_id" TEXT NOT NULL REFERENCES "Tenant"("id"),
      "date" TIMESTAMP WITH TIME ZONE NOT NULL,
      "description" TEXT NOT NULL,
      "debit_account" TEXT NOT NULL,
      "credit_account" TEXT NOT NULL,
      "amount" REAL NOT NULL,
      "currency" TEXT DEFAULT 'JPY',
      "reference" TEXT,
      "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "reconciliations" (
      "id" TEXT PRIMARY KEY,
      "tenant_id" TEXT REFERENCES "Tenant"("id"),
      "chat_file_id" TEXT REFERENCES "chat_files"("id"),
      "journal_entry_id" TEXT NOT NULL REFERENCES "JournalEntry"("id"),
      "status" TEXT DEFAULT 'pending',
      "notes" TEXT,
      "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "claude_predictions" (
      "id" TEXT PRIMARY KEY,
      "tenant_id" TEXT REFERENCES "Tenant"("id"),
      "chat_file_id" TEXT REFERENCES "chat_files"("id"),
      "input_vendor" TEXT NOT NULL,
      "input_description" TEXT NOT NULL,
      "input_amount" REAL NOT NULL,
      "input_direction" TEXT NOT NULL,
      "predicted_account" TEXT NOT NULL,
      "account_confidence" REAL NOT NULL,
      "reasoning" TEXT,
      "matched_vendor_id" TEXT,
      "matched_vendor_code" TEXT,
      "matched_vendor_name" TEXT,
      "vendor_confidence" REAL,
      "matched_account_id" TEXT,
      "matched_account_code" TEXT,
      "matched_account_name" TEXT,
      "claude_model" TEXT NOT NULL,
      "tokens_used" INTEGER,
      "raw_response" TEXT,
      "status" TEXT DEFAULT 'completed',
      "error_message" TEXT,
      "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "mf_journal_entries" (
      "id" TEXT PRIMARY KEY,
      "tenant_id" TEXT NOT NULL REFERENCES "Tenant"("id"),
      "claude_prediction_id" TEXT REFERENCES "claude_predictions"("id"),
      "transaction_date" TIMESTAMP WITH TIME ZONE NOT NULL,
      "transaction_type" TEXT NOT NULL,
      "income_amount" REAL,
      "expense_amount" REAL,
      "account_subject" TEXT NOT NULL,
      "matched_account_id" TEXT,
      "matched_account_code" TEXT,
      "vendor" TEXT,
      "matched_vendor_id" TEXT,
      "matched_vendor_code" TEXT,
      "description" TEXT,
      "account_book" TEXT,
      "tax_category" TEXT,
      "memo" TEXT,
      "tag_names" TEXT,
      "csv_exported" BOOLEAN DEFAULT FALSE,
      "csv_exported_at" TIMESTAMP WITH TIME ZONE,
      "mf_imported" BOOLEAN DEFAULT FALSE,
      "mf_imported_at" TIMESTAMP WITH TIME ZONE,
      "mf_journal_id" TEXT,
      "status" TEXT DEFAULT 'draft',
      "error_message" TEXT,
      "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `

  console.log('Database initialized successfully')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })