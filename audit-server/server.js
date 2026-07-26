/**
 * CIPGuard Audit Server  v3.0
 * ============================
 * Polls Supabase for pending audit jobs, executes audit_master.sh under sudo,
 * streams output lines back to Supabase, and uploads completed CSVs.
 * All UI↔server communication goes through Supabase — no direct localhost calls.
 */

require('dotenv').config()

const { spawn } = require('child_process')
const path      = require('path')
const fs        = require('fs')
const os        = require('os')

const SUPABASE_URL         = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

const SCRIPT_DIR   = path.resolve(__dirname, '../../skills/launch-linux-baseline')
const AUDIT_SCRIPT = path.join(SCRIPT_DIR, 'audit_master.sh')

let activeJobId = null

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...opts,
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      ...(opts.headers || {}),
    },
  })
  return res
}

async function patchJob(id, data) {
  await sbFetch(`/audit_jobs?id=eq.${id}`, {
    method:  'PATCH',
    headers: { 'Prefer': 'return=minimal' },
    body:    JSON.stringify(data),
  })
}

async function insertLines(jobId, lines) {
  if (!lines.length) return
  await sbFetch('/audit_job_lines', {
    method:  'POST',
    headers: { 'Prefer': 'return=minimal' },
    body:    JSON.stringify(lines.map(l => ({ job_id: jobId, line: l.text, line_type: l.type }))),
  })
}

// ── Upload completed audit CSV to audit_runs ──────────────────────────────────

async function uploadAuditRun(jobId, outputDir, module, status) {
  if (!outputDir) return null
  try {
    const files   = fs.readdirSync(outputDir)
    const csvFile = files.find(f => f.startsWith('consolidated_audit_'))
    if (!csvFile) return null

    const csvContent = fs.readFileSync(path.join(outputDir, csvFile), 'utf8')
    const rowCounts  = {}
    csvContent.split('\n').forEach(line => {
      if (!line.trim()) return
      const section = line.split(',')[0]?.replace(/"/g, '').trim()
      if (section && section !== 'Section') rowCounts[section] = (rowCounts[section] || 0) + 1
    })

    const dirName   = path.basename(outputDir)
    const hostMatch = dirName.match(/^audit_output_(.+)_\d{8}_\d{6}$/)
    const host      = hostMatch ? hostMatch[1] : os.hostname()

    const res = await sbFetch('/audit_runs', {
      method:  'POST',
      headers: { 'Prefer': 'return=representation' },
      body:    JSON.stringify({ host, module, status, row_counts: rowCounts, csv_content: csvContent }),
    })

    if (res.ok) {
      const rows = await res.json()
      const runId = rows[0]?.id
      console.log(`[CIPGuard] Audit uploaded to Supabase (run_id: ${runId})`)
      return runId
    }
    console.error('[CIPGuard] Upload failed:', res.status)
    return null
  } catch (err) {
    console.error('[CIPGuard] Upload error:', err.message)
    return null
  }
}

// ── Run an audit job ──────────────────────────────────────────────────────────

async function runJob(job) {
  activeJobId = job.id
  console.log(`[CIPGuard] Starting job ${job.id} (module: ${job.module})`)

  await patchJob(job.id, { status: 'running', started_at: new Date().toISOString() })

  const args = [AUDIT_SCRIPT]
  if (job.module !== 'all') args.push('-m', job.module)

  const sudoWrapper = '/usr/local/bin/cipguard-audit'
  let child

  if (fs.existsSync(sudoWrapper)) {
    const env = { ...process.env, AUDIT_MODULE: job.module }
    child = spawn('sudo', [sudoWrapper], { env })
  } else {
    child = spawn('sudo', ['bash', ...args], { cwd: SCRIPT_DIR })
  }

  let outputDir  = null
  let lineBuffer = []

  const flushLines = async () => {
    if (!lineBuffer.length) return
    const toFlush = lineBuffer.splice(0)
    await insertLines(job.id, toFlush)
  }

  const flushInterval = setInterval(flushLines, 500)

  const pushLine = (text, type) => {
    const stripped = text.replace(/\x1b\[[0-9;]*m/g, '')
    const dirMatch = stripped.match(/Output dir\s*:\s*(.+)/)
    if (dirMatch) outputDir = dirMatch[1].trim()
    stripped.split('\n').forEach(line => {
      if (line !== undefined) lineBuffer.push({ text: line, type })
    })
  }

  child.stdout.on('data', d => pushLine(d.toString(), 'stdout'))
  child.stderr.on('data', d => pushLine(d.toString(), 'stderr'))

  await new Promise(resolve => child.on('close', resolve))

  clearInterval(flushInterval)
  await flushLines()

  const exitCode = child.exitCode
  const status   = exitCode === 0 ? 'complete' : 'error'

  lineBuffer.push({
    text: exitCode === 0
      ? `\n✓ Audit complete. Exit code: ${exitCode}`
      : `\n✗ Audit exited with code ${exitCode}`,
    type: status,
  })
  await flushLines()

  let runId = null
  if (exitCode === 0) runId = await uploadAuditRun(job.id, outputDir, job.module, status)

  await patchJob(job.id, {
    status,
    output_dir:   outputDir,
    completed_at: new Date().toISOString(),
    run_id:       runId,
  })

  console.log(`[CIPGuard] Job ${job.id} ${status}`)
  activeJobId = null
}

// ── Poll for pending jobs ─────────────────────────────────────────────────────

async function pollJobs() {
  if (activeJobId) return
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return

  try {
    const res = await sbFetch(
      '/audit_jobs?status=eq.pending&order=created_at.asc&limit=1',
      { headers: { 'Prefer': 'return=representation' } }
    )
    if (!res.ok) return
    const jobs = await res.json()
    if (jobs.length) runJob(jobs[0]).catch(err => {
      console.error('[CIPGuard] Job error:', err.message)
      activeJobId = null
    })
  } catch (err) {
    console.warn('[CIPGuard] Poll error:', err.message)
  }
}

// ── Heartbeat ─────────────────────────────────────────────────────────────────

async function sendHeartbeat() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return
  try {
    await sbFetch('/server_heartbeat', {
      method:  'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates' },
      body:    JSON.stringify({
        host:      os.hostname(),
        hostname:  os.hostname(),
        platform:  os.platform(),
        last_seen: new Date().toISOString(),
        script_ok: fs.existsSync(AUDIT_SCRIPT),
      }),
    })
  } catch (err) {
    console.warn('[CIPGuard] Heartbeat failed:', err.message)
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('[CIPGuard] SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env')
  process.exit(1)
}

console.log('[CIPGuard Audit Server] v3.0 starting')
console.log(`[CIPGuard Audit Server] Script dir:    ${SCRIPT_DIR}`)
console.log(`[CIPGuard Audit Server] Script exists: ${fs.existsSync(AUDIT_SCRIPT)}`)
console.log('[CIPGuard Audit Server] Mode:          Supabase polling (no HTTP server)')

sendHeartbeat()
setInterval(sendHeartbeat, 30_000)

pollJobs()
setInterval(pollJobs, 2_000)

console.log('[CIPGuard Audit Server] Polling for jobs every 2s…')
