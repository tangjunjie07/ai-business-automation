-- Migration: add master matching identifiers/codes to prediction/journal tables
-- Idempotent (safe to run multiple times)

ALTER TABLE IF EXISTS claude_predictions
  ADD COLUMN IF NOT EXISTS matched_account_id text,
  ADD COLUMN IF NOT EXISTS matched_account_code text,
  ADD COLUMN IF NOT EXISTS matched_account_name text,
  ADD COLUMN IF NOT EXISTS matched_vendor_code text;

ALTER TABLE IF EXISTS mf_journal_entries
  ADD COLUMN IF NOT EXISTS matched_account_id text,
  ADD COLUMN IF NOT EXISTS matched_account_code text,
  ADD COLUMN IF NOT EXISTS matched_vendor_id text,
  ADD COLUMN IF NOT EXISTS matched_vendor_code text;
