import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

// Secret-gated bulk text ingest: chunk + embed (gte-small) arbitrary text (e.g.,
// official NERC standard texts) into the knowledge base. Not user-facing.

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
  return out.filter((c) => c.length > 30).slice(0, 300)
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" })
  const url = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  const { data: secret } = await admin.rpc("get_secret", { p_name: "INGEST_SECRET" })
  if (!secret || req.headers.get("x-ingest-secret") !== secret) return json(401, { error: "Unauthorized" })

  let body: { id?: string; url?: string; title?: string; content?: string }
  try { body = await req.json() } catch { return json(400, { error: "Invalid JSON" }) }
  const { url: docUrl, title, content } = body
  if (!docUrl || !content) return json(400, { error: "url and content are required" })

  const hash = await sha256(content)
  const { data: docRow, error: upErr } = await admin.from("nerc_documents").upsert({
    source_id: null, url: docUrl, title: title ?? null, content,
    content_hash: hash, metadata: { kind: "official-standard-text" }, fetched_at: new Date().toISOString(),
  }, { onConflict: "url" }).select("id").single()
  if (upErr || !docRow) return json(500, { error: upErr?.message ?? "upsert failed" })

  await admin.from("nerc_chunks").delete().eq("document_id", docRow.id)
  const chunks = chunkText(content)
  // @ts-ignore Supabase global available in edge runtime
  const model = new Supabase.ai.Session("gte-small")
  const rows: Record<string, unknown>[] = []
  for (let i = 0; i < chunks.length; i++) {
    const emb = await model.run(chunks[i], { mean_pool: true, normalize: true }) as number[]
    rows.push({ document_id: docRow.id, source_id: null, url: docUrl, title: title ?? null, chunk_index: i, content: chunks[i], embedding: JSON.stringify(emb) })
  }
  // insert in batches to keep payloads reasonable
  for (let i = 0; i < rows.length; i += 50) {
    const { error: cErr } = await admin.from("nerc_chunks").insert(rows.slice(i, i + 50))
    if (cErr) return json(500, { error: `chunk insert failed: ${cErr.message}` })
  }
  return json(200, { success: true, url: docUrl, chunks: rows.length })
})
