import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { CIP_STATUS } from '../data/cipStandards'

const STATUS_META = {
  [CIP_STATUS.MANDATORY]: { color: 'var(--color-verify)', label: 'Mandatory' },
  [CIP_STATUS.NEAR_TERM]: { color: 'var(--color-warning)', label: 'Within 12 mo' },
  [CIP_STATUS.FUTURE]: { color: 'var(--color-signal)', label: 'Future' },
}

const FILTERS = ['All', CIP_STATUS.MANDATORY, CIP_STATUS.NEAR_TERM, CIP_STATUS.FUTURE]

export default function CIPStandards() {
  const [standards, setStandards] = useState([])
  const [tier, setTier] = useState('general')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')

  // Pull the catalog from Supabase. RLS serves general users only the current
  // (mandatory) standards; full/super_admin users get the entire catalog.
  useEffect(() => {
    let active = true
    async function load() {
      const [{ data, error }, { data: prof }] = await Promise.all([
        supabase
          .from('cip_standards')
          .select('id, title, description, effective_date, inactive_date, requirements, status, note')
          .order('sort_order', { ascending: true }),
        supabase.from('profiles').select('access_level').maybeSingle(),
      ])
      if (!active) return
      if (error) setLoadError(error.message)
      else setStandards(data ?? [])
      if (prof?.access_level) setTier(prof.access_level)
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [])

  const results = useMemo(() => {
    const q = search.trim().toLowerCase()
    return standards.filter((s) => {
      if (filter !== 'All' && s.status !== filter) return false
      if (!q) return true
      return (
        s.id.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q)
      )
    })
  }, [standards, search, filter])

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <div>
          <span style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-signal)' }}>NERC CIP Connector · via Supabase</span>
          <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '1.5rem', color: '#fff', margin: '0.25rem 0 0' }}>
            CIP Reliability Standards
          </h2>
        </div>
        {!loading && !loadError && (
          <span style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.45)' }}>{standards.length} standards in catalog</span>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', margin: '1.25rem 0 1.5rem' }}>
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by ID, title, or keyword…"
          style={{ flex: '1 1 260px', padding: '0.625rem 0.875rem', borderRadius: 8, background: 'rgba(10,22,40,0.6)', border: '1px solid rgba(0,168,204,0.25)', color: '#fff', fontSize: '0.875rem', outline: 'none', fontFamily: 'inherit' }}
        />
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
          {FILTERS.map((f) => {
            const active = filter === f
            const labelText = f === 'All' ? 'All' : STATUS_META[f].label
            return (
              <button
                key={f} onClick={() => setFilter(f)}
                style={{
                  padding: '0.5rem 0.875rem', borderRadius: 8, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
                  background: active ? 'rgba(0,168,204,0.18)' : 'rgba(10,22,40,0.5)',
                  border: `1px solid ${active ? 'rgba(0,168,204,0.5)' : 'rgba(0,168,204,0.15)'}`,
                  color: active ? '#fff' : 'rgba(255,255,255,0.6)',
                }}
              >{labelText}</button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', padding: '3rem 0' }}>Loading CIP standards…</div>
      ) : loadError ? (
        <div style={{ color: '#F6A6A6', background: 'rgba(229,62,62,0.12)', border: '1px solid rgba(229,62,62,0.3)', borderRadius: 10, padding: '1rem' }}>
          Could not load standards: {loadError}
        </div>
      ) : (
        <>
          {tier === 'general' && (
            <div style={{ background: 'rgba(0,168,204,0.1)', border: '1px solid rgba(0,168,204,0.3)', borderRadius: 10, padding: '0.875rem 1.125rem', marginBottom: '1.25rem', fontSize: '0.8125rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--color-signal)' }}>General access</strong> — you're viewing the <strong>currently mandatory</strong> NERC CIP standards. Near-term and future standards require full access; contact your administrator to upgrade.
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
            {results.map((s) => {
              const meta = STATUS_META[s.status] || { color: 'var(--color-signal)', label: s.status }
              return (
                <div key={s.id} style={{ background: 'rgba(13,33,55,0.8)', border: '1px solid rgba(0,168,204,0.15)', borderRadius: 12, padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem', gap: '0.5rem' }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-clear)' }}>{s.id}</span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: meta.color, background: `${meta.color}1a`, border: `1px solid ${meta.color}40`, borderRadius: 100, padding: '0.2rem 0.55rem', whiteSpace: 'nowrap' }}>{meta.label}</span>
                  </div>
                  <h3 style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#fff', margin: '0 0 0.5rem' }}>{s.title}</h3>
                  <p style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.55, margin: '0 0 1rem', flex: 1 }}>{s.description}</p>
                  {s.note && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-warning)', fontStyle: 'italic', margin: '0 0 0.75rem' }}>{s.note}</p>
                  )}
                  <div style={{ borderTop: '1px solid rgba(0,168,204,0.12)', paddingTop: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.375rem 1rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                    <span>📅 Effective {s.effective_date}</span>
                    {s.inactive_date && <span>⏳ Inactive {s.inactive_date}</span>}
                    <span style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      {(s.requirements || []).map((r) => (
                        <span key={r} style={{ fontFamily: 'JetBrains Mono, monospace', background: 'rgba(0,168,204,0.1)', borderRadius: 4, padding: '0.05rem 0.35rem', color: 'rgba(255,255,255,0.7)' }}>{r}</span>
                      ))}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          {results.length === 0 && (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', padding: '3rem 0' }}>No standards match your search.</div>
          )}
        </>
      )}
    </div>
  )
}
