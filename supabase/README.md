# CIPGuard — Supabase backend (version-controlled)

This folder is the **source of truth** for the CIPGuard backend. Everything here is
code and is committed to Git. Application **data** (user profiles, the CIP catalog,
the NERC knowledge-base documents/embeddings) lives only in the Supabase database —
never in this repo.

Project ref: `ljifidyvcvylvonkufwd`

## Layout
```
supabase/
  functions/            Edge Functions (Deno)
    reset-password/     Two-secret password reset (verify_jwt=false)
    query-nerc/         RAG Q&A: embed → vector search → Claude cited answer (auth required)
    ingest-nerc/        Super-admin: Firecrawl scrape one source → chunk → embed
    cron-ingest/        Scheduler-only (x-cron-secret): refresh most-stale source
    ingest-text/        Secret-gated bulk text ingest (e.g., official standard texts)
  migrations/           SQL schema migrations (tables, RLS, functions, cron)
scripts/
  ingest-standards.sh   Repeatable loader for the official CIP standard texts
```

## Deploying
Edge functions and migrations are applied to the Supabase project. With the
Supabase CLI (`supabase link --project-ref ljifidyvcvylvonkufwd`):
```
supabase functions deploy <name>     # deploy an edge function
supabase db push                     # apply pending migrations
```
(During development they were applied via the Supabase management API; going
forward, change them **here** and deploy, so Git stays the source of truth.)

## Secrets (Supabase Vault — never in Git)
- `FIRECRAWL_API_KEY` — Firecrawl scraping
- `ANTHROPIC_API_KEY` — Claude answer synthesis
- `CRON_SECRET` — authenticates pg_cron → `cron-ingest`
- `INGEST_SECRET` — temporary, for the one-time standards bulk load

Edge functions read these via the `public.get_secret(name)` RPC (service-role only).
Frontend env (publishable Supabase key, Turnstile site key) lives in `.env` / Netlify.

## Scheduled refresh
`pg_cron` job `nerc-daily-refresh` (`17 6 * * *`) calls `cron-ingest` via `pg_net`,
re-ingesting the most-stale enabled source each run (rotates through all sources).
