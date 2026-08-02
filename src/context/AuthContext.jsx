import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Hydrate the current session on first load
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    // Keep state in sync with sign-in / sign-out / token refresh
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => sub.subscription.unsubscribe()
  }, [])

  const isLocalDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    signIn: async (email, password, captchaToken) => {
      if (isLocalDev) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
          options: captchaToken ? { captchaToken } : undefined,
        })
        return { error }
      }
      // Route through rate-limited proxy — enforces lockout and breach alerts
      const res = await fetch("/.netlify/functions/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email, password, captchaToken }),
      });
      const data = await res.json();
      if (!res.ok) return { error: { message: data.error ?? "Sign-in failed." } };
      // Hydrate the Supabase client with the session returned by the proxy
      const { error } = await supabase.auth.setSession(data.session);
      return { error };
    },
    signUp: (email, password, fullName, captchaToken) =>
      supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName }, captchaToken },
      }),
    signOut: () => supabase.auth.signOut(),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
