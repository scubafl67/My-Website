// Rate-limited Supabase login proxy
// Enforces attempt limits, lockout, and email alerts before credentials reach Supabase.

const { createClient } = require("@supabase/supabase-js");

const MAX_ATTEMPTS       = 3;
const LOCKOUT_MINUTES    = 30;
const WINDOW_MINUTES     = 2;
const MULTI_IP_THRESHOLD = 3;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function sendAlert(subject, body) {
  const apiKey = process.env.RESEND_API_KEY;
  const to     = process.env.CIPGUARD_ALERT_EMAIL;
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

  // ── Check existing lockout ──────────────────────────────────────────────
  const { data: recs } = await supabase
    .from("auth_rate_limits")
    .select("*")
    .eq("ip", ip)
    .limit(1);

  const rec = recs?.[0] ?? null;

  if (rec?.locked_until && new Date(rec.locked_until) > new Date()) {
    // Allow unlock via secondary secret
    const { data: hashData } = await supabase.rpc("sha256_hex", { input: password }).single().catch(() => ({ data: null }));
    const unlockHash = process.env.CIPGUARD_UNLOCK_HASH ?? "";
    const incomingHash = require("crypto").createHash("sha256").update(password).digest("hex");

    if (email === process.env.CIPGUARD_USER && incomingHash === unlockHash) {
      await supabase.from("auth_rate_limits").delete().eq("ip", ip);
      // Fall through to normal sign-in below
    } else {
      const remaining = Math.ceil((new Date(rec.locked_until) - Date.now()) / 60000);
      return {
        statusCode: 429,
        headers: { "Content-Type": "application/json", "Retry-After": String(remaining * 60) },
        body: JSON.stringify({ error: `Locked out. Try again in ${remaining} minute(s).` }),
      };
    }
  }

  // ── Attempt Supabase sign-in ────────────────────────────────────────────
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
    options: captchaToken ? { captchaToken } : undefined,
  });

  if (!authError) {
    // Success — clear any failure record
    if (rec) await supabase.from("auth_rate_limits").delete().eq("ip", ip);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session: authData.session }),
    };
  }

  // ── Record failure ──────────────────────────────────────────────────────
  const count       = (rec?.fail_count ?? 0) + 1;
  const lockedUntil = count >= MAX_ATTEMPTS
    ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString()
    : null;

  if (rec) {
    await supabase.from("auth_rate_limits")
      .update({ fail_count: count, last_fail: now, locked_until: lockedUntil })
      .eq("ip", ip);
  } else {
    await supabase.from("auth_rate_limits")
      .insert({ ip, fail_count: count, first_fail: now, last_fail: now, locked_until: lockedUntil });
  }

  // ── Lockout alert ───────────────────────────────────────────────────────
  if (count >= MAX_ATTEMPTS) {
    await sendAlert(
      `🔒 CIPGuard: IP ${ip} locked out after ${MAX_ATTEMPTS} failed attempts`,
      `IP ${ip} has been locked out of cipguard.netlify.app.\n\nFailed attempts : ${count}\nLocked until    : ${lockedUntil}\n\nReview Netlify logs if unexpected.`
    );
  }

  // ── Multi-IP coordinated detection ─────────────────────────────────────
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString();
  const { data: recentIPs } = await supabase
    .from("auth_rate_limits")
    .select("ip, fail_count")
    .gte("last_fail", windowStart);

  if (recentIPs?.length >= MULTI_IP_THRESHOLD) {
    await sendAlert(
      `🚨 CIPGuard: Coordinated login attack — ${recentIPs.length} distinct IPs`,
      `Multiple IPs failing authentication within ${WINDOW_MINUTES} minutes.\n\n${recentIPs.map(r => `  ${r.ip}  (${r.fail_count} attempts)`).join("\n")}\n\nConsider enabling IP blocking in your Netlify dashboard.`
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
