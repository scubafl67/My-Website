import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

// Authenticated NERC CIP Q&A. Embeds the question (free gte-small), retrieves the
// most relevant ingested passages, and has Claude synthesize a SOURCE-CITED answer.
// Answers are grounded strictly in retrieved sources to avoid hallucinated
// compliance facts; if the sources don't cover it, it says so.

const ANSWER_MODEL = "claude-haiku-4-5-20251001"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } })
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json(405, { error: "Method not allowed" })

  const url = Deno.env.get("SUPABASE_URL")!
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const authHeader = req.headers.get("Authorization") ?? ""

  // Any signed-in user may ask questions
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return json(401, { error: "Authentication required." })

  let body: { question?: string }
  try { body = await req.json() } catch { return json(400, { error: "Invalid JSON body" }) }
  const question = (body.question ?? "").trim()
  if (!question) return json(400, { error: "A question is required." })

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  // 1) Embed the question with the free built-in model
  // @ts-ignore Supabase global is available in the edge runtime
  const model = new Supabase.ai.Session("gte-small")
  const emb = await model.run(question, { mean_pool: true, normalize: true }) as number[]

  // 2) Retrieve the most relevant passages
  const { data: matches, error: mErr } = await admin.rpc("match_nerc_chunks", {
    query_embedding: JSON.stringify(emb),
    match_count: 6,
  })
  if (mErr) return json(500, { error: `Search failed: ${mErr.message}` })

  if (!matches || matches.length === 0) {
    return json(200, {
      answer: "I don't have any ingested NERC source material that covers this yet. An administrator needs to run ingestion on the relevant NERC sources first.",
      sources: [],
    })
  }

  // 3) Build grounded context
  const context = (matches as { content: string; url: string; title: string }[])
    .map((m, i) => `[Source ${i + 1}] ${m.title ?? ""} (${m.url})\n${m.content}`)
    .join("\n\n---\n\n")
  const sources = [...new Set((matches as { url: string }[]).map((m) => m.url))]

  // 4) Read the Claude key and synthesize a cited answer
  const { data: apiKey, error: kErr } = await admin.rpc("get_secret", { p_name: "ANTHROPIC_API_KEY" })
  if (kErr || !apiKey) return json(500, { error: "Anthropic key not configured." })

  const system = "You are a NERC CIP reference assistant. Answer the user's question USING ONLY the provided sources. " +
    "Cite the specific source number(s) inline like [Source 2]. If the sources do not contain the answer, say so plainly " +
    "and do not guess. Be precise about requirement numbers, thresholds, and dates. End with: 'Verify against the official NERC source before relying on this for compliance.'"

  const aRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey as string, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: ANSWER_MODEL,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: `Question: ${question}\n\nSources:\n${context}` }],
    }),
  })
  const a = await aRes.json()
  if (!aRes.ok) return json(502, { error: "Answer generation failed.", detail: a.error?.message ?? null })

  const answer = a.content?.[0]?.text ?? "(no answer)"
  return json(200, { answer, sources })
})
