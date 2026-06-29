import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

// Scheduled refresh, invoked by pg_cron via pg_net. NOT user-facing: it is gated
// by a shared secret (x-cron-secret) checked against Vault. Each run re-ingests the
// SINGLE most-stale enabled source (oldest last_crawled_at first), so a daily
// schedule rotates through all sources without long-running invocations.

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}
async function sha256(t: string): Promise<string> {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t))
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("")
}
function chunkText(md: string, maxLen = 1500): string[] {
  const paras = md.split(/\n\s*\n/)
  const out: string[] = []
  let cur = ""
  for (const p of paras) {
    const next = cur ? cur + "\n\n" + p : p
    if (next.length > maxLen && cur) { out.push(cur.trim()); cur = p } else { cur = next }
  }
  if (cur.trim()) out.push(cur.trim())
  return out.filter((c) => c.length > 40).slice(0, 60)
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" })

  const url = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  // Authenticate the scheduler via the shared Vault secret
  const { data: secret } = await admin.rpc("get_secret", { p_name: "CRON_SECRET" })
  const provided = req.headers.get("x-cron-secret")
  if (!secret || provided !== secret) return json(401, { error: "Unauthorized" })

  // Pick the most-stale enabled source (never-crawled first)
  const { data: sources } = await admin
    .from("nerc_sources")
    .select("id, base_url")
    .eq("enabled", true)
    .order("last_crawled_at", { ascending: true, nullsFirst: true })
    .limit(1)
  const source = sources?.[0]
  if (!source) return json(200, { success: true, message: "No enabled sources to refresh." })

  const { data: fcKey } = await admin.rpc("get_secret", { p_name: "FIRECRAWL_API_KEY" })
  if (!fcKey) return json(500, { error: "Firecrawl key not configured." })

  try {
    const fcRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { "Authorization": `Bearer ${fcKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: source.base_url, formats: ["markdown"] }),
    })
    const fc = await fcRes.json()
    if (!fcRes.ok || !fc.success) {
      // Still bump last_crawled_at so a broken source doesn't block the rotation
      await admin.from("nerc_sources").update({ last_crawled_at: new Date().toISOString() }).eq("id", source.id)
      return json(502, { error: "Firecrawl scrape failed.", source: source.base_url })
    }

    const markdown: string = fc.data?.markdown ?? ""
    const title: string | null = fc.data?.metadata?.title ?? null
    const hash = await sha256(markdown)

    const { data: docRow } = await admin.from("nerc_documents").upsert({
      source_id: source.id, url: source.base_url, title, content: markdown,
      content_hash: hash, metadata: fc.data?.metadata ?? {}, fetched_at: new Date().toISOString(),
    }, { onConflict: "url" }).select("id").single()

    if (docRow) {
      await admin.from("nerc_chunks").delete().eq("document_id", docRow.id)
      const chunks = chunkText(markdown)
      // @ts-ignore Supabase global available in edge runtime
      const model = new Supabase.ai.Session("gte-small")
      const rows: Record<string, unknown>[] = []
      for (let i = 0; i < chunks.length; i++) {
        const emb = await model.run(chunks[i], { mean_pool: true, normalize: true }) as number[]
        rows.push({ document_id: docRow.id, source_id: source.id, url: source.base_url, title, chunk_index: i, content: chunks[i], embedding: JSON.stringify(emb) })
      }
      if (rows.length) await admin.from("nerc_chunks").insert(rows)
      await admin.from("nerc_sources").update({ last_crawled_at: new Date().toISOString() }).eq("id", source.id)
      return json(200, { success: true, source: source.base_url, chunks: rows.length })
    }
    return json(500, { error: "Document upsert failed", source: source.base_url })
  } catch (e) {
    await admin.from("nerc_sources").update({ last_crawled_at: new Date().toISOString() }).eq("id", source.id)
    return json(500, { error: String(e), source: source.base_url })
  }
})
