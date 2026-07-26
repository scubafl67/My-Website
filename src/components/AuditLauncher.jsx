import { useState, useEffect, useRef, useCallback } from 'react'

const API          = 'http://127.0.0.1:3001'
const SB_URL       = 'https://ljifidyvcvylvonkufwd.supabase.co'
const SB_ANON_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqaWZpZHl2Y3Z5bHZvbmt1ZndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3Mzc5ODIsImV4cCI6MjA5NjMxMzk4Mn0.oEVPTowzEx9VIyAwCghSdvVVHuDAd16ZL4gHFlKIOiU'

const MODULES = [
  { value: 'all',      label: 'Full Baseline',  desc: 'All modules — CIP-010 + CIP-007' },
  { value: 'os',       label: 'OS Only',         desc: 'CIP-010 R1.1 — OS / kernel / security controls' },
  { value: 'ports',    label: 'Ports Only',      desc: 'CIP-007 R1 — TCP/UDP listeners' },
  { value: 'packages', label: 'Packages Only',   desc: 'CIP-010 R1.1 — Installed software' },
  { value: 'patches',  label: 'Patches Only',    desc: 'CIP-007 R2 — Security patch history' },
  { value: 'accounts', label: 'Accounts Only',   desc: 'CIP-010 R1.1 — Users and groups' },
]

const SECTION_TAGS = ['os', 'ports', 'packages', 'patches', 'accounts']

const STATUS_COLOR = {
  running:  '#00A8CC',
  complete: '#00C9A7',
  error:    '#F87171',
  stopped:  '#FBBF24',
  idle:     'rgba(255,255,255,0.35)',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseCSVLine(line) {
  const cols = []
  let cur = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { inQ = !inQ }
    else if (c === ',' && !inQ) { cols.push(cur); cur = '' }
    else cur += c
  }
  cols.push(cur)
  return cols
}

function csvToSections(csvContent) {
  const sections = {}
  const lines = csvContent.split('\n').filter(l => l.trim())
  lines.forEach(line => {
    const cols    = parseCSVLine(line)
    const section = cols[0]?.trim()
    if (!section) return
    if (!sections[section]) sections[section] = []
    sections[section].push(cols.slice(1).join('|'))
  })
  return sections
}

function compareSections(oldSections, newSections) {
  const allSections = new Set([...Object.keys(oldSections), ...Object.keys(newSections)])
  const result = {}
  allSections.forEach(sec => {
    const oldSet = new Set(oldSections[sec] || [])
    const newSet = new Set(newSections[sec] || [])
    const added   = [...newSet].filter(r => !oldSet.has(r))
    const removed = [...oldSet].filter(r => !newSet.has(r))
    result[sec] = { added, removed, unchanged: newSet.size - added.length }
  })
  return result
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionBadge({ tag, lines }) {
  const done   = lines.some(l => l.toLowerCase().includes(`collecting: ${tag}`)) &&
                 lines.some(l => l.toLowerCase().includes(`→ ${tag}_`))
  const active = lines.some(l => l.toLowerCase().includes(`collecting: ${tag}`))
  const color  = done ? '#00C9A7' : active ? '#00A8CC' : 'rgba(255,255,255,0.2)'
  const icon   = done ? '✓' : active ? '◉' : '○'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20,
      border: `1px solid ${color}`, color,
      fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase',
      letterSpacing: '0.05em', transition: 'all 0.3s',
    }}>
      {icon} {tag}
    </span>
  )
}

