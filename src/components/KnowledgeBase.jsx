import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// NERC CIP knowledge base: a Q&A box for everyone (RAG over ingested sources),
// plus a super-admin-only panel to trigger Firecrawl ingestion.
export default function KnowledgeBase() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [sources, setSources] = useState([])

  // Q&A state
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const [answer, setAnswer] = useState('')
  const [answerSources, setAnswerSources] = useState([])
  const [askError, setAskError] = useState('')

  // Ingest state (per source id)
  const [ingesting, setIngesting] = useState({})
  const [ingestMsg, setIngestMsg] = useState({})

  useEffect(() => {
    let active = true
    async function load() {
      const { data: prof } = await supabase.from('profiles').select('access_level').maybeSingle()
      if (!active) return
      const admin = prof?.access_level === 'super_admin'
      setIsAdmin(admin)
      if (admin) {
        const { data } = await supabase
          .from('nerc_sources')
          .select('id, name, region, base_url, category, enabled, last_crawled_at')
          .order('name')
        if (active) setSources(data ?? [])
      }
    }
    load()
    return () => { active = false }
  }, [])

  const handleAsk = async (e) => {
    e.preventDefault()
    if (!question.trim()) return
    setAsking(true)
    setAnswer('')
    setAnswerSources([])
    setAskError('')
    const { data, error } = await supabase.functions.invoke('query-nerc', {
      body: { question: question.trim() },
    })
    if (error) setAskError('Could not get an answer. Please try again.')
    else {
      setAnswer(data?.answer || '(no answer)')
      setAnswerSources(data?.sources || [])
    }
    setAsking(false)
  }

  const handleIngest = async (sourceId) => {
    setIngesting((s) => ({ ...s, [sourceId]: true }))
    setIngestMsg((m) => ({ ...m, [sourceId]: '' }))
    const { data, error } = await supabase.functions.invoke('ingest-nerc', {
      body: { sourceId },
    })
    if (error) {
      setIngestMsg((m) => ({ ...m, [sourceId]: 'Ingest failed.' }))
    } else {
      setIngestMsg((m) => ({ ...m, [sourceId]: `Ingested ${data?.chunks ?? 0} chunks (${data?.chars ?? 0} chars).` }))
      // refresh last_crawled_at
      const { data: refreshed } = await supabase
        .from('nerc_sources').select('id, name, region, base_url, category, enabled, last_crawled_at').order('name')
      if (refreshed) setSources(refreshed)
    }
    setIngesting((s) => ({ ...s, [sourceId]: false }))
  }

  const card = { background: 'rgba(13,33,55,0.8)', border: '1px solid rgba(0,168,204,0.15)', borderRadius: 12, padding: '1.75rem' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: 900 }}>
      {/* Ask box */}
      <div style={card}>
        <span style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-signal)' }}>NERC CIP Knowledge Base</span>
        <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '1.375rem', color: '#fff', margin: '0.25rem 0 0.5rem' }}>Ask a question</h2>
        <p style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.5)', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
          Answers are generated from ingested NERC sources and cite where they came from. Always verify against the official source before relying on it for compliance.
        </p>
        <form onSubmit={handleAsk} style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
          <input
            type="text" value={question} onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. What are the megawatt criteria for CIP-002 medium impact classification?"
            style={{ flex: '1 1 320px', padding: '0.75rem 0.875rem', borderRadius: 8, background: 'rgba(10,22,40,0.6)', border: '1px solid rgba(0,168,204,0.25)', color: '#fff', fontSize: '0.9375rem', outline: 'none', fontFamily: 'inherit' }}
          />
          <button type="submit" disabled={asking} className="cta-btn" style={{ padding: '0.75rem 1.5rem', borderRadius: 8, fontSize: '0.9375rem', fontWeight: 700, border: 'none', cursor: asking ? 'wait' : 'pointer', opacity: asking ? 0.7 : 1 }}>
            {asking ? 'Thinking…' : 'Ask'}
          </button>
        </form>

        {askError && <div style={{ marginTop: '1rem', fontSize: '0.8125rem', color: '#F6A6A6' }}>{askError}</div>}

        {answer && (
          <div style={{ marginTop: '1.5rem', background: 'rgba(10,22,40,0.5)', border: '1px solid rgba(0,168,204,0.2)', borderRadius: 10, padding: '1.25rem' }}>
            <div style={{ fontSize: '0.9375rem', color: 'rgba(255,255,255,0.9)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{answer}</div>
            {answerSources.length > 0 && (
              <div style={{ marginTop: '1rem', paddingTop: '0.875rem', borderTop: '1px solid rgba(0,168,204,0.15)' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.45)', marginBottom: '0.5rem' }}>Sources</div>
                {answerSources.map((u) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer" style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--color-signal)', wordBreak: 'break-all' }}>{u}</a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Super-admin ingest panel */}
      {isAdmin && (
        <div style={card}>
          <span style={{ fontSize: '0.7rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-warning)' }}>Super Admin · Data Lake</span>
          <h3 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '1.125rem', color: '#fff', margin: '0.25rem 0 0.5rem' }}>NERC Source Ingestion</h3>
          <p style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.5)', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
            Crawl a source with Firecrawl and add it to the knowledge base. Verify each URL is correct before ingesting.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {sources.map((s) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', background: 'rgba(10,22,40,0.5)', border: '1px solid rgba(0,168,204,0.15)', borderRadius: 8, padding: '0.75rem 1rem' }}>
                <div style={{ flex: '1 1 240px', minWidth: 0 }}>
                  <div style={{ fontSize: '0.875rem', color: '#fff', fontWeight: 600 }}>{s.region} · {s.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', wordBreak: 'break-all' }}>{s.base_url}</div>
                  <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)' }}>
                    {s.last_crawled_at ? `Last crawled ${new Date(s.last_crawled_at).toLocaleString()}` : 'Never crawled'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {ingestMsg[s.id] && <span style={{ fontSize: '0.75rem', color: 'var(--color-verify)' }}>{ingestMsg[s.id]}</span>}
                  <button onClick={() => handleIngest(s.id)} disabled={ingesting[s.id]} className="secondary-btn" style={{ padding: '0.5rem 1rem', borderRadius: 8, fontSize: '0.8125rem', cursor: ingesting[s.id] ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>
                    {ingesting[s.id] ? 'Ingesting…' : 'Ingest now'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
