import { useRef, useState } from 'react'
import { Turnstile } from '@marsidev/react-turnstile'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

// Cloudflare Turnstile site key (public). Defaults to Cloudflare's always-pass
// TEST key so dev works out of the box; set VITE_TURNSTILE_SITE_KEY for production.
const TURNSTILE_SITE_KEY =
  import.meta.env.VITE_TURNSTILE_SITE_KEY || '0x4AAAAAADs4Dl2e3QRsssGc'

// Auth modal with three modes: sign in, sign up, and two-secret password reset.
// Gates all NERC CIP content behind a CIPGuard account.
export default function AuthModal({ open, onClose, initialMode = 'signin' }) {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState(initialMode)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  // Reset-mode fields
  const [secret1, setSecret1] = useState('')
  const [secret2, setSecret2] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  // Cloudflare Turnstile bot-check token (required for sign in / sign up)
  const [captchaToken, setCaptchaToken] = useState('')
  const turnstileRef = useRef(null)

  // App mounts this component fresh on each open (see App.jsx), so `mode` is
  // correctly initialized from `initialMode` without an effect.
  if (!open) return null

  // A token is single-use; after any auth attempt force a fresh challenge.
  const resetCaptcha = () => {
    setCaptchaToken('')
    turnstileRef.current?.reset()
  }

  const captchaRequired = mode === 'signin' || mode === 'signup'

  const clearMsgs = () => {
    setError('')
    setNotice('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    clearMsgs()
    setBusy(true)
    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password, captchaToken)
        if (error) throw error
        onClose()
      } else if (mode === 'signup') {
        const { data, error } = await signUp(email, password, fullName, captchaToken)
        if (error) throw error
        if (data.session) {
          onClose()
        } else {
          setNotice('Account created. Check your email to confirm your address, then sign in.')
          setMode('signin')
        }
      } else if (mode === 'reset') {
        // Two-secret password recovery via the reset-password edge function
        const { data, error } = await supabase.functions.invoke('reset-password', {
          body: { email, secret1, secret2, newPassword },
        })
        if (error) {
          // Edge function returns a JSON { error } body on non-2xx
          let msg = 'The information provided did not match our records.'
          try {
            const ctx = await error.context?.json?.()
            if (ctx?.error) msg = ctx.error
          } catch { /* keep generic */ }
          throw new Error(msg)
        }
        if (data?.success) {
          setNotice('Password reset. You can now sign in with your new password.')
          setSecret1(''); setSecret2(''); setNewPassword(''); setPassword('')
          setMode('signin')
        } else {
          throw new Error('The information provided did not match our records.')
        }
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
      if (captchaRequired) resetCaptcha()
    }
  }

  const switchMode = (m) => {
    clearMsgs()
    setMode(m)
  }

  const inputStyle = {
    width: '100%', padding: '0.75rem 0.875rem', borderRadius: 8,
    background: 'rgba(10,22,40,0.6)', border: '1px solid rgba(0,168,204,0.25)',
    color: '#fff', fontSize: '0.9375rem', fontFamily: 'inherit', outline: 'none',
  }
  const labelStyle = { display: 'block', fontSize: '0.8125rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.375rem', fontWeight: 500 }

  const titles = {
    signin: 'Sign in to your account',
    signup: 'Create your account',
    reset: 'Reset your password',
  }
  const subtitles = {
    signin: 'Access to the NERC CIP standards library requires a CIPGuard account.',
    signup: 'New accounts get general access to current NERC CIP standards.',
    reset: 'Enter your email, both recovery secrets, and a new password.',
  }
  const ctaLabel = { signin: 'Sign In', signup: 'Create Account', reset: 'Reset Password' }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(5,12,22,0.78)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 420, background: 'linear-gradient(180deg, rgba(13,33,55,0.98), rgba(10,22,40,0.98))', border: '1px solid rgba(0,168,204,0.25)', borderRadius: 16, padding: '2rem', position: 'relative', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}
      >
        <button onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: '1.25rem', cursor: 'pointer', lineHeight: 1 }}>×</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '1.25rem' }}>
          <div style={{ width: 32, height: 32, borderRadius: 6, background: 'linear-gradient(135deg, #0077B6, #00C9A7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '1.125rem', color: '#fff' }}>CIPGuard™</span>
        </div>

        <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '1.375rem', color: '#fff', margin: '0 0 0.375rem' }}>{titles[mode]}</h2>
        <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.55)', margin: '0 0 1.5rem' }}>{subtitles[mode]}</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {mode === 'signup' && (
            <div>
              <label style={labelStyle}>Full name</label>
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Analyst" style={inputStyle} autoComplete="name" />
            </div>
          )}

          <div>
            <label style={labelStyle}>Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@utility.com" style={inputStyle} autoComplete="email" />
          </div>

          {(mode === 'signin' || mode === 'signup') && (
            <div>
              <label style={labelStyle}>Password</label>
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" style={inputStyle} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />
            </div>
          )}

          {mode === 'reset' && (
            <>
              <div>
                <label style={labelStyle}>Recovery secret #1</label>
                <input type="password" required value={secret1} onChange={(e) => setSecret1(e.target.value)} style={inputStyle} autoComplete="off" />
              </div>
              <div>
                <label style={labelStyle}>Recovery secret #2</label>
                <input type="password" required value={secret2} onChange={(e) => setSecret2(e.target.value)} style={inputStyle} autoComplete="off" />
              </div>
              <div>
                <label style={labelStyle}>New password</label>
                <input type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" style={inputStyle} autoComplete="new-password" />
              </div>
            </>
          )}

          {error && <div style={{ fontSize: '0.8125rem', color: '#F6A6A6', background: 'rgba(229,62,62,0.12)', border: '1px solid rgba(229,62,62,0.3)', borderRadius: 8, padding: '0.625rem 0.75rem' }}>{error}</div>}
          {notice && <div style={{ fontSize: '0.8125rem', color: 'var(--color-verify)', background: 'rgba(0,201,167,0.1)', border: '1px solid rgba(0,201,167,0.3)', borderRadius: 8, padding: '0.625rem 0.75rem' }}>{notice}</div>}

          {captchaRequired && (
            <div style={{ marginTop: '0.25rem' }}>
              <Turnstile
                ref={turnstileRef}
                siteKey={TURNSTILE_SITE_KEY}
                options={{ theme: 'dark', size: 'flexible' }}
                onSuccess={setCaptchaToken}
                onError={() => setCaptchaToken('')}
                onExpire={() => setCaptchaToken('')}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={busy || (captchaRequired && !captchaToken)}
            className="cta-btn"
            style={{ padding: '0.8125rem', borderRadius: 8, fontSize: '0.9375rem', fontWeight: 700, border: 'none', cursor: busy ? 'wait' : 'pointer', opacity: busy || (captchaRequired && !captchaToken) ? 0.6 : 1, marginTop: '0.25rem' }}
          >
            {busy ? 'Please wait…' : ctaLabel[mode]}
          </button>
        </form>

        {/* Forgot-password link (sign-in only) */}
        {mode === 'signin' && (
          <p style={{ textAlign: 'center', marginTop: '1rem', marginBottom: 0 }}>
            <button onClick={() => switchMode('reset')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '0.8125rem' }}>Forgot your password?</button>
          </p>
        )}

        <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.55)', textAlign: 'center', marginTop: '0.75rem', marginBottom: 0 }}>
          {mode === 'signin' && (
            <>Don't have an account?{' '}
              <button onClick={() => switchMode('signup')} style={{ background: 'none', border: 'none', color: 'var(--color-signal)', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>Sign up</button>
            </>
          )}
          {mode === 'signup' && (
            <>Already have an account?{' '}
              <button onClick={() => switchMode('signin')} style={{ background: 'none', border: 'none', color: 'var(--color-signal)', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>Sign in</button>
            </>
          )}
          {mode === 'reset' && (
            <>Remembered it?{' '}
              <button onClick={() => switchMode('signin')} style={{ background: 'none', border: 'none', color: 'var(--color-signal)', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}>Back to sign in</button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
