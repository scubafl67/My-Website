#!/usr/bin/env bash
# Bulk-load official NERC CIP standard texts into the Supabase knowledge base.
# Reads each .txt file from the connector's standards cache, chunks it, and posts
# SMALL batches to the `ingest-text` edge function (which embeds with gte-small).
#
# The content is DATA and lives in Supabase, not Git. This script is the
# repeatable loader. Batches are small with retries because the free-tier edge
# worker intermittently can't load the embedding model under memory pressure —
# small + retry rides that out (slow but reliable).
#
# Usage:
#   export INGEST_SECRET=...        # value of the Supabase Vault 'INGEST_SECRET'
#   export FN_URL=https://<ref>.supabase.co/functions/v1/ingest-text
#   ./scripts/ingest-standards.sh /path/to/nerc-cip-connector/standards_cache
set -euo pipefail

CACHE_DIR="${1:?Pass the standards_cache directory as the first argument}"
: "${INGEST_SECRET:?Set INGEST_SECRET (from Supabase Vault)}"
: "${FN_URL:?Set FN_URL to the ingest-text function URL}"

CACHE="$CACHE_DIR" python3 <<'PY'
import os, re, json, glob, time, urllib.request, urllib.error
secret = os.environ['INGEST_SECRET']; fn = os.environ['FN_URL']; cache = os.environ['CACHE']

def chunk(md, maxlen=1500):
    paras = re.split(r'\n\s*\n', md); out = []; cur = ''
    for p in paras:
        nxt = cur + '\n\n' + p if cur else p
        if len(nxt) > maxlen and cur:
            out.append(cur.strip()); cur = p
        else:
            cur = nxt
    if cur.strip(): out.append(cur.strip())
    return [c for c in out if len(c) > 30]

def post(payload):
    req = urllib.request.Request(fn, data=json.dumps(payload).encode(),
        headers={'Content-Type': 'application/json', 'x-ingest-secret': secret}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=150) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        return {'error': e.read().decode()[:120], 'status': e.code}
    except Exception as e:
        return {'error': str(e)}

def post_retry(payload, maxr=12):
    for _ in range(maxr):
        r = post(payload)
        if r.get('success'):
            return r
        time.sleep(3)  # let a fresh/warmer worker pick it up
    return r

BATCH = 4
ok = fail = total = 0
for f in sorted(glob.glob(cache + '/*.txt')):
    sid = os.path.basename(f)[:-4]
    content = open(f, encoding='utf-8', errors='replace').read()
    chunks = chunk(content)
    url = 'https://www.nerc.com/pa/Stand/Pages/ReliabilityStandardsUnitedStates.aspx?std=' + sid
    title = 'NERC ' + sid + ' — Official Standard Text'
    cnt = 0; failed = False
    for bi in range(0, len(chunks), BATCH):
        p = {'url': url, 'title': title, 'chunks': chunks[bi:bi + BATCH], 'reset': bi == 0, 'offset': bi}
        if bi == 0:
            p['content'] = content
        r = post_retry(p)
        if r.get('success'):
            cnt += r.get('inserted', 0)
        else:
            failed = True; print(sid, 'batch', bi, 'GAVE UP', r, flush=True); break
    if failed:
        fail += 1
    else:
        ok += 1; total += cnt; print(sid, 'OK chunks=', cnt, flush=True)
print('=== DONE ok=%d fail=%d total_chunks=%d ===' % (ok, fail, total), flush=True)
PY
