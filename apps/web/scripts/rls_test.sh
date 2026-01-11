#!/usr/bin/env bash
# Simple RLS test script (examples). Adjust BASE_URL and endpoints.
BASE_URL=${BASE_URL:-http://localhost:3000}

echo "GET invoices as tenant-a"
curl -s -H "X-Tenant-ID: tenant-a" "${BASE_URL}/api/invoices" | jq '.' || true

echo "POST invoice as tenant-a"
curl -s -X POST -H "Content-Type: application/json" -H "X-Tenant-ID: tenant-a" \
  -d '{"amount":1000,"description":"test"}' "${BASE_URL}/api/invoices" | jq '.' || true

echo "GET invoices without tenant header (should be rejected)"
curl -s -i "${BASE_URL}/api/invoices" || true
