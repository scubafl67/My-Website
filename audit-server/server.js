/**
 * CIPGuard Audit Server  v1.0
 * ============================
 * Local Express server (port 3001) that receives requests from the CIPGuard
 * React UI, executes audit_master.sh under sudo, and streams live output back
 * to the browser via Server-Sent Events (SSE).
 *
 * Prerequisites (run install.sh once):
 *   - /usr/local/bin/cipguard-audit wrapper script exists
 *   - sudoers NOPASSWD rule configured for cipguard-audit
 *
 * Start: node server.js  (or: npm start)
 */

const express    = require('express')
const cors       = require('cors')
const { spawn }  = require('child_process')
const path       = require('path')
const fs         = require('fs')
const os         = require('os')

const app  = express()
const PORT = 3001

const SCRIPT_DIR = path.resolve(
  __dirname,
  '../../../skills/launch-linux-baseline'
)
const AUDIT_SCRIPT = path.join(SCRIPT_DIR, 'audit_master.sh')

// Active jobs: jobId → { process, lines[], startTime, status, outputDir }
const jobs = new Map()

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }))
app.use(express.json())

// ── Health check ─────────────────────────────────────��─────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    platform: os.platform(),
    hostname: os.hostname(),
    scriptExists: fs.existsSync(AUDIT_SCRIPT),
    scriptDir: SCRIPT_DIR,
  })
})

// ── Launch audit ─────────��────────────────────────────��────────────────────────
// POST /api/audit/launch
// Body: { module?: string, outputDir?: string }
// Returns: { jobId }
app.post('/api/audit/launch', (req, res) => {
  // Only one job at a time
  for (const [id, job] of jobs.entries()) {
    if (job.status === 'running') {
      return res.status(409).json({ error: 'An audit is already running.', jobId: id })
    }
  }

  if (!fs.existsSync(AUDIT_SCRIPT)) {
    return res.status(500).json({
      error: `audit_master.sh not found at: ${AUDIT_SCRIPT}`,
    })
  }

  const module    = req.body.module    || 'all'
  const outputDir = req.body.outputDir || null

  const args = [AUDIT_SCRIPT]
  if (module !== 'all') { args.push('-m', module) }
  if (outputDir)        { args.push('-o', outputDir) }

  const jobId = `audit_${Date.now()}`
  const startTime = new Date().toISOString()

  // sudo cipguard-audit wrapper (NOPASSWD) or fallback to direct bash
  const sudoWrapper = '/usr/local/bin/cipguard-audit'
  let child

  if (fs.existsSync(sudoWrapper)) {
    // wrapper ignores extra args — pass module/output via env instead
    const env = { ...process.env, AUDIT_MODULE: module }
    if (outputDir) env.AUDIT_OUTPUT_DIR = outputDir
    child = spawn('sudo', [sudoWrapper], { env })
  } else {
    // Fallback: direct sudo bash (requires TTY sudoers config or cached creds)
    child = spawn('sudo', ['bash', ...args], { cwd: SCRIPT_DIR })
  }

  const job = {
    process: child,
    lines:   [],
    startTime,
    status:  'running',
    outputDir: null,
    module,
    pid: child.pid,
  }
  jobs.set(jobId, job)

  child.stdout.on('data', (data) => {
    const text = data.toString()
    job.lines.push({ type: 'stdout', text, ts: Date.now() })

    // Extract output directory path from script banner line
    const dirMatch = text.match(/Output dir\s*:\s*(.+)/)
    if (dirMatch) job.outputDir = dirMatch[1].replace(/\x1b\[[0-9;]*m/g, '').trim()
  })

  child.stderr.on('data', (data) => {
    job.lines.push({ type: 'stderr', text: data.toString(), ts: Date.now() })
  })

  child.on('close', (code) => {
    job.status   = code === 0 ? 'complete' : 'error'
    job.exitCode = code
    job.endTime  = new Date().toISOString()
    job.lines.push({
      type: code === 0 ? 'done' : 'error',
      text: code === 0
        ? `\n✓ Audit complete. Exit code: ${code}`
        : `\n✗ Audit exited with code ${code}`,
      ts: Date.now(),
    })
  })

  res.json({ jobId, startTime })
})

// ── Stop audit ──────────────���──────────────────────────���───────────────────────
app.post('/api/audit/stop/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId)
  if (!job) return res.status(404).json({ error: 'Job not found' })
  if (job.status !== 'running') return res.json({ ok: true, status: job.status })
  try {
    process.kill(-job.process.pid, 'SIGTERM')
  } catch (_) {
    job.process.kill('SIGTERM')
  }
  job.status = 'stopped'
  res.json({ ok: true })
})

