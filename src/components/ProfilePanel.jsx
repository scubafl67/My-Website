import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { NERC_REGIONS } from '../data/cipStandards'

const EMPTY = { full_name: '', organization: '', job_title: '', nerc_region: '', phone: '', bio: '' }

const TIER_LABEL = {
  general: { text: 'General access', color: 'var(--color-signal)', note: 'Current (mandatory) NERC CIP standards only.' },
  full: { text: 'Full access', color: 'var(--color-verify)', note: 'Entire NERC CIP catalog, including future standards.' },
  super_admin: { text: 'Super Admin', color: 'var(--color-warning)', note: 'Full catalog plus administration.' },
}

export default function ProfilePanel() {
  const { user } = useAuth()
  const [form, setForm] = useState(EMPTY)
  const [tier, setTier] = useState('general')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  // Recovery-secret state (never pre-filled — hashes are not readable by clients)
  const [secret1, setSecret1] = useState('')
  const [secret2, setSecret2] = useState('')
  const [savingSecrets, setSavingSecrets] = useState(false)
  const [secretStatus, setSecretStatus] = useState('')
  const [secretError, setSecretError] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, organization, job_title, nerc_region, phone, bio, access_level')
        .eq('id', user.id)
        .maybeSingle()
      if (!active) return
      if (error) setError(error.message)
      else if (data) {
        const { access_level, ...rest } = data
        setTier(access_level || 'general')
        setForm({ ...EMPTY, ...Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, v ?? ''])) })
      }
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [user.id])

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setStatus('')
    setError('')
    // upsert so it works whether or not the signup trigger already created the row.
    // access_level is intentionally omitted — users cannot self-elevate their tier.
    const payload = {
      id: user.id,
      full_name: form.full_name || null,
      organization: form.organization || null,
      job_title: form.job_title || null,
      nerc_region: form.nerc_region || null,
      phone: form.phone || null,
      bio: form.bio || null,
    }
    const { error } = await supabase.from('profiles').upsert(payload)
    if (error) setError(error.message)
    else setStatus('Profile saved.')
    setSaving(false)
  }

  const handleSaveSecrets = async (e) => {
    e.preventDefault()
    setSecretStatus('')
    setSecretError('')
    if (secret1.trim().length < 4 || secret2.trim().length < 4) {
      setSecretError('Each secret must be at least 4 characters.')
      return
    }
    if (secret1.trim() === secret2.trim()) {
      setSecretError('Your two secrets must be different.')
      return
    }
    setSavingSecrets(true)
    // Plaintext goes over HTTPS to a SECURITY DEFINER function that bcrypt-hashes
    // it server-side; the hash is never returned to or readable by the browser.
    const { error } = await supabase.rpc('set_recovery_secrets', {
      p_secret_1: secret1.trim(),
      p_secret_2: secret2.trim(),
    })
    if (error) setSecretError(error.message)
    else {
      setSecretStatus('Recovery secrets saved. Keep them somewhere safe — you will need both to reset your password.')
      setSecret1('')
      setSecret2('')
    }
    setSavingSecrets(false)
  }

  const field = {
    width: '100%', padding: '0.625rem 0.75rem', borderRadius: 8,
    background: 'rgba(10,22,40,0.6)', border: '1px solid rgba(0,168,204,0.25)',
    color: '#fff', fontSize: '0.875rem', outline: 'none', fontFamily: 'inherit',
  }
  const label = { display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.65)', marginBottom: '0.375rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }

  if (loading) return <div style={{ color: 'rgba(255,255,255,0.5)', padding: '1rem' }}>Loading profile…</div>

  const tierMeta = TIER_LABEL[tier] || TIER_LABEL.general

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Profile details */}
      <div style={{ background: 'rgba(13,33,55,0.8)', border: '1px solid rgba(0,168,204,0.15)', borderRadius: 12, padding: '1.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '1.125rem', color: '#fff', margin: '0 0 0.25rem' }}>Your Profile</h3>
            <p style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.5)', margin: 0 }}>Signed in as {user.email}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: tierMeta.color, background: `${tierMeta.color}1a`, border: `1px solid ${tierMeta.color}44`, borderRadius: 100, padding: '0.25rem 0.75rem' }}>
              {tierMeta.text}
            </span>
            <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', margin: '0.375rem 0 0', maxWidth: 220 }}>{tierMeta.note}</p>
          </div>
        </div>

        <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={label}>Full name</label>
            <input type="text" value={form.full_name} onChange={update('full_name')} style={field} />
          </div>
          <div>
            <label style={label}>Organization</label>
            <input type="text" value={form.organization} onChange={update('organization')} style={field} placeholder="Utility / Co-op / ISO" />
          </div>
          <div>
            <label style={label}>Job title</label>
            <input type="text" value={form.job_title} onChange={update('job_title')} style={field} placeholder="CIP Compliance Analyst" />
          </div>
          <div>
            <label style={label}>NERC region</label>
            <select value={form.nerc_region} onChange={update('nerc_region')} style={field}>
              <option value="">— Select —</option>
              {NERC_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label style={label}>Phone</label>
            <input type="tel" value={form.phone} onChange={update('phone')} style={field} placeholder="(555) 555-0100" />
          </div>
          <div />
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={label}>Bio</label>
            <textarea value={form.bio} onChange={update('bio')} rows={3} style={{ ...field, resize: 'vertical' }} placeholder="Your CIP focus areas, certifications, experience…" />
          </div>

          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.25rem' }}>
            <button type="submit" disabled={saving} className="cta-btn" style={{ padding: '0.625rem 1.5rem', borderRadius: 8, fontSize: '0.875rem', fontWeight: 700, border: 'none', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Saving…' : 'Save Profile'}
            </button>
            {status && <span style={{ fontSize: '0.8125rem', color: 'var(--color-verify)' }}>{status}</span>}
            {error && <span style={{ fontSize: '0.8125rem', color: '#F6A6A6' }}>{error}</span>}
          </div>
        </form>
      </div>

      {/* Recovery secrets */}
      <div style={{ background: 'rgba(13,33,55,0.8)', border: '1px solid rgba(0,168,204,0.15)', borderRadius: 12, padding: '1.75rem' }}>
        <h3 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '1.125rem', color: '#fff', margin: '0 0 0.25rem' }}>Account Recovery Secrets</h3>
        <p style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.5)', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
          Set two secrets. If you ever forget your password, you'll need <strong>both</strong> to reset it. They're stored encrypted (bcrypt) and never shown again.
        </p>
        <form onSubmit={handleSaveSecrets} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={label}>Secret #1</label>
            <input type="password" value={secret1} onChange={(e) => setSecret1(e.target.value)} style={field} placeholder="e.g. first pet's name" autoComplete="off" />
          </div>
          <div>
            <label style={label}>Secret #2</label>
            <input type="password" value={secret2} onChange={(e) => setSecret2(e.target.value)} style={field} placeholder="e.g. childhood street" autoComplete="off" />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.25rem' }}>
            <button type="submit" disabled={savingSecrets} className="secondary-btn" style={{ padding: '0.625rem 1.5rem', borderRadius: 8, fontSize: '0.875rem', fontWeight: 700, cursor: savingSecrets ? 'wait' : 'pointer', opacity: savingSecrets ? 0.7 : 1 }}>
              {savingSecrets ? 'Saving…' : 'Save Recovery Secrets'}
            </button>
            {secretStatus && <span style={{ fontSize: '0.8125rem', color: 'var(--color-verify)' }}>{secretStatus}</span>}
            {secretError && <span style={{ fontSize: '0.8125rem', color: '#F6A6A6' }}>{secretError}</span>}
          </div>
        </form>
      </div>
    </div>
  )
}
