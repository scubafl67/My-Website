import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

// Two-secret password recovery (no email). A forgotten-password request must
// supply the account email plus BOTH recovery secrets; the secrets are verified
// server-side (bcrypt) via verify_recovery_secrets, then the password is reset
// using the service-role admin API. This endpoint is intentionally pre-login
// (verify_jwt = false); its auth IS the two-secret challenge.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json(405, { error: "Method not allowed" })

  let payload: { email?: string; secret1?: string; secret2?: string; newPassword?: string }
  try {
    payload = await req.json()
  } catch {
    return json(400, { error: "Invalid JSON body" })
  }

  const { email, secret1, secret2, newPassword } = payload
  if (!email || !secret1 || !secret2 || !newPassword) {
    return json(400, { error: "Email, both secrets, and a new password are required." })
  }
  if (newPassword.length < 8) {
    return json(400, { error: "New password must be at least 8 characters." })
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: userId, error: vErr } = await admin.rpc("verify_recovery_secrets", {
    p_email: email,
    p_secret_1: secret1,
    p_secret_2: secret2,
  })
  if (vErr) return json(500, { error: "Verification error." })
  // Generic failure message — do not reveal whether the email or the secrets were wrong.
  if (!userId) return json(401, { error: "The information provided did not match our records." })

  const { error: uErr } = await admin.auth.admin.updateUserById(userId as string, {
    password: newPassword,
  })
  if (uErr) return json(400, { error: uErr.message })

  return json(200, { success: true })
})