// ── SSE stream ──────��──────────────────────────────��───────────────────────────
// GET /api/audit/stream/:jobId
// Streams output lines as SSE events until job completes
app.get('/api/audit/stream/:jobId', (req, res) => {
  const jobId = req.params.jobId
  const job   = jobs.get(jobId)
  if (!job) return res.status(404).json({ error: 'Job not found' })

  res.writeHead(200, {
    'Content-Type':  'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection':    'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.flushHeaders()

  let cursor = 0

  const send = () => {
    while (cursor < job.lines.length) {
      const line = job.lines[cursor++]
      const stripped = line.text.replace(/\x1b\[[0-9;]*m/g, '') // strip ANSI
      res.write(`data: ${JSON.stringify({ type: line.type, text: stripped })}\n\n`)
    }

    if (job.status !== 'running') {
      res.write(`data: ${JSON.stringify({ type: 'end', status: job.status, outputDir: job.outputDir })}\n\n`)
      res.end()
      clearInterval(timer)
    }
  }

  // Flush buffered lines immediately, then poll
  send()
  const timer = setInterval(send, 150)
  req.on('close', () => clearInterval(timer))
})

// ── Job status ─────────────��───────────────────────────���───────────────────────
app.get('/api/audit/status/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId)
  if (!job) return res.status(404).json({ error: 'Job not found' })
  res.json({
    jobId: req.params.jobId,
    status:    job.status,
    startTime: job.startTime,
    endTime:   job.endTime   || null,
    outputDir: job.outputDir || null,
    module:    job.module,
    lineCount: job.lines.length,
  })
})

// ── List completed output directories ─��───────────────────────────────────────
app.get('/api/audit/outputs', (req, res) => {
  try {
    const dirs = fs.readdirSync(SCRIPT_DIR)
      .filter(f => f.startsWith('audit_output_'))
      .map(name => {
        const fullPath = path.join(SCRIPT_DIR, name)
        const manifest = path.join(fullPath, 'MANIFEST.csv')
        let rows = null
        if (fs.existsSync(manifest)) {
          rows = fs.readFileSync(manifest, 'utf8')
            .split('\n')
            .filter(l => l && !l.startsWith('"File"'))
            .reduce((acc, line) => {
              const parts = line.split('","')
              const file  = parts[0]?.replace(/"/g, '')
              const count = parseInt(parts[2]) || 0
              if (file && !file.startsWith('MANIFEST')) acc[file] = count
              return acc
            }, {})
        }
        return { name, fullPath, manifest: rows }
      })
      .sort((a, b) => b.name.localeCompare(a.name))
    res.json({ outputs: dirs })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ── Download consolidated CSV ────────────────────────────────────────���─────────
app.get('/api/audit/download/:dirName', (req, res) => {
  const dirPath = path.join(SCRIPT_DIR, req.params.dirName)
  if (!fs.existsSync(dirPath)) return res.status(404).json({ error: 'Not found' })

  const csvFiles = fs.readdirSync(dirPath)
    .filter(f => f.startsWith('consolidated_audit_'))
  if (!csvFiles.length) return res.status(404).json({ error: 'No consolidated CSV found' })

  const csvPath = path.join(dirPath, csvFiles[0])
  res.download(csvPath, csvFiles[0])
})

// ── Start ───────────���─────────────────────────────���────────────────────────────
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[CIPGuard Audit Server] Listening on http://127.0.0.1:${PORT}`)
  console.log(`[CIPGuard Audit Server] Script dir: ${SCRIPT_DIR}`)
  console.log(`[CIPGuard Audit Server] Script exists: ${fs.existsSync(AUDIT_SCRIPT)}`)
})
