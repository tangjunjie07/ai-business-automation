-- RLS 初期スクリプト
-- 実行順: 1) 拡張作成 2) テーブル作成 3) RLS 有効化 4) ポリシー作成 5) インデックス

-- 1. 拡張
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. テナントテーブル
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country_code CHAR(2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. invoices テーブル
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  project_id UUID,
  vendor_name TEXT,
  amount NUMERIC(15,2),
  currency CHAR(3),
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. OCRResult テーブル
CREATE TABLE IF NOT EXISTS ocr_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES invoices(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  raw JSONB,
  extracted JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. reconciliation テーブル
CREATE TABLE IF NOT EXISTS reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  invoice_id UUID REFERENCES invoices(id),
  status TEXT DEFAULT 'pending',
  diff JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. journal_entries テーブル
CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  source_id UUID, -- 参照（invoice/reconciliation等）
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. payment_orders テーブル
CREATE TABLE IF NOT EXISTS payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  journal_entry_id UUID REFERENCES journal_entries(id),
  amount NUMERIC(15,2),
  currency CHAR(3),
  status TEXT DEFAULT 'created',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS を有効化
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;

-- ポリシー（セッション変数 app.current_tenant_id を前提）
CREATE POLICY invoices_tenant_select ON invoices
  FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY invoices_tenant_insert ON invoices
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY invoices_tenant_update ON invoices
  FOR UPDATE USING (tenant_id = current_setting('app.current_tenant_id')::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- 他テーブルにも同様のポリシーを作成
CREATE POLICY ocr_results_tenant_select ON ocr_results
  FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY ocr_results_tenant_insert ON ocr_results
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY reconciliations_tenant_select ON reconciliations
  FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY reconciliations_tenant_insert ON reconciliations
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY journal_entries_tenant_select ON journal_entries
  FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY journal_entries_tenant_insert ON journal_entries
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY payment_orders_tenant_select ON payment_orders
  FOR SELECT USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY payment_orders_tenant_insert ON payment_orders
  FOR INSERT WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- 権限の見直し
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;

-- インデックス
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ocr_results_tenant_id ON ocr_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_reconciliations_tenant_id ON reconciliations(tenant_id);

-- 監査テーブル例
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  actor TEXT,
  action TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- END
