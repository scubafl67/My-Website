import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

// Two-secret password recovery (no email). A forgotten-password request must
// supply the account email plus BOTH recovery secrets; the secrets are verified
// server-side (bcrypt) via verify_recovery_secrets, then the password is reset
// using the service-role admin API. This endpoint is intentionally pre-login
// (verify_jwt = false); its auth IS the two-secret challenge plus a valid
// Cloudflare Turnstile token verified via canonical siteverify.

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

async function verifyCaptcha(token: string, ip: string): Promise<boolean> {
  const secret = Deno.env.get("TURNSTILE_SECRET")
  if (!secret) {
    console.error("TURNSTILE_SECRET is not set")
    return false
  }
  const body = new URLSearchParams({ secret, response: token, remoteip: ip })
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  })
  const result = await res.json()
  return result.success === true
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return json(405, { error: "Method not allowed" })

  let payload: {
    email?: string
    secret1?: string
    secret2?: string
    newPassword?: string
    captchaToken?: string
  }
  try {
    payload = await req.json()
  } catch {
    return json(400, { error: "Invalid JSON body" })
  }

  const { email, secret1, secret2, newPassword, captchaToken } = payload
  if (!email || !secret1 || !secret2 || !newPassword) {
    return json(400, { error: "Email, both secrets, and a new password are required." })
  }
  if (newPassword.length < 8) {
    return json(400, { error: "New password must be at least 8 characters." })
  }
  if (!captchaToken) {
    return json(400, { error: "Bot verification required." })
  }

  // Verify Turnstile token before touching any user data.
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? ""
  const captchaOk = await verifyCaptcha(captchaToken, clientIp)
  if (!captchaOk) {
    return json(403, { error: "Bot verification failed. Please try again." })
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
