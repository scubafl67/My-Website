import { useState, useEffect, useRef, useCallback } from 'react'

const SB_URL      = 'https://ljifidyvcvylvonkufwd.supabase.co'
const SB_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqaWZpZHl2Y3Z5bHZvbmt1ZndkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3Mzc5ODIsImV4cCI6MjA5NjMxMzk4Mn0.oEVPTowzEx9VIyAwCghSdvVVHuDAd16ZL4gHFlKIOiU'

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

// ── Supabase fetch helper ─────────────────────────────────────────────────────

async function sbGet(path) {
  const res = await fetch(`${SB_URL}/rest/v1${path}`, {
    headers: { 'apikey': SB_ANON_KEY, 'Authorization': `Bearer ${SB_ANON_KEY}` },
  })
  return res.ok ? res.json() : []
}

async function sbPost(path, body) {
  const res = await fetch(`${SB_URL}/rest/v1${path}`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SB_ANON_KEY,
      'Authorization': `Bearer ${SB_ANON_KEY}`,
      'Prefer':        'return=representation',
    },
    body: JSON.stringify(body),
  })
  return res.ok ? res.json() : null
}

async function sbPatch(path, body) {
  await fetch(`${SB_URL}/rest/v1${path}`, {
    method:  'PATCH',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SB_ANON_KEY,
      'Authorization': `Bearer ${SB_ANON_KEY}`,
      'Prefer':        'return=minimal',
    },
    body: JSON.stringify(body),
  })
}

// ── CSV helpers ───────────────────────────────────────────────────────────────

function parseCSVLine(line) {
  const cols = []; let cur = '', inQ = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') inQ = !inQ
    else if (c === ',' && !inQ) { cols.push(cur); cur = '' }
    else cur += c
  }
  cols.push(cur); return cols
}

function csvToSections(csv) {
  const sections = {}
  csv.split('\n').filter(l => l.trim()).forEach(line => {
    const cols = parseCSVLine(line)
    const sec  = cols[0]?.trim()
    if (!sec) return
    if (!sections[sec]) sections[sec] = []
    sections[sec].push(cols.slice(1).join('|'))
  })
  return sections
}

function compareSections(oldS, newS) {
  const all = new Set([...Object.keys(oldS), ...Object.keys(newS)])
  const result = {}
  all.forEach(sec => {
    const os = new Set(oldS[sec] || []), ns = new Set(newS[sec] || [])
    result[sec] = {
      added:   [...ns].filter(r => !os.has(r)),
      removed: [...os].filter(r => !ns.has(r)),
    }
  })
  return result
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionBadge({ tag, lines }) {
  const done   = lines.some(l => l.toLowerCase().includes(`collecting: ${tag}`)) &&
                 lines.some(l => l.toLowerCase().includes(`→ ${tag}_`))
  const active = lines.some(l => l.toLowerCase().includes(`collecting: ${tag}`))
  const color  = done ? '#00C9A7' : active ? '#00A8CC' : 'rgba(255,255,255,0.2)'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20,
      border: `1px solid ${color}`, color,
      fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase',
      letterSpacing: '0.05em', transition: 'all 0.3s',
    }}>
      {done ? '✓' : active ? '◉' : '○'} {tag}
    </span>
  )
}

