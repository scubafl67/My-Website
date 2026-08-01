// CIPGuard Auth Gate — rate-limited Basic Auth with lockout and email alerting
// Required Netlify env vars:
//   CIPGUARD_USER        — authorized username
//   CIPGUARD_HASH        — SHA-256 hex of authorized password
//   SUPABASE_URL         — Supabase project URL
//   SUPABASE_SERVICE_KEY — Supabase service role key (for rate limit writes)
//   RESEND_API_KEY       — Resend API key for alert emails
//   CIPGUARD_ALERT_EMAIL — address to send alerts to

const MAX_ATTEMPTS       = 3;
const LOCKOUT_MINUTES    = 30;
const WINDOW_MINUTES     = 2;
const MULTI_IP_THRESHOLD = 3;

async function hashPassword(pw) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function sb(path, opts = {}) {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_KEY");
  return fetch(`${url}/rest/v1${path}`, {
    ...opts,
    headers: {
      "Content-Type":  "application/json",
      "apikey":        key,
      "Authorization": `Bearer ${key}`,
      "Prefer":        "return=representation",
      ...(opts.headers ?? {}),
    },
  });
}

async function sendAlert(subject, body) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const to     = Deno.env.get("CIPGUARD_ALERT_EMAIL");
  if (!apiKey || !to) return;
  await fetch("https://api.resend.com/emails", {
    method:  "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      from:    "CIPGuard Security <onboarding@resend.dev>",
      to:      [to],
      subject,
      text:    body,
    }),
  });
}

export default async function handler(req, context) {
  const ip  = context.ip ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const now = new Date().toISOString();

  // ── Check existing lockout ────────────────────────────────────────────────
  const recRes = await sb(`/auth_rate_limits?ip=eq.${encodeURIComponent(ip)}&select=*`);
  const recs   = await recRes.json();
  const rec    = recs[0] ?? null;

  if (rec?.locked_until && new Date(rec.locked_until) > new Date()) {
    // Allow super admin to unlock with secondary secret
    const unlockHeader = req.headers.get("authorization") ?? "";
    if (unlockHeader.startsWith("Basic ")) {
      const decoded      = atob(unlockHeader.slice(6));
      const colon        = decoded.indexOf(":");
      const username     = decoded.slice(0, colon);
      const password     = decoded.slice(colon + 1);
      const hashHex      = await hashPassword(password);
      const unlockHash   = Deno.env.get("CIPGUARD_UNLOCK_HASH") ?? "";
      const expectedUser = Deno.env.get("CIPGUARD_USER") ?? "";
      if (username === expectedUser && hashHex === unlockHash) {
        await sb(`/auth_rate_limits?ip=eq.${encodeURIComponent(ip)}`, { method: "DELETE" });
        return context.next();
      }
    }
    const remaining = Math.ceil((new Date(rec.locked_until) - Date.now()) / 60000);
    return new Response(`Locked out. Try again in ${remaining} minute(s).`, {
      status: 429,
      headers: { "Retry-After": String(remaining * 60) },
    });
  }

  // ── Validate credentials ──────────────────────────────────────────────────
  const authHeader  = req.headers.get("authorization") ?? "";
  let authenticated = false;

  if (authHeader.startsWith("Basic ")) {
    const decoded  = atob(authHeader.slice(6));
    const colon    = decoded.indexOf(":");
    const username = decoded.slice(0, colon);
    const password = decoded.slice(colon + 1);
    const hashHex  = await hashPassword(password);
    authenticated  = username === (Deno.env.get("CIPGUARD_USER") ?? "")
                  && hashHex  === (Deno.env.get("CIPGUARD_HASH") ?? "");
  }

  if (authenticated) {
    if (rec) await sb(`/auth_rate_limits?ip=eq.${encodeURIComponent(ip)}`, { method: "DELETE" });
    return context.next();
  }

  // ── Record failure ────────────────────────────────────────────────────────
  const count      = (rec?.fail_count ?? 0) + 1;
  const lockedUntil = count >= MAX_ATTEMPTS
    ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
    : null;

  if (rec) {
    await sb(`/auth_rate_limits?ip=eq.${encodeURIComponent(ip)}`, {
      method: "PATCH",
      body:   JSON.stringify({ fail_count: count, last_fail: now, locked_until: lockedUntil }),
    });
  } else {
    await sb("/auth_rate_limits", {
      method: "POST",
      body:   JSON.stringify({ ip, fail_count: count, first_fail: now, last_fail: now, locked_until: lockedUntil }),
    });
  }

  // ── Lockout alert ─────────────────────────────────────────────────────────
  if (count >= MAX_ATTEMPTS) {
    await sendAlert(
      `🔒 CIPGuard: IP ${ip} locked out after ${MAX_ATTEMPTS} failed attempts`,
      `IP ${ip} has been locked out of cipguard.netlify.app.\n\nFailed attempts : ${count}\nLocked until    : ${lockedUntil}\n\nReview edge function logs at app.netlify.com if unexpected.`
    );
  }

  // ── Multi-IP coordinated detection ────────────────────────────────────────
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
  const multiRes    = await sb(`/auth_rate_limits?last_fail=gte.${windowStart}&select=ip,fail_count`);
  const recentIPs   = await multiRes.json();

  if (Array.isArray(recentIPs) && recentIPs.length >= MULTI_IP_THRESHOLD) {
    await sendAlert(
      `🚨 CIPGuard: Coordinated login attack — ${recentIPs.length} distinct IPs`,
      `Multiple IPs are failing authentication within a ${WINDOW_MINUTES}-minute window.\n\nSource IPs:\n${recentIPs.map(r => `  ${r.ip}  (${r.fail_count} attempts)`).join("\n")}\n\nConsider enabling IP blocking in your Netlify dashboard.`
    );
  }

  const msg = count >= MAX_ATTEMPTS
    ? `Too many failed attempts. Locked out for ${LOCKOUT_MINUTES} minutes.`
    : `Invalid credentials. ${MAX_ATTEMPTS - count} attempt(s) remaining.`;

  return new Response(msg, {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="CIPGuard"' },
  });
}

export const config = { path: "/*" };
