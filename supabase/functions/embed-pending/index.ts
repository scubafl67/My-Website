import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

// Background embedder. Secret-gated (x-cron-secret). Embeds a SMALL batch of
// not-yet-embedded chunks per call with gte-small. Triggered frequently by
// pg_cron; because each call is a fresh worker, the gte-small memory limit
// (status 546) is ridden out — a failed call just leaves those chunks NULL for
// the next run. This decouples (fast, reliable) scraping from (memory-heavy)
// embedding.

const BATCH = 4

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" })
  const url = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  const { data: secret } = await admin.rpc("get_secret", { p_name: "CRON_SECRET" })
  if (!secret || req.headers.get("x-cron-secret") !== secret) return json(401, { error: "Unauthorized" })

  const { data: pending, error } = await admin
    .from("nerc_chunks").select("id, content").is("embedding", null)
    .order("created_at", { ascending: true }).limit(BATCH)
  if (error) return json(500, { error: error.message })
  if (!pending || pending.length === 0) return json(200, { embedded: 0, done: true })

  // @ts-ignore Supabase global available in edge runtime
  const model = new Supabase.ai.Session("gte-small")
  let embedded = 0
  for (const c of pending as { id: string; content: string }[]) {
    const emb = await model.run(c.content, { mean_pool: true, normalize: true }) as number[]
    const { error: uErr } = await admin.from("nerc_chunks").update({ embedding: JSON.stringify(emb) }).eq("id", c.id)
    if (uErr) return json(500, { error: uErr.message, embedded })
    embedded++
  }

  const { count } = await admin.from("nerc_chunks").select("id", { count: "exact", head: true }).is("embedding", null)
  return json(200, { embedded, remaining: count ?? null })
})
