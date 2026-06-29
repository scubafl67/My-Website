import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

// Super-admin NERC ingestion: scrape a source with Firecrawl, store the raw doc,
// then chunk it and embed each chunk with Supabase's free built-in gte-small model.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } })
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
  return out.filter((c) => c.length > 40).slice(0, 60)  // cap per ingest
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json(405, { error: "Method not allowed" })

  const url = Deno.env.get("SUPABASE_URL")!
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const authHeader = req.headers.get("Authorization") ?? ""

  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json(401, { error: "Authentication required." })

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: prof } = await admin.from("profiles").select("access_level").eq("id", user.id).single()
  if (prof?.access_level !== "super_admin") return json(403, { error: "Super admin access required." })

  let body: { sourceId?: string; url?: string }
  try { body = await req.json() } catch { return json(400, { error: "Invalid JSON body" }) }
  let targetUrl = body.url
  const sourceId = body.sourceId ?? null
  if (!targetUrl && sourceId) {
    const { data: src } = await admin.from("nerc_sources").select("base_url").eq("id", sourceId).single()
    targetUrl = src?.base_url
  }
  if (!targetUrl) return json(400, { error: "Provide a url or a sourceId." })

  const { data: fcKey, error: keyErr } = await admin.rpc("get_secret", { p_name: "FIRECRAWL_API_KEY" })
  if (keyErr || !fcKey) return json(500, { error: "Firecrawl key not configured." })

  const fcRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { "Authorization": `Bearer ${fcKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url: targetUrl, formats: ["markdown"] }),
  })
  const fc = await fcRes.json()
  if (!fcRes.ok || !fc.success) return json(502, { error: "Firecrawl scrape failed.", detail: fc.error ?? null })

  const markdown: string = fc.data?.markdown ?? ""
  const title: string | null = fc.data?.metadata?.title ?? null
  const hash = await sha256(markdown)

  const { data: docRow, error: upErr } = await admin.from("nerc_documents").upsert({
    source_id: sourceId, url: targetUrl, title, content: markdown,
    content_hash: hash, metadata: fc.data?.metadata ?? {}, fetched_at: new Date().toISOString(),
  }, { onConflict: "url" }).select("id").single()
  if (upErr || !docRow) return json(500, { error: upErr?.message ?? "Document upsert failed" })

  // Re-chunk: drop old chunks for this doc, then embed fresh
  await admin.from("nerc_chunks").delete().eq("document_id", docRow.id)
  const chunks = chunkText(markdown)

  // @ts-ignore Supabase global is available in the edge runtime
  const model = new Supabase.ai.Session("gte-small")
  const rows: Record<string, unknown>[] = []
  for (let i = 0; i < chunks.length; i++) {
    const emb = await model.run(chunks[i], { mean_pool: true, normalize: true }) as number[]
    rows.push({
      document_id: docRow.id, source_id: sourceId, url: targetUrl, title,
      chunk_index: i, content: chunks[i], embedding: JSON.stringify(emb),
    })
  }
  if (rows.length) {
    const { error: cErr } = await admin.from("nerc_chunks").insert(rows)
    if (cErr) return json(500, { error: `Chunk insert failed: ${cErr.message}` })
  }

  if (sourceId) await admin.from("nerc_sources").update({ last_crawled_at: new Date().toISOString() }).eq("id", sourceId)

  return json(200, { success: true, url: targetUrl, title, chars: markdown.length, chunks: rows.length })
})
