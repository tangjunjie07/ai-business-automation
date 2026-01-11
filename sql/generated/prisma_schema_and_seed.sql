-- Generated SQL DDL and seed from apps/web/prisma/schema.prisma and seed.ts
-- Run with: psql "$DATABASE_URL" -f sql/generated/prisma_schema_and_seed.sql

-- Tables

CREATE TABLE tenant (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  country_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "user" (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT NOT NULL UNIQUE,
  email_verified TIMESTAMPTZ,
  image TEXT,
  password TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  tenant_id TEXT REFERENCES tenant(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE account (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at INTEGER,
  token_type TEXT,
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  CONSTRAINT account_user_fk FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX account_provider_providerAccountId_idx ON account(provider, provider_account_id);

CREATE TABLE session (
  id TEXT PRIMARY KEY,
  session_token TEXT UNIQUE,
  user_id TEXT NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  CONSTRAINT session_user_fk FOREIGN KEY (user_id) REFERENCES "user"(id) ON DELETE CASCADE
);

CREATE TABLE verification_token (
  identifier TEXT,
  token TEXT UNIQUE,
  expires TIMESTAMPTZ,
  CONSTRAINT verification_identifier_token_unique UNIQUE(identifier, token)
);

CREATE TABLE invoice (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  project_id TEXT,
  vendor_name TEXT,
  invoice_number TEXT,
  invoice_date TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  total_amount DOUBLE PRECISION,
  currency TEXT DEFAULT 'JPY',
  status TEXT DEFAULT 'pending',
  file_url TEXT,
  ocr_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT invoice_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenant(id)
);

CREATE TABLE ocr_result (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  invoice_id TEXT,
  file_name TEXT NOT NULL,
  ocr_text TEXT NOT NULL,
  confidence DOUBLE PRECISION DEFAULT 0.0,
  status TEXT DEFAULT 'processing',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ocr_result_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenant(id),
  CONSTRAINT ocr_result_invoice_fk FOREIGN KEY (invoice_id) REFERENCES invoice(id)
);

CREATE TABLE journal_entry (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  date TIMESTAMPTZ NOT NULL,
  description TEXT NOT NULL,
  debit_account TEXT NOT NULL,
  credit_account TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  currency TEXT DEFAULT 'JPY',
  reference TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT journal_entry_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenant(id)
);

CREATE TABLE reconciliation (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  journal_entry_id TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reconciliation_tenant_fk FOREIGN KEY (tenant_id) REFERENCES tenant(id),
  CONSTRAINT reconciliation_invoice_fk FOREIGN KEY (invoice_id) REFERENCES invoice(id),
  CONSTRAINT reconciliation_journal_fk FOREIGN KEY (journal_entry_id) REFERENCES journal_entry(id)
);

-- Seed data (from apps/web/prisma/seed.ts)
-- NOTE: seed.ts generates a bcrypt hash at runtime. Replace the password value below with a bcrypt hash if you want a working login.

-- Insert a super admin user (tenant_id = NULL per seed.ts)
INSERT INTO "user" (id, name, email, password, role, tenant_id, created_at)
VALUES (
  'cuid_superadmin_placeholder',
  'Super Administrator',
  'superadmin@example.com',
  '$2y$10$REPLACE_WITH_BCRYPT_HASH',
  'super_admin',
  NULL,
  now()
);

-- Optional: create a system tenant (if you prefer the create_super_admin script behavior)
INSERT INTO tenant (id, code, name, country_code, created_at)
VALUES (
  'cuid_system_admin_tenant',
  'system-admin',
  'System Administration',
  'JP',
  now()
) ON CONFLICT (code) DO NOTHING;

-- If you want the superadmin tied to that tenant (create_super_admin.js uses this), update the user:
-- UPDATE "user" SET tenant_id = (SELECT id FROM tenant WHERE code='system-admin') WHERE email = 'superadmin@example.com';

-- End of generated SQL
