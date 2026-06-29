#!/usr/bin/env bash
# Bulk-load official NERC CIP standard texts into the Supabase knowledge base.
# Reads each .txt file from the connector's standards cache and POSTs it to the
# `ingest-text` edge function (which chunks + embeds with gte-small).
#
# The content is DATA and lives in Supabase, not Git. This script is the
# repeatable loader.
#
# Usage:
#   export INGEST_SECRET=...        # value of the Supabase Vault 'INGEST_SECRET'
#   export FN_URL=https://<ref>.supabase.co/functions/v1/ingest-text
#   ./scripts/ingest-standards.sh /path/to/nerc-cip-connector/standards_cache
set -euo pipefail

CACHE_DIR="${1:?Pass the standards_cache directory as the first argument}"
: "${INGEST_SECRET:?Set INGEST_SECRET (from Supabase Vault)}"
: "${FN_URL:?Set FN_URL to the ingest-text function URL}"

ok=0; fail=0
cd "$CACHE_DIR"
for f in *.txt; do
  id="${f%.txt}"
  python3 -c "import json,sys; print(json.dumps({'url':'https://www.nerc.com/pa/Stand/Pages/ReliabilityStandardsUnitedStates.aspx?std='+sys.argv[1],'title':'NERC '+sys.argv[1]+' — Official Standard Text','content':open(sys.argv[2],encoding='utf-8',errors='replace').read()}))" "$id" "$f" > /tmp/_ingest_payload.json
  resp=$(curl -s -m 150 -X POST "$FN_URL" -H "x-ingest-secret: $INGEST_SECRET" -H "Content-Type: application/json" --data-binary @/tmp/_ingest_payload.json)
  echo "$id -> $resp"
  if echo "$resp" | grep -q '"success":true'; then ok=$((ok+1)); else fail=$((fail+1)); fi
done
rm -f /tmp/_ingest_payload.json
echo "=== DONE ok=$ok fail=$fail ==="
