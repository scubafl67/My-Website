// Rate-limited Supabase login proxy — uses raw fetch (no SDK, avoids WebSocket issues)
// Enforces attempt limits, lockout, and email alerts before credentials reach Supabase.

const crypto = require("crypto");

const SUPABASE_URL     = process.env.SUPABASE_URL;
const SERVICE_KEY      = process.env.SUPABASE_SERVICE_KEY;
const ANON_KEY         = process.env.SUPABASE_ANON_KEY;

const MAX_ATTEMPTS       = 3;
const LOCKOUT_MINUTES    = 30;
const WINDOW_MINUTES     = 2;
const MULTI_IP_THRESHOLD = 3;

// ── Supabase REST helpers ──────────────────────────────────────────────────────
function sbRest(path, opts = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      "Content-Type":  "application/json",
      "apikey":        SERVICE_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "Prefer":        "return=representation",
      ...(opts.headers ?? {}),
    },
  });
}

async function getRateRecord(ip) {
  const res  = await sbRest(`/auth_rate_limits?ip=eq.${encodeURIComponent(ip)}&select=*`);
  const rows = await res.json();
  return rows?.[0] ?? null;
}

async function upsertRateRecord(ip, fields) {
  const exists = await getRateRecord(ip);
  if (exists) {
    await sbRest(`/auth_rate_limits?ip=eq.${encodeURIComponent(ip)}`, {
      method: "PATCH", body: JSON.stringify(fields),
    });
  } else {
    await sbRest("/auth_rate_limits", {
      method: "POST", body: JSON.stringify({ ip, ...fields }),
    });
  }
}

async function deleteRateRecord(ip) {
  await sbRest(`/auth_rate_limits?ip=eq.${encodeURIComponent(ip)}`, { method: "DELETE" });
}

// ── Email alert ───────────────────────────────────────────────────────────────
async function sendAlert(subject, body) {
  const apiKey = process.env.RESEND_API_KEY;
  const to     = process.env.CIPGUARD_ALERT_EMAIL;
  if (!apiKey || !to) return;
  await fetch("https://api.resend.com/emails", {
    method:  "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: "CIPGuard Security <onboarding@resend.dev>",
      to:   [to], subject, text: body,
    }),
  });
}

// ── Supabase auth sign-in via REST ────────────────────────────────────────────
async function supabaseSignIn(email, password, captchaToken) {
  const body = { email, password };
  if (captchaToken) body.gotrue_meta_security = { captcha_token: captchaToken };

  const res  = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey":       ANON_KEY,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) return { session: null, error: data };
  // Shape into a Supabase-compatible session object
  const session = {
    access_token:  data.access_token,
    refresh_token: data.refresh_token,
    expires_in:    data.expires_in,
    token_type:    data.token_type,
    user:          data.user,
  };
  return { session, error: null };
}

// ── Handler ───────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const ip  = event.headers["x-forwarded-for"]?.split(",")[0].trim() ?? "unknown";
  const now = new Date().toISOString();

  let body;
  try { body = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: "Invalid request body" }) }; }

  const { email, password, captchaToken } = body;

  // ── Check lockout ───────────────────────────────────────────────────────
  const rec = await getRateRecord(ip);

  if (rec?.locked_until && new Date(rec.locked_until) > new Date()) {
    // Allow super admin unlock with secondary secret
    const incomingHash = crypto.createHash("sha256").update(password).digest("hex");
    const unlockHash   = process.env.CIPGUARD_UNLOCK_HASH ?? "";
    const adminUser    = process.env.CIPGUARD_USER ?? "";

    if (email === adminUser && incomingHash === unlockHash) {
      await deleteRateRecord(ip);
      // Fall through to sign-in below
    } else {
      const remaining = Math.ceil((new Date(rec.locked_until) - Date.now()) / 60000);
      return {
        statusCode: 429,
        headers: { "Content-Type": "application/json", "Retry-After": String(remaining * 60) },
        body: JSON.stringify({ error: `Locked out. Try again in ${remaining} minute(s).` }),
      };
    }
  }

  // ── Attempt sign-in ─────────────────────────────────────────────────────
  const { session, error: authError } = await supabaseSignIn(email, password, captchaToken);

  if (session) {
    if (rec) await deleteRateRecord(ip);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session }),
    };
  }

  // ── Record failure ──────────────────────────────────────────────────────
  const count       = (rec?.fail_count ?? 0) + 1;
  const lockedUntil = count >= MAX_ATTEMPTS
    ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
    : null;

  await upsertRateRecord(ip, { fail_count: count, last_fail: now, locked_until: lockedUntil,
    ...(rec ? {} : { first_fail: now }) });

  if (count >= MAX_ATTEMPTS) {
    await sendAlert(
      `🔒 CIPGuard: IP ${ip} locked out after ${MAX_ATTEMPTS} failed attempts`,
      `IP ${ip} locked out of cipguard.netlify.app.\n\nAttempts: ${count}\nLocked until: ${lockedUntil}`
    );
  }

  // ── Multi-IP detection ──────────────────────────────────────────────────
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
  const multiRes    = await sbRest(`/auth_rate_limits?last_fail=gte.${windowStart}&select=ip,fail_count`);
  const recentIPs   = await multiRes.json();

  if (Array.isArray(recentIPs) && recentIPs.length >= MULTI_IP_THRESHOLD) {
    await sendAlert(
      `🚨 CIPGuard: Coordinated attack — ${recentIPs.length} distinct IPs`,
      `Multiple IPs failing within ${WINDOW_MINUTES} min:\n${recentIPs.map(r => `  ${r.ip} (${r.fail_count} attempts)`).join("\n")}`
    );
  }

  const remaining = MAX_ATTEMPTS - count;
  const msg = count >= MAX_ATTEMPTS
    ? `Too many failed attempts. Locked out for ${LOCKOUT_MINUTES} minutes.`
    : `Invalid credentials. ${remaining} attempt(s) remaining before lockout.`;

  return {
    statusCode: 401,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ error: msg }),
  };
};
