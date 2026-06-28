import { createClient } from '@supabase/supabase-js'

// Publishable / anon keys are designed to be exposed in the browser bundle.
// Env-first so deployments can rotate them; literal fallbacks keep local dev
// and preview builds working without extra wiring.
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://ljifidyvcvylvonkufwd.supabase.co'

const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_IFvRhmvdsbhltnAdE2yR4g_2h35H_CM'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