function ManifestTable({ lines }) {
  const rows = []
  const re   = /→\s+(\S+)\s+\((\d+)\s+(?:lines|rows)/
  lines.forEach(l => {
    const m = l.match(re)
    if (m) rows.push({ file: m[1], count: parseInt(m[2]) - 1 })
  })
  if (!rows.length) return null
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: '0.75rem', color: '#00A8CC', fontWeight: 700,
                    letterSpacing: '0.08em', marginBottom: 6 }}>MANIFEST</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
        <thead>
          <tr style={{ color: 'rgba(255,255,255,0.4)' }}>
            <th style={{ textAlign: 'left',  padding: '3px 8px', fontWeight: 500 }}>File</th>
            <th style={{ textAlign: 'right', padding: '3px 8px', fontWeight: 500 }}>Rows</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{
              background: i % 2 === 0 ? 'rgba(0,168,204,0.06)' : 'transparent',
              color: 'rgba(255,255,255,0.8)',
            }}>
              <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>{r.file}</td>
              <td style={{ padding: '4px 8px', textAlign: 'right',
                           color: r.count > 0 ? '#00C9A7' : '#F87171', fontWeight: 700 }}>
                {r.count}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CompareView({ runA, runB }) {
  if (!runA || !runB) return null
  const secA   = csvToSections(runA.csv_content || '')
  const secB   = csvToSections(runB.csv_content || '')
  const diff   = compareSections(secA, secB)
  const secs   = Object.keys(diff)
  const hasAny = secs.some(s => diff[s].added.length || diff[s].removed.length)

  const card = {
    background: 'linear-gradient(180deg, rgba(13,33,55,0.95), rgba(10,22,40,0.95))',
    border: '1px solid rgba(0,168,204,0.2)',
    borderRadius: 14, padding: '1.5rem', marginBottom: '1rem',
  }

  return (
    <div style={card}>
      <div style={{ fontSize: '0.75rem', color: '#00A8CC', fontWeight: 700,
                    letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
        Delta: NEW vs OLD
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
          OLD → {new Date(runA.created_at).toLocaleString()}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.2)' }}>→</span>
        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
          NEW → {new Date(runB.created_at).toLocaleString()}
        </span>
      </div>

      {!hasAny && (
        <div style={{ color: '#00C9A7', fontSize: '0.85rem', fontWeight: 600 }}>
          ✓ No changes detected between runs.
        </div>
      )}

      {secs.map(sec => {
        const { added, removed } = diff[sec]
        if (!added.length && !removed.length) return null
        return (
          <div key={sec} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff',
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                          marginBottom: 6 }}>
              {sec}
              <span style={{ marginLeft: 8, color: '#00C9A7', fontWeight: 500 }}>
                +{added.length}
              </span>
              <span style={{ marginLeft: 6, color: '#F87171', fontWeight: 500 }}>
                -{removed.length}
              </span>
            </div>

            {added.slice(0, 10).map((row, i) => (
              <div key={`a${i}`} style={{
                fontFamily: 'monospace', fontSize: '0.72rem',
                color: '#00C9A7', padding: '2px 8px',
                background: 'rgba(0,201,167,0.07)', borderRadius: 4, marginBottom: 2,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>+ {row}</div>
            ))}
            {added.length > 10 && (
              <div style={{ fontSize: '0.7rem', color: 'rgba(0,201,167,0.5)',
                            padding: '2px 8px' }}>
                … and {added.length - 10} more added
              </div>
            )}

            {removed.slice(0, 10).map((row, i) => (
              <div key={`r${i}`} style={{
                fontFamily: 'monospace', fontSize: '0.72rem',
                color: '#F87171', padding: '2px 8px',
                background: 'rgba(248,113,113,0.07)', borderRadius: 4, marginBottom: 2,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>- {row}</div>
            ))}
            {removed.length > 10 && (
              <div style={{ fontSize: '0.7rem', color: 'rgba(248,113,113,0.5)',
                            padding: '2px 8px' }}>
                … and {removed.length - 10} more removed
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AuditLauncher() {
  const [serverOk,    setServerOk]    = useState(null)
  const [serverInfo,  setServerInfo]  = useState(null)
  const [module,      setModule]      = useState('all')
  const [jobId,       setJobId]       = useState(null)
  const [status,      setStatus]      = useState('idle')
  const [lines,       setLines]       = useState([])
  const [outputDir,   setOutputDir]   = useState(null)
  const [outputs,     setOutputs]     = useState([])
  const [error,       setError]       = useState('')
  const [cloudRuns,   setCloudRuns]   = useState([])
  const [compareIdxA, setCompareIdxA] = useState(1)  // OLD (index 1 = second most recent)
  const [compareIdxB, setCompareIdxB] = useState(0)  // NEW (index 0 = most recent)
  const termRef = useRef(null)
  const esRef   = useRef(null)

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight
  }, [lines])

  const checkServer = useCallback(async () => {
    try {
      // Check Supabase heartbeat (works from live HTTPS page — no mixed-content issue)
      const r = await fetch(
        `${SB_URL}/rest/v1/server_heartbeat?select=host,hostname,platform,last_seen,script_ok&order=last_seen.desc&limit=1`,
        { headers: { 'apikey': SB_ANON_KEY, 'Authorization': `Bearer ${SB_ANON_KEY}` } }
      )
      if (r.ok) {
        const rows = await r.json()
        if (rows.length) {
          const hb      = rows[0]
          const ageSecs = (Date.now() - new Date(hb.last_seen).getTime()) / 1000
          const online  = ageSecs < 60
          setServerOk(online)
          setServerInfo(online ? { hostname: hb.hostname, platform: hb.platform, scriptExists: hb.script_ok } : null)
          return
        }
      }
      setServerOk(false)
      setServerInfo(null)
    } catch {
      setServerOk(false)
      setServerInfo(null)
    }
  }, [])

  const loadOutputs = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/audit/outputs`)
      const d = await r.json()
      setOutputs(d.outputs || [])
    } catch { /* server offline */ }
  }, [])

  const loadCloudRuns = useCallback(async () => {
    try {
      const r = await fetch(
        `${SB_URL}/rest/v1/audit_runs?select=id,host,module,status,row_counts,created_at,csv_content&order=created_at.desc&limit=20`,
        { headers: { 'apikey': SB_ANON_KEY, 'Authorization': `Bearer ${SB_ANON_KEY}` } }
      )
      if (r.ok) setCloudRuns(await r.json())
    } catch { /* supabase unreachable */ }
  }, [])

  useEffect(() => {
    checkServer()
    loadOutputs()
    loadCloudRuns()
    const t = setInterval(checkServer, 5000)
    return () => clearInterval(t)
  }, [checkServer, loadOutputs, loadCloudRuns])

  const streamJob = useCallback((id) => {
    if (esRef.current) esRef.current.close()
    const es = new EventSource(`${API}/api/audit/stream/${id}`)
    esRef.current = es
    es.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'end') {
        setStatus(msg.status)
        if (msg.outputDir) setOutputDir(msg.outputDir)
        es.close()
        loadOutputs()
        setTimeout(loadCloudRuns, 3000) // give server time to upload
        return
      }
      if (msg.text) setLines(prev => [...prev, ...msg.text.split('\n')])
    }
    es.onerror = () => {
      setStatus(prev => prev === 'running' ? 'error' : prev)
      es.close()
    }
  }, [loadOutputs, loadCloudRuns])

  const launch = async () => {
    setLines([]); setOutputDir(null); setError(''); setStatus('running')
    try {
      const r = await fetch(`${API}/api/audit/launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module }),
      })
      if (r.status === 409) {
        const d = await r.json(); setJobId(d.jobId); setStatus('running'); streamJob(d.jobId); return
      }
      if (!r.ok) {
        const d = await r.json(); setError(d.error || 'Failed to launch audit.'); setStatus('error'); return
      }
      const d = await r.json(); setJobId(d.jobId); streamJob(d.jobId)
    } catch {
      setError('Cannot reach audit server. Is it running?'); setStatus('idle')
    }
  }

  const stop = async () => {
    if (!jobId) return
    await fetch(`${API}/api/audit/stop/${jobId}`, { method: 'POST' }).catch(() => {})
    setStatus('stopped')
    if (esRef.current) esRef.current.close()
  }

  const reset = () => {
    setLines([]); setJobId(null); setStatus('idle'); setOutputDir(null); setError('')
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  const card = {
    background: 'linear-gradient(180deg, rgba(13,33,55,0.95), rgba(10,22,40,0.95))',
    border: '1px solid rgba(0,168,204,0.2)',
    borderRadius: 14, padding: '1.5rem',
  }
  const statusColor = STATUS_COLOR[status] || STATUS_COLOR.idle

  const runA = cloudRuns[compareIdxA] || null
  const runB = cloudRuns[compareIdxB] || null

  return (
    <section style={{ maxWidth: 900, margin: '0 auto', padding: '0 1rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem' }}>
        <div style={{
          width: 40, height: 40, borderRadius: 8,
          background: 'linear-gradient(135deg, #0077B6, #00C9A7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
               stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2"/>
            <path d="M8 21h8M12 17v4"/>
            <polyline points="6 8 10 12 6 16"/>
            <line x1="13" y1="12" x2="18" y2="12"/>
          </svg>
        </div>
        <div>
          <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700,
                       fontSize: '1.25rem', color: '#fff', margin: 0 }}>
            BES Cyber Asset Baseline Audit
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', margin: 0 }}>
            NERC CIP-010 R1 / CIP-007 R1 &amp; R2 — audit_master.sh v2.1.0
          </p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
            background: serverOk === null ? '#FBBF24' : serverOk ? '#00C9A7' : '#F87171',
            boxShadow: serverOk ? '0 0 6px #00C9A7' : 'none',
          }}/>
          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)' }}>
            {serverOk === null ? 'Checking…'
              : serverOk ? `Server ready · ${serverInfo?.hostname || ''}`
              : 'Server offline'}
          </span>
        </div>
      </div>

      {/* Server offline banner */}
      {serverOk === false && (
        <div style={{ ...card, border: '1px solid rgba(248,113,113,0.4)',
                      background: 'rgba(127,29,29,0.15)', marginBottom: '1rem' }}>
          <p style={{ margin: 0, color: '#FCA5A5', fontSize: '0.875rem', fontWeight: 600 }}>
            Audit server is not running.
          </p>
          <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>
            Open Terminal and run:
          </p>
          <code style={{
            display: 'block', marginTop: 8, padding: '8px 12px', borderRadius: 6,
            background: 'rgba(0,0,0,0.4)', color: '#00C9A7', fontSize: '0.8rem',
            fontFamily: 'monospace', whiteSpace: 'pre-wrap',
          }}>
            node ~/Desktop/FAU_EMBA/SUMMER\ 2026/ISM/CLAUDE/NERC_Trainer/cipguard-landing/audit-server/server.js
          </code>
        </div>
      )}

      {/* Controls */}
      <div style={{ ...card, marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 220px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem',
                            color: 'rgba(255,255,255,0.5)', marginBottom: 6,
                            fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Audit Scope
            </label>
            <select
              value={module} onChange={e => setModule(e.target.value)}
              disabled={status === 'running'}
              style={{
                width: '100%', padding: '0.6rem 0.875rem', borderRadius: 8,
                background: 'rgba(10,22,40,0.7)', border: '1px solid rgba(0,168,204,0.25)',
                color: '#fff', fontSize: '0.875rem', fontFamily: 'inherit', outline: 'none',
                cursor: status === 'running' ? 'not-allowed' : 'pointer',
              }}
            >
              {MODULES.map(m => (
                <option key={m.value} value={m.value}>{m.label} — {m.desc}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {status !== 'running' ? (
              <button
                onClick={status === 'idle' ? launch : reset}
                disabled={!serverOk}
                style={{
                  padding: '0.625rem 1.25rem', borderRadius: 8, fontWeight: 700,
                  fontSize: '0.875rem', border: 'none', cursor: serverOk ? 'pointer' : 'not-allowed',
                  background: status === 'idle'
                    ? 'linear-gradient(135deg, #0077B6, #00C9A7)'
                    : 'rgba(255,255,255,0.08)',
                  color: '#fff', opacity: serverOk ? 1 : 0.4, transition: 'opacity 0.2s',
                }}
              >
                {status === 'idle' ? '▶  Launch Audit' : '↺  New Audit'}
              </button>
            ) : (
              <button onClick={stop} style={{
                padding: '0.625rem 1.25rem', borderRadius: 8, fontWeight: 700,
                fontSize: '0.875rem', border: '1px solid rgba(248,113,113,0.5)',
                background: 'rgba(248,113,113,0.12)', color: '#FCA5A5', cursor: 'pointer',
              }}>
                ■  Stop
              </button>
            )}
          </div>
        </div>
        {(status === 'running' || status === 'complete') && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: '1rem' }}>
            {SECTION_TAGS.map(tag => (
              <SectionBadge key={tag} tag={tag} lines={lines} />
            ))}
          </div>
        )}
      </div>

      {/* Terminal output */}
      {(lines.length > 0 || error) && (
        <div style={{ ...card, marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: '0.75rem', color: statusColor,
                           fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {status === 'running'  && '⬤ Running'}
              {status === 'complete' && '✓ Complete — uploading to Supabase…'}
              {status === 'error'    && '✗ Error'}
              {status === 'stopped'  && '■ Stopped'}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>
              {lines.filter(l => l.trim()).length} lines
            </span>
          </div>
          {error && (
            <div style={{ padding: '8px 12px', borderRadius: 6, marginBottom: 8,
                          background: 'rgba(127,29,29,0.3)', border: '1px solid rgba(248,113,113,0.3)',
                          color: '#FCA5A5', fontSize: '0.8rem' }}>
              {error}
            </div>
          )}
          <div ref={termRef} style={{
            background: '#050C16', borderRadius: 8, padding: '12px 14px',
            fontFamily: '"SF Mono", "Fira Code", "Consolas", monospace',
            fontSize: '0.775rem', lineHeight: 1.65, color: 'rgba(255,255,255,0.82)',
            maxHeight: 380, overflowY: 'auto', border: '1px solid rgba(0,168,204,0.12)',
          }}>
            {lines.filter(l => l !== undefined).map((line, i) => {
              const isOk  = line.includes('[+]') || line.includes('✓')
              const isHdr = line.includes('[>]')
              const isWrn = line.includes('[!]')
              const isErr = line.includes('[ERROR]') || line.includes('✗')
              const color = isErr ? '#F87171' : isWrn ? '#FBBF24'
                          : isHdr ? '#00A8CC' : isOk ? '#00C9A7' : 'rgba(255,255,255,0.75)'
              return <div key={i} style={{ color, minHeight: '1em' }}>{line || ' '}</div>
            })}
            {status === 'running' && (
              <span style={{ color: '#00A8CC', animation: 'blink 1s step-end infinite' }}>▋</span>
            )}
          </div>
          {status === 'complete' && <ManifestTable lines={lines} />}
          {status === 'complete' && outputDir && (
            <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <a href={`${API}/api/audit/download/${outputDir.split('/').pop()}`} download
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '0.5rem 1rem', borderRadius: 8,
                  background: 'rgba(0,201,167,0.12)', border: '1px solid rgba(0,201,167,0.35)',
                  color: '#00C9A7', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none',
                }}>
                ↓ Download Consolidated CSV
              </a>
              <button onClick={() => window.dispatchEvent(new CustomEvent('cipguard:odin-launch', { detail: { outputDir } }))}
                style={{
                  padding: '0.5rem 1rem', borderRadius: 8, cursor: 'pointer',
                  background: 'rgba(0,119,182,0.15)', border: '1px solid rgba(0,119,182,0.4)',
                  color: '#60A5FA', fontSize: '0.8rem', fontWeight: 600,
                }}>
                ⚡ Run ODIN Linux
              </button>
            </div>
          )}
        </div>
      )}

      {/* Cloud Run History */}
      {cloudRuns.length > 0 && (
        <div style={{ ...card, marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#00A8CC', fontWeight: 700,
                        letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
            Cloud Audit History
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
            <thead>
              <tr style={{ color: 'rgba(255,255,255,0.35)', borderBottom: '1px solid rgba(0,168,204,0.1)' }}>
                <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 500 }}>#</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 500 }}>Host</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 500 }}>Date</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 500 }}>Module</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 500 }}>Rows</th>
                <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 500 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {cloudRuns.map((run, i) => {
                const total = run.row_counts
                  ? Object.values(run.row_counts).reduce((a, b) => a + b, 0)
                  : '—'
                return (
                  <tr key={run.id} style={{
                    background: i % 2 === 0 ? 'rgba(0,168,204,0.04)' : 'transparent',
                    color: 'rgba(255,255,255,0.75)',
                  }}>
                    <td style={{ padding: '5px 8px', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
                      {i === 0 ? '🟢 NEW' : i === 1 ? '🔵 OLD' : i + 1}
                    </td>
                    <td style={{ padding: '5px 8px', fontFamily: 'monospace' }}>{run.host}</td>
                    <td style={{ padding: '5px 8px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                      {new Date(run.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '5px 8px' }}>{run.module}</td>
                    <td style={{ padding: '5px 8px', color: '#00C9A7', fontWeight: 700 }}>{total}</td>
                    <td style={{ padding: '5px 8px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 10, fontSize: '0.7rem', fontWeight: 600,
                        background: run.status === 'complete' ? 'rgba(0,201,167,0.15)' : 'rgba(248,113,113,0.15)',
                        color: run.status === 'complete' ? '#00C9A7' : '#F87171',
                      }}>{run.status}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Compare selector */}
          {cloudRuns.length >= 2 && (
            <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                COMPARE:
              </span>
              <select value={compareIdxA} onChange={e => setCompareIdxA(Number(e.target.value))}
                style={{
                  padding: '0.4rem 0.7rem', borderRadius: 6, fontSize: '0.78rem',
                  background: 'rgba(10,22,40,0.8)', border: '1px solid rgba(0,168,204,0.25)',
                  color: '#fff', fontFamily: 'inherit',
                }}>
                {cloudRuns.map((r, i) => (
                  <option key={r.id} value={i}>
                    {i === 0 ? 'NEW' : i === 1 ? 'OLD' : `Run ${i + 1}`} — {new Date(r.created_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
              <span style={{ color: 'rgba(255,255,255,0.3)' }}>vs</span>
              <select value={compareIdxB} onChange={e => setCompareIdxB(Number(e.target.value))}
                style={{
                  padding: '0.4rem 0.7rem', borderRadius: 6, fontSize: '0.78rem',
                  background: 'rgba(10,22,40,0.8)', border: '1px solid rgba(0,168,204,0.25)',
                  color: '#fff', fontFamily: 'inherit',
                }}>
                {cloudRuns.map((r, i) => (
                  <option key={r.id} value={i}>
                    {i === 0 ? 'NEW' : i === 1 ? 'OLD' : `Run ${i + 1}`} — {new Date(r.created_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Delta comparison */}
      {cloudRuns.length >= 2 && compareIdxA !== compareIdxB && (
        <CompareView runA={cloudRuns[compareIdxA]} runB={cloudRuns[compareIdxB]} />
      )}

      {/* Local prior runs (server online only) */}
      {outputs.length > 0 && status === 'idle' && (
        <div style={card}>
          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', fontWeight: 700,
                        letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
            Local Output Files
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {outputs.slice(0, 5).map((o, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '7px 10px', borderRadius: 7,
                background: 'rgba(0,168,204,0.06)', border: '1px solid rgba(0,168,204,0.1)',
              }}>
                <span style={{ fontFamily: 'monospace', fontSize: '0.78rem',
                               color: 'rgba(255,255,255,0.5)' }}>{o.name}</span>
                <a href={`${API}/api/audit/download/${o.name}`} download
                  style={{ color: '#00A8CC', fontSize: '0.75rem', textDecoration: 'none', fontWeight: 600 }}>
                  ↓ CSV
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </section>
  )
}
