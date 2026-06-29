import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

// Secret-gated bulk text ingest, BATCHED to stay under the edge CPU limit.
// The caller pre-chunks the text and posts small batches:
//   reset=true  (first batch): upsert the document, clear old chunks, embed+insert this batch
//   reset=false (later batches): append more embedded chunks to the same document
// gte-small embedding is CPU-heavy, so keep batches small (~4-5 chunks) and retry.

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}
async function sha256(t: string): Promise<string> {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t))
  return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("")
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" })
  const url = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  const { data: secret } = await admin.rpc("get_secret", { p_name: "INGEST_SECRET" })
  if (!secret || req.headers.get("x-ingest-secret") !== secret) return json(401, { error: "Unauthorized" })

  let body: { url?: string; title?: string; content?: string; chunks?: string[]; reset?: boolean; offset?: number }
  try { body = await req.json() } catch { return json(400, { error: "Invalid JSON" }) }
  const { url: docUrl, title, content, chunks, reset, offset } = body
  if (!docUrl || !Array.isArray(chunks)) return json(400, { error: "url and chunks[] are required" })

  // Resolve the document id (create/refresh on reset, else look up)
  let documentId: string
  if (reset) {
    const hash = await sha256(content ?? chunks.join("\n"))
    const { data: docRow, error: upErr } = await admin.from("nerc_documents").upsert({
      source_id: null, url: docUrl, title: title ?? null, content: content ?? null,
      content_hash: hash, metadata: { kind: "official-standard-text" }, fetched_at: new Date().toISOString(),
    }, { onConflict: "url" }).select("id").single()
    if (upErr || !docRow) return json(500, { error: upErr?.message ?? "upsert failed" })
    documentId = docRow.id
    await admin.from("nerc_chunks").delete().eq("document_id", documentId)
  } else {
    const { data: docRow } = await admin.from("nerc_documents").select("id").eq("url", docUrl).single()
    if (!docRow) return json(400, { error: "Document not found; send reset=true first" })
    documentId = docRow.id
  }

  const base = offset ?? 0
  // @ts-ignore Supabase global available in edge runtime
  const model = new Supabase.ai.Session("gte-small")
  const rows: Record<string, unknown>[] = []
  for (let i = 0; i < chunks.length; i++) {
    const emb = await model.run(chunks[i], { mean_pool: true, normalize: true }) as number[]
    rows.push({ document_id: documentId, source_id: null, url: docUrl, title: title ?? null, chunk_index: base + i, content: chunks[i], embedding: JSON.stringify(emb) })
  }
  if (rows.length) {
    const { error: cErr } = await admin.from("nerc_chunks").insert(rows)
    if (cErr) return json(500, { error: `chunk insert failed: ${cErr.message}` })
  }
  return json(200, { success: true, url: docUrl, inserted: rows.length })
})
