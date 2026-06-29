import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

// Scheduled refresh (v2), invoked by pg_cron via pg_net. Secret-gated
// (x-cron-secret). Re-scrapes the SINGLE most-stale enabled source and stores
// its chunks with embedding = NULL; the embed-pending worker embeds them later.
// Scraping/storing is light, so this never hits the embedding memory limit.

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
  return out.filter((c) => c.length > 40).slice(0, 200)
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" })

  const url = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  const { data: secret } = await admin.rpc("get_secret", { p_name: "CRON_SECRET" })
  if (!secret || req.headers.get("x-cron-secret") !== secret) return json(401, { error: "Unauthorized" })

  const { data: sources } = await admin
    .from("nerc_sources").select("id, base_url").eq("enabled", true)
    .order("last_crawled_at", { ascending: true, nullsFirst: true }).limit(1)
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
      const rows = chunks.map((content, i) => ({ document_id: docRow.id, source_id: source.id, url: source.base_url, title, chunk_index: i, content, embedding: null }))
      for (let i = 0; i < rows.length; i += 100) await admin.from("nerc_chunks").insert(rows.slice(i, i + 100))
      await admin.from("nerc_sources").update({ last_crawled_at: new Date().toISOString() }).eq("id", source.id)
      return json(200, { success: true, source: source.base_url, chunks: rows.length, note: "Embedding in background." })
    }
    return json(500, { error: "Document upsert failed", source: source.base_url })
  } catch (e) {
    await admin.from("nerc_sources").update({ last_crawled_at: new Date().toISOString() }).eq("id", source.id)
    return json(500, { error: String(e), source: source.base_url })
  }
})
