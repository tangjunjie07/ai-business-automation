-- Migration: add ai_result jsonb column to Invoice
-- Run this against your dev database if Prisma migration is not used:

ALTER TABLE "Invoice"
ADD COLUMN IF NOT EXISTS ai_result jsonb;
