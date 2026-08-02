import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'

const TRAINER_API = import.meta.env.VITE_TRAINER_API_URL || 'http://localhost:8000'

const card = {
  background: 'rgba(13,33,55,0.8)',
  border: '1px solid rgba(0,168,204,0.15)',
  borderRadius: 12,
  padding: '1.75rem',
}

const IQ_COLORS = {
  Foundational: '#F6A6A6',
  Developing: '#FFD166',
  Proficient: '#00C9A7',
  Expert: '#0077B6',
  Unassessed: 'rgba(255,255,255,0.35)',
}

export default function MyBaseline() {
  const { session } = useAuth()
  const token = session?.access_token

  const [status, setStatus] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [connected, setConnected] = useState(null)
  const [view, setView] = useState('chat')
  const chatEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (!token) return
    checkHealth()
    loadStatus()
    loadHistory()
  }, [token])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function apiFetch(path, options = {}) {
    const res = await fetch(`${TRAINER_API}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail || `API error ${res.status}`)
    }
    return res.json()
  }

  async function checkHealth() {
    try {
      const res = await fetch(`${TRAINER_API}/health`)
      setConnected(res.ok)
    } catch {
      setConnected(false)
    }
  }

  async function loadStatus() {
    try {
      const data = await apiFetch('/status')
      setStatus(data)
    } catch { /* first load may fail if no profile yet */ }
  }

  async function loadHistory() {
    try {
      const data = await apiFetch('/history')
      if (data.messages?.length) {
        setMessages(data.messages.map((m, i) => ({ id: i, ...m })))
      }
    } catch { /* ok */ }
  }

  async function handleSend(e) {
    e.preventDefault()
    const text = input.trim()
    if (!text || sending) return

    setInput('')
    setError('')
    const userMsg = { id: Date.now(), role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setSending(true)

    try {
      const data = await apiFetch('/chat', {
        method: 'POST',
        body: JSON.stringify({ message: text }),
      })
      const aiMsg = { id: Date.now() + 1, role: 'assistant', content: data.response }
      setMessages((prev) => [...prev, aiMsg])
      setStatus((prev) => ({
        ...prev,
        overall_iq: data.iq_score,
        interaction_count: data.interaction_count,
        baseline_completed: data.baseline_completed,
      }))
      loadStatus()
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  async function handleClearHistory() {
    if (!confirm('Clear your conversation history? Your IQ scores and training progress are preserved.')) return
    try {
      await apiFetch('/history', { method: 'DELETE' })
      setMessages([])
    } catch (err) {
      setError(err.message)
    }
  }

  const iqLevel = status
    ? status.overall_iq <= 25 ? 'Foundational'
    : status.overall_iq <= 50 ? 'Developing'
    : status.overall_iq <= 75 ? 'Proficient'
    : 'Expert'
    : 'Unassessed'

  const iqColor = IQ_COLORS[iqLevel]

  const standards = status?.per_standard ? Object.entries(status.per_standard).sort(([a], [b]) => a.localeCompare(b)) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 1100 }}>

      {/* Connection status */}
      {connected === false && (
        <div style={{ ...card, borderColor: '#F6A6A6', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem 1.5rem' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F6A6A6' }} />
          <div>
            <div style={{ fontSize: '0.875rem', color: '#F6A6A6', fontWeight: 600 }}>AI Trainer server not detected</div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
              Start the trainer server: <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4, fontSize: '0.7rem' }}>cd cipguard-ai-trainer && python main.py serve</code>
            </div>
          </div>
          <button onClick={checkHealth} className="secondary-btn" style={{ marginLeft: 'auto', padding: '0.375rem 0.75rem', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer' }}>Retry</button>
        </div>
      )}

      {/* View toggle + header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <span style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-signal)' }}>CIPGuard AI Trainer</span>
          <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '1.375rem', color: '#fff', margin: '0.25rem 0 0' }}>My Baseline</h2>
        </div>
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          {['chat', 'progress'].map((v) => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '0.5rem 1rem', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: '0.8125rem', fontWeight: 600,
              background: view === v ? 'rgba(0,168,204,0.2)' : 'transparent',
              color: view === v ? '#fff' : 'rgba(255,255,255,0.5)',
            }}>
              {v === 'chat' ? 'Training Chat' : 'IQ Progress'}
            </button>
          ))}
        </div>
      </div>

      {/* IQ Summary bar */}
      <div style={{ ...card, padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `conic-gradient(${iqColor} ${(status?.overall_iq || 0) * 3.6}deg, rgba(255,255,255,0.08) 0deg)`,
          }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(13,33,55,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: iqColor }}>{Math.round(status?.overall_iq || 0)}</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 700, color: iqColor }}>{iqLevel}</div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>CIP IQ Score</div>
          </div>
        </div>

        <div style={{ height: 32, width: 1, background: 'rgba(0,168,204,0.15)' }} />

        <div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>{status?.interaction_count || 0}</div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>Interactions</div>
        </div>

        <div style={{ height: 32, width: 1, background: 'rgba(0,168,204,0.15)' }} />

        <div>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: status?.baseline_completed ? 'var(--color-verify)' : '#FFD166' }}>
            {status?.baseline_completed ? 'Complete' : 'In Progress'}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>Baseline</div>
        </div>

        {status?.strengths?.length > 0 && (
          <>
            <div style={{ height: 32, width: 1, background: 'rgba(0,168,204,0.15)' }} />
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-verify)' }}>{status.strengths.join(', ')}</div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>Strengths</div>
            </div>
          </>
        )}

        {status?.gaps?.length > 0 && (
          <>
            <div style={{ height: 32, width: 1, background: 'rgba(0,168,204,0.15)' }} />
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#F6A6A6' }}>{status.gaps.join(', ')}</div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>Gaps</div>
            </div>
          </>
        )}
      </div>

      {/* ═══ CHAT VIEW ═══ */}
      {view === 'chat' && (
        <div style={{ ...card, padding: 0, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 380px)', minHeight: 400 }}>
          {/* Messages */}
          <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'rgba(255,255,255,0.35)' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>CIPGuard AI Trainer</div>
                <div style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
                  {status?.baseline_completed
                    ? 'Continue your NERC CIP training. Ask a question or request a topic review.'
                    : 'Start your baseline assessment. The trainer will evaluate your knowledge across all 14 CIP standards.'}
                </div>
                {!status?.baseline_completed && (
                  <div style={{ fontSize: '0.75rem', marginTop: '0.75rem', color: 'rgba(255,255,255,0.25)' }}>
                    Type "hello" or "let's begin" to start.
                  </div>
                )}
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} style={{
                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
              }}>
                {msg.role === 'assistant' && (
                  <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-signal)', marginBottom: 4 }}>CIPGuard Trainer</div>
                )}
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  background: msg.role === 'user' ? 'rgba(0,119,182,0.25)' : 'rgba(10,22,40,0.6)',
                  border: `1px solid ${msg.role === 'user' ? 'rgba(0,119,182,0.3)' : 'rgba(0,168,204,0.15)'}`,
                  color: 'rgba(255,255,255,0.9)',
                  fontSize: '0.9375rem',
                  lineHeight: 1.65,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {msg.content}
                </div>
              </div>
            ))}

            {sending && (
              <div style={{ alignSelf: 'flex-start', maxWidth: '80%' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--color-signal)', marginBottom: 4 }}>CIPGuard Trainer</div>
                <div style={{
                  padding: '0.75rem 1rem', borderRadius: '12px 12px 12px 2px',
                  background: 'rgba(10,22,40,0.6)', border: '1px solid rgba(0,168,204,0.15)',
                  color: 'rgba(255,255,255,0.5)', fontSize: '0.9375rem',
                }}>
                  <span className="pulse-dot">Thinking</span>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} style={{
            borderTop: '1px solid rgba(0,168,204,0.15)', padding: '1rem 1.5rem',
            display: 'flex', gap: '0.625rem', alignItems: 'center',
          }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={connected === false ? 'Start the AI Trainer server to begin…' : 'Ask about NERC CIP standards, your baseline, or compliance topics…'}
              disabled={connected === false || sending}
              style={{
                flex: 1, padding: '0.75rem 0.875rem', borderRadius: 8,
                background: 'rgba(10,22,40,0.6)', border: '1px solid rgba(0,168,204,0.25)',
                color: '#fff', fontSize: '0.9375rem', outline: 'none', fontFamily: 'inherit',
                opacity: connected === false ? 0.5 : 1,
              }}
            />
            <button
              type="submit"
              disabled={connected === false || sending || !input.trim()}
              className="cta-btn"
              style={{
                padding: '0.75rem 1.5rem', borderRadius: 8, fontSize: '0.9375rem',
                fontWeight: 700, border: 'none',
                cursor: sending ? 'wait' : 'pointer',
                opacity: (connected === false || sending || !input.trim()) ? 0.5 : 1,
              }}
            >
              {sending ? 'Sending…' : 'Send'}
            </button>
            {messages.length > 0 && (
              <button type="button" onClick={handleClearHistory} className="secondary-btn" style={{
                padding: '0.75rem', borderRadius: 8, fontSize: '0.75rem', cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}>
                Clear
              </button>
            )}
          </form>
          {error && <div style={{ padding: '0.5rem 1.5rem 1rem', fontSize: '0.8125rem', color: '#F6A6A6' }}>{error}</div>}
        </div>
      )}

      {/* ═══ PROGRESS VIEW ═══ */}
      {view === 'progress' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Per-standard scores */}
          <div style={card}>
            <h3 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '1.125rem', color: '#fff', margin: '0 0 1rem' }}>
              Per-Standard IQ Scores
            </h3>
            {standards.length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.4)' }}>
                No scores yet. Start your baseline assessment in the Training Chat to begin tracking.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {standards.map(([stdId, score]) => {
                  const pct = Math.min(100, Math.max(0, score))
                  const barColor = pct >= 76 ? '#0077B6' : pct >= 51 ? '#00C9A7' : pct >= 26 ? '#FFD166' : '#F6A6A6'
                  return (
                    <div key={stdId} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: 72, fontSize: '0.8125rem', fontWeight: 600, color: 'rgba(255,255,255,0.8)', flexShrink: 0 }}>{stdId}</div>
                      <div style={{ flex: 1, height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 5, overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 5, transition: 'width 0.5s ease' }} />
                      </div>
                      <div style={{ width: 36, textAlign: 'right', fontSize: '0.8125rem', fontWeight: 700, color: barColor }}>{Math.round(pct)}</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Strengths & Gaps detail */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            <div style={card}>
              <h3 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'var(--color-verify)', margin: '0 0 0.75rem' }}>Strengths</h3>
              {(status?.strengths || []).length === 0
                ? <p style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.4)' }}>Complete training to identify strengths.</p>
                : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                    {status.strengths.map((s) => (
                      <span key={s} style={{ padding: '0.375rem 0.75rem', borderRadius: 6, background: 'rgba(0,201,167,0.12)', border: '1px solid rgba(0,201,167,0.3)', color: 'var(--color-verify)', fontSize: '0.8125rem', fontWeight: 600 }}>{s}</span>
                    ))}
                  </div>
                )}
            </div>
            <div style={card}>
              <h3 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '1rem', color: '#F6A6A6', margin: '0 0 0.75rem' }}>Knowledge Gaps</h3>
              {(status?.gaps || []).length === 0
                ? <p style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.4)' }}>No gaps identified yet.</p>
                : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
                    {status.gaps.map((g) => (
                      <span key={g} style={{ padding: '0.375rem 0.75rem', borderRadius: 6, background: 'rgba(246,166,166,0.12)', border: '1px solid rgba(246,166,166,0.3)', color: '#F6A6A6', fontSize: '0.8125rem', fontWeight: 600 }}>{g}</span>
                    ))}
                  </div>
                )}
            </div>
          </div>

          {/* Escalation contact */}
          {status?.escalation_contact && (
            <div style={card}>
              <h3 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '1rem', color: '#fff', margin: '0 0 0.5rem' }}>Escalation Contact</h3>
              <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)', margin: 0 }}>
                Unresolvable questions will be escalated to: <strong style={{ color: '#fff' }}>{status.escalation_contact}</strong>
              </p>
            </div>
          )}
        </div>
      )}

      <style>{`
        .pulse-dot::after {
          content: '...';
          animation: pulse-dots 1.4s infinite;
        }
        @keyframes pulse-dots {
          0%, 20% { content: '.'; }
          40% { content: '..'; }
          60%, 100% { content: '...'; }
        }
      `}</style>
    </div>
  )
}
