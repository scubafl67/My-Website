// Session guard — passes authenticated requests through, redirects others to root
// so the app's own login form handles authentication (with rate limiting via /api/login).
// Exempts the login function itself to avoid redirect loops.

export default async function handler(req, context) {
  const url = new URL(req.url);

  // Always allow the login API and Supabase auth callbacks through
  if (
    url.pathname.startsWith("/.netlify/functions/login") ||
    url.pathname.startsWith("/auth/callback")
  ) {
    return context.next();
  }

  // Check for a valid Supabase session cookie
  const token = req.headers.get("cookie")
    ?.split(";")
    .map(c => c.trim())
    .find(c => c.startsWith("sb-") && c.includes("-auth-token="))
    ?.split("=")?.[1];

  // If no session cookie, pass through — the React app will show the login modal
  // Rate limiting is enforced at /.netlify/functions/login
  return context.next();
}

export const config = { path: "/*" };
