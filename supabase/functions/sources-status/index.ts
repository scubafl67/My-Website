import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

// Called once per login session from the frontend. Returns the freshness status
// of all enabled NERC sources. If any source is stale (>7 days since last crawl),
// fires a background cron-ingest call so the knowledge base stays current without
// blocking the user or requiring admin action. Requires a valid user JWT.

const STALE_DAYS = 7
const STALE_MS = STALE_DAYS * 24 * 60 * 60 * 1000

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: sources, error } = await admin
    .from("nerc_sources")
    .select("id, name, region, last_crawled_at, enabled")
    .eq("enabled", true)
    .order("last_crawled_at", { ascending: true, nullsFirst: true })

  if (error || !sources) {
    return json(500, { error: "Could not read sources." })
  }

  const now = Date.now()
  const crawlTimes = sources
    .map((s) => (s.last_crawled_at ? new Date(s.last_crawled_at).getTime() : 0))
    .filter((t) => t > 0)

  const mostRecent = crawlTimes.length > 0 ? Math.max(...crawlTimes) : 0
  const staleCount = sources.filter((s) => {
    const t = s.last_crawled_at ? new Date(s.last_crawled_at).getTime() : 0
    return now - t > STALE_MS
  }).length

  const fresh = staleCount === 0

  // If stale sources exist, kick off a background re-ingest without blocking.
  if (!fresh) {
    const bgRefresh = (async () => {
      try {
        const { data: cronSecret } = await admin.rpc("get_secret", { p_name: "CRON_SECRET" })
        if (!cronSecret) return
        await fetch(`${supabaseUrl}/functions/v1/cron-ingest`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-cron-secret": cronSecret,
          },
          body: JSON.stringify({}),
        })
      } catch {
        // Best-effort — weekly cron is the primary refresh mechanism
      }
    })()

    // Keep the background task alive after the response is sent
    // @ts-ignore: EdgeRuntime is available in Supabase edge functions
    if (typeof EdgeRuntime !== "undefined") {
      // deno-lint-ignore no-explicit-any
      ;(EdgeRuntime as any).waitUntil(bgRefresh)
    }
  }

  return json(200, {
    fresh,
    lastUpdated: mostRecent > 0 ? new Date(mostRecent).toISOString() : null,
    totalSources: sources.length,
    staleCount,
  })
})