function ManifestTable({ lines }) {
  const rows = []
  lines.forEach(l => {
    const m = l.match(/→\s+(\S+)\s+\((\d+)\s+(?:lines|rows)/)
    if (m) rows.push({ file: m[1], count: parseInt(m[2]) - 1 })
  })
  if (!rows.length) return null
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: '0.75rem', color: '#00A8CC', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 6 }}>MANIFEST</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
        <thead>
          <tr style={{ color: 'rgba(255,255,255,0.4)' }}>
            <th style={{ textAlign: 'left',  padding: '3px 8px', fontWeight: 500 }}>File</th>
            <th style={{ textAlign: 'right', padding: '3px 8px', fontWeight: 500 }}>Rows</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(0,168,204,0.06)' : 'transparent', color: 'rgba(255,255,255,0.8)' }}>
              <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>{r.file}</td>
              <td style={{ padding: '4px 8px', textAlign: 'right', color: r.count > 0 ? '#00C9A7' : '#F87171', fontWeight: 700 }}>{r.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CompareView({ runA, runB }) {
  if (!runA || !runB) return null
  const diff   = compareSections(csvToSections(runA.csv_content || ''), csvToSections(runB.csv_content || ''))
  const secs   = Object.keys(diff)
  const hasAny = secs.some(s => diff[s].added.length || diff[s].removed.length)
  const card   = { background: 'linear-gradient(180deg,rgba(13,33,55,0.95),rgba(10,22,40,0.95))', border: '1px solid rgba(0,168,204,0.2)', borderRadius: 14, padding: '1.5rem', marginBottom: '1rem' }
  return (
    <div style={card}>
      <div style={{ fontSize: '0.75rem', color: '#00A8CC', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Delta: NEW vs OLD</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>OLD → {new Date(runA.created_at).toLocaleString()}</span>
        <span style={{ color: 'rgba(255,255,255,0.2)' }}>→</span>
        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>NEW → {new Date(runB.created_at).toLocaleString()}</span>
      </div>
      {!hasAny && <div style={{ color: '#00C9A7', fontSize: '0.85rem', fontWeight: 600 }}>✓ No changes detected between runs.</div>}
      {secs.map(sec => {
        const { added, removed } = diff[sec]
        if (!added.length && !removed.length) return null
        return (
          <div key={sec} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              {sec} <span style={{ color: '#00C9A7' }}>+{added.length}</span> <span style={{ color: '#F87171' }}>-{removed.length}</span>
            </div>
            {added.slice(0, 10).map((r, i) => (
              <div key={`a${i}`} style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#00C9A7', padding: '2px 8px', background: 'rgba(0,201,167,0.07)', borderRadius: 4, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>+ {r}</div>
            ))}
            {added.length > 10 && <div style={{ fontSize: '0.7rem', color: 'rgba(0,201,167,0.5)', padding: '2px 8px' }}>… and {added.length - 10} more added</div>}
            {removed.slice(0, 10).map((r, i) => (
              <div key={`r${i}`} style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#F87171', padding: '2px 8px', background: 'rgba(248,113,113,0.07)', borderRadius: 4, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>- {r}</div>
            ))}
            {removed.length > 10 && <div style={{ fontSize: '0.7rem', color: 'rgba(248,113,113,0.5)', padding: '2px 8px' }}>… and {removed.length - 10} more removed</div>}
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
  const [linesCursor, setLinesCursor] = useState(0)
  const [cloudRuns,   setCloudRuns]   = useState([])
  const [compareIdxA, setCompareIdxA] = useState(1)
  const [compareIdxB, setCompareIdxB] = useState(0)
  const [error,       setError]       = useState('')
  const termRef    = useRef(null)
  const pollRef    = useRef(null)

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight
  }, [lines])

  // Server heartbeat check
  const checkServer = useCallback(async () => {
    try {
      const rows = await sbGet('/server_heartbeat?select=host,hostname,platform,last_seen,script_ok&order=last_seen.desc&limit=1')
      if (rows.length) {
        const hb      = rows[0]
        const ageSecs = (Date.now() - new Date(hb.last_seen).getTime()) / 1000
        const online  = ageSecs < 60
        setServerOk(online)
        setServerInfo(online ? { hostname: hb.hostname, platform: hb.platform } : null)
        return
      }
      setServerOk(false); setServerInfo(null)
    } catch { setServerOk(false); setServerInfo(null) }
  }, [])

  // Cloud run history
  const loadCloudRuns = useCallback(async () => {
    const rows = await sbGet('/audit_runs?select=id,host,module,status,row_counts,created_at,csv_content&order=created_at.desc&limit=20')
    setCloudRuns(rows)
  }, [])

  // Poll active job status + lines
  const pollJob = useCallback(async (id, cursor) => {
    const [jobs, newLines] = await Promise.all([
      sbGet(`/audit_jobs?id=eq.${id}&select=id,status,output_dir,run_id`),
      sbGet(`/audit_job_lines?job_id=eq.${id}&id=gt.${cursor}&select=id,line,line_type&order=id.asc&limit=100`),
    ])

    if (newLines.length) {
      const maxId = newLines[newLines.length - 1].id
      setLinesCursor(maxId)
      setLines(prev => [...prev, ...newLines.map(l => ({ text: l.line, type: l.line_type }))])
    }

    const job = jobs[0]
    if (job && job.status !== 'running' && job.status !== 'pending') {
      setStatus(job.status)
      clearInterval(pollRef.current)
      pollRef.current = null
      if (job.status === 'complete') loadCloudRuns()
    }
  }, [loadCloudRuns])

  useEffect(() => {
    checkServer()
    loadCloudRuns()
    const t = setInterval(checkServer, 5000)
    return () => clearInterval(t)
  }, [checkServer, loadCloudRuns])

  const launch = async () => {
    setLines([]); setLinesCursor(0); setError(''); setStatus('pending')
    const rows = await sbPost('/audit_jobs', { module })
    if (!rows || !rows[0]) {
      setError('Failed to create audit job in Supabase.'); setStatus('idle'); return
    }
    const id = rows[0].id
    setJobId(id)
    setStatus('running')

    clearInterval(pollRef.current)
    let cursor = 0
    pollRef.current = setInterval(async () => {
      const [jobs, newLines] = await Promise.all([
        sbGet(`/audit_jobs?id=eq.${id}&select=id,status,output_dir,run_id`),
        sbGet(`/audit_job_lines?job_id=eq.${id}&id=gt.${cursor}&select=id,line,line_type&order=id.asc&limit=100`),
      ])
      if (newLines.length) {
        cursor = newLines[newLines.length - 1].id
        setLines(prev => [...prev, ...newLines.map(l => ({ text: l.line, type: l.line_type }))])
      }
      const job = jobs[0]
      if (job && job.status !== 'running' && job.status !== 'pending') {
        setStatus(job.status)
        clearInterval(pollRef.current)
        pollRef.current = null
        if (job.status === 'complete') setTimeout(loadCloudRuns, 2000)
      }
    }, 1000)
  }

  const stop = async () => {
    if (!jobId) return
    await sbPatch(`/audit_jobs?id=eq.${jobId}`, { status: 'stopped' })
    setStatus('stopped')
    clearInterval(pollRef.current)
    pollRef.current = null
  }

  const reset = () => {
    setLines([]); setJobId(null); setStatus('idle')
    setLinesCursor(0); setError('')
    clearInterval(pollRef.current)
    pollRef.current = null
  }

  useEffect(() => () => clearInterval(pollRef.current), [])

  const card = {
    background: 'linear-gradient(180deg,rgba(13,33,55,0.95),rgba(10,22,40,0.95))',
    border: '1px solid rgba(0,168,204,0.2)', borderRadius: 14, padding: '1.5rem',
  }
  const statusColor = STATUS_COLOR[status] || STATUS_COLOR.idle

  return (
    <section style={{ maxWidth: 900, margin: '0 auto', padding: '0 1rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.5rem' }}>
        <div style={{ width: 40, height: 40, borderRadius: 8, background: 'linear-gradient(135deg,#0077B6,#00C9A7)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
            <polyline points="6 8 10 12 6 16"/><line x1="13" y1="12" x2="18" y2="12"/>
          </svg>
        </div>
        <div>
          <h2 style={{ fontFamily: 'Sora,sans-serif', fontWeight: 700, fontSize: '1.25rem', color: '#fff', margin: 0 }}>BES Cyber Asset Baseline Audit</h2>
          <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)', margin: 0 }}>NERC CIP-010 R1 / CIP-007 R1 &amp; R2 — audit_master.sh v2.1.0</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: serverOk === null ? '#FBBF24' : serverOk ? '#00C9A7' : '#F87171', boxShadow: serverOk ? '0 0 6px #00C9A7' : 'none' }}/>
          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)' }}>
            {serverOk === null ? 'Checking…' : serverOk ? `Server ready · ${serverInfo?.hostname || ''}` : 'Server offline'}
          </span>
        </div>
      </div>

      {/* Server offline banner */}
      {serverOk === false && (
        <div style={{ ...card, border: '1px solid rgba(248,113,113,0.4)', background: 'rgba(127,29,29,0.15)', marginBottom: '1rem' }}>
          <p style={{ margin: 0, color: '#FCA5A5', fontSize: '0.875rem', fontWeight: 600 }}>Audit server is not running.</p>
          <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>Open Terminal on your iMac and run:</p>
          <code style={{ display: 'block', marginTop: 8, padding: '8px 12px', borderRadius: 6, background: 'rgba(0,0,0,0.4)', color: '#00C9A7', fontSize: '0.78rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
            cd ~/Desktop/FAU_EMBA/SUMMER\ 2026/ISM/CLAUDE/NERC_Trainer/cipguard-landing/audit-server{'\n'}node server.js &
          </code>
        </div>
      )}

      {/* Controls */}
      <div style={{ ...card, marginBottom: '1rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 220px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Audit Scope</label>
            <select value={module} onChange={e => setModule(e.target.value)} disabled={status === 'running' || status === 'pending'}
              style={{ width: '100%', padding: '0.6rem 0.875rem', borderRadius: 8, background: 'rgba(10,22,40,0.7)', border: '1px solid rgba(0,168,204,0.25)', color: '#fff', fontSize: '0.875rem', fontFamily: 'inherit', outline: 'none' }}>
              {MODULES.map(m => <option key={m.value} value={m.value}>{m.label} — {m.desc}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {status !== 'running' && status !== 'pending' ? (
              <button onClick={status === 'idle' ? launch : reset} disabled={!serverOk}
                style={{ padding: '0.625rem 1.25rem', borderRadius: 8, fontWeight: 700, fontSize: '0.875rem', border: 'none', cursor: serverOk ? 'pointer' : 'not-allowed', background: status === 'idle' ? 'linear-gradient(135deg,#0077B6,#00C9A7)' : 'rgba(255,255,255,0.08)', color: '#fff', opacity: serverOk ? 1 : 0.4 }}>
                {status === 'idle' ? '▶  Launch Audit' : '↺  New Audit'}
              </button>
            ) : (
              <button onClick={stop}
                style={{ padding: '0.625rem 1.25rem', borderRadius: 8, fontWeight: 700, fontSize: '0.875rem', border: '1px solid rgba(248,113,113,0.5)', background: 'rgba(248,113,113,0.12)', color: '#FCA5A5', cursor: 'pointer' }}>
                ■  Stop
              </button>
            )}
          </div>
        </div>
        {(status === 'running' || status === 'pending' || status === 'complete') && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: '1rem' }}>
            {status === 'pending' && <span style={{ fontSize: '0.8rem', color: '#FBBF24' }}>⏳ Waiting for local server to pick up job…</span>}
            {status !== 'pending' && SECTION_TAGS.map(tag => <SectionBadge key={tag} tag={tag} lines={lines.map(l => l.text)} />)}
          </div>
        )}
      </div>

      {/* Terminal output */}
      {(lines.length > 0 || error) && (
        <div style={{ ...card, marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: '0.75rem', color: statusColor, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {status === 'running' && '⬤ Running'}{status === 'complete' && '✓ Complete'}{status === 'error' && '✗ Error'}{status === 'stopped' && '■ Stopped'}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>{lines.filter(l => l.text?.trim()).length} lines</span>
          </div>
          {error && <div style={{ padding: '8px 12px', borderRadius: 6, marginBottom: 8, background: 'rgba(127,29,29,0.3)', border: '1px solid rgba(248,113,113,0.3)', color: '#FCA5A5', fontSize: '0.8rem' }}>{error}</div>}
          <div ref={termRef} style={{ background: '#050C16', borderRadius: 8, padding: '12px 14px', fontFamily: '"SF Mono","Fira Code","Consolas",monospace', fontSize: '0.775rem', lineHeight: 1.65, color: 'rgba(255,255,255,0.82)', maxHeight: 380, overflowY: 'auto', border: '1px solid rgba(0,168,204,0.12)' }}>
            {lines.map((l, i) => {
              const line  = l.text || ''
              const isOk  = line.includes('[+]') || line.includes('✓')
              const isHdr = line.includes('[>]')
              const isWrn = line.includes('[!]')
              const isErr = line.includes('[ERROR]') || line.includes('✗') || l.type === 'error' || l.type === 'stderr'
              const color = isErr ? '#F87171' : isWrn ? '#FBBF24' : isHdr ? '#00A8CC' : isOk ? '#00C9A7' : 'rgba(255,255,255,0.75)'
              return <div key={i} style={{ color, minHeight: '1em' }}>{line || ' '}</div>
            })}
            {(status === 'running' || status === 'pending') && <span style={{ color: '#00A8CC', animation: 'blink 1s step-end infinite' }}>▋</span>}
          </div>
          {status === 'complete' && <ManifestTable lines={lines.map(l => l.text)} />}
        </div>
      )}

      {/* Cloud Audit History */}
      {cloudRuns.length > 0 && (
        <div style={{ ...card, marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#00A8CC', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>Cloud Audit History</div>
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
                const total = run.row_counts ? Object.values(run.row_counts).reduce((a, b) => a + b, 0) : '—'
                return (
                  <tr key={run.id} style={{ background: i % 2 === 0 ? 'rgba(0,168,204,0.04)' : 'transparent', color: 'rgba(255,255,255,0.75)' }}>
                    <td style={{ padding: '5px 8px', color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>{i === 0 ? '🟢 NEW' : i === 1 ? '🔵 OLD' : i + 1}</td>
                    <td style={{ padding: '5px 8px', fontFamily: 'monospace' }}>{run.host}</td>
                    <td style={{ padding: '5px 8px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>{new Date(run.created_at).toLocaleString()}</td>
                    <td style={{ padding: '5px 8px' }}>{run.module}</td>
                    <td style={{ padding: '5px 8px', color: '#00C9A7', fontWeight: 700 }}>{total}</td>
                    <td style={{ padding: '5px 8px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: '0.7rem', fontWeight: 600, background: run.status === 'complete' ? 'rgba(0,201,167,0.15)' : 'rgba(248,113,113,0.15)', color: run.status === 'complete' ? '#00C9A7' : '#F87171' }}>{run.status}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {cloudRuns.length >= 2 && (
            <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>COMPARE:</span>
              <select value={compareIdxA} onChange={e => setCompareIdxA(Number(e.target.value))}
                style={{ padding: '0.4rem 0.7rem', borderRadius: 6, fontSize: '0.78rem', background: 'rgba(10,22,40,0.8)', border: '1px solid rgba(0,168,204,0.25)', color: '#fff', fontFamily: 'inherit' }}>
                {cloudRuns.map((r, i) => <option key={r.id} value={i}>{i === 0 ? 'NEW' : i === 1 ? 'OLD' : `Run ${i+1}`} — {new Date(r.created_at).toLocaleDateString()}</option>)}
              </select>
              <span style={{ color: 'rgba(255,255,255,0.3)' }}>vs</span>
              <select value={compareIdxB} onChange={e => setCompareIdxB(Number(e.target.value))}
                style={{ padding: '0.4rem 0.7rem', borderRadius: 6, fontSize: '0.78rem', background: 'rgba(10,22,40,0.8)', border: '1px solid rgba(0,168,204,0.25)', color: '#fff', fontFamily: 'inherit' }}>
                {cloudRuns.map((r, i) => <option key={r.id} value={i}>{i === 0 ? 'NEW' : i === 1 ? 'OLD' : `Run ${i+1}`} — {new Date(r.created_at).toLocaleDateString()}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {cloudRuns.length >= 2 && compareIdxA !== compareIdxB && (
        <CompareView runA={cloudRuns[compareIdxA]} runB={cloudRuns[compareIdxB]} />
      )}

      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}`}</style>
    </section>
  )
}
