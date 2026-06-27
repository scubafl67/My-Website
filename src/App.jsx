import { useState } from 'react'

// ─── NAV ────────────────────────────────────────────────────────────────────
function Nav() {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <nav style={{ background: 'rgba(10,22,40,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(0,168,204,0.15)', position: 'sticky', top: 0, zIndex: 50 }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{ width: 32, height: 32, borderRadius: 6, background: 'linear-gradient(135deg, #0077B6, #00C9A7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '1.125rem', letterSpacing: '-0.01em', color: '#fff' }}>CIPGuard™</span>
        </div>

        {/* Desktop links */}
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center' }} className="hidden md:flex">
          {['Platform','Pricing','Results','Resources'].map(l => (
            <a key={l} href="#" className="nav-link" style={{ fontSize: '0.9rem', fontWeight: 500 }}>{l}</a>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <a href="#" className="secondary-btn" style={{ padding: '0.5rem 1.125rem', borderRadius: 6, fontSize: '0.875rem', textDecoration: 'none' }}>Log In</a>
          <a href="#" className="cta-btn" style={{ padding: '0.5rem 1.25rem', borderRadius: 6, fontSize: '0.875rem', textDecoration: 'none' }}>Schedule a Demo</a>
        </div>
      </div>
    </nav>
  )
}

// ─── HERO ───────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section style={{ position: 'relative', overflow: 'hidden', padding: '5rem 1.5rem 6rem' }}>
      {/* Background gradient glow */}
      <div style={{ position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)', width: 800, height: 500, background: 'radial-gradient(ellipse, rgba(0,119,182,0.25) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center', position: 'relative' }}>
        {/* Badge */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,201,167,0.1)', border: '1px solid rgba(0,201,167,0.3)', borderRadius: 100, padding: '0.375rem 1rem', marginBottom: '1.75rem' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-verify)' }} />
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-verify)', letterSpacing: '0.02em' }}>Trusted by 200+ NERC CIP Compliance Teams</span>
        </div>

        <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 'clamp(2.25rem, 5vw, 3.5rem)', lineHeight: 1.1, marginBottom: '1.5rem', color: '#fff' }}>
          Stop Being the Only Person on Your Team<br />
          <span className="brand-gradient-text">Who Can Survive the Audit Room</span>
        </h1>

        <p style={{ fontSize: '1.125rem', lineHeight: 1.7, color: 'rgba(255,255,255,0.7)', maxWidth: 680, margin: '0 auto 2.5rem', fontWeight: 400 }}>
          CIPGuard is the AI-powered NERC CIP subject matter expert built exclusively from official NERC.com standards, CMEP guidance, and historical technical references. It teaches your team by challenging them — the same way an auditor would.
        </p>

        <div style={{ display: 'flex', gap: '0.875rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <a href="#" className="cta-btn" style={{ padding: '0.875rem 2rem', borderRadius: 8, fontSize: '1rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            Schedule a Demo
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
          <a href="#" className="secondary-btn" style={{ padding: '0.875rem 2rem', borderRadius: 8, fontSize: '1rem', textDecoration: 'none' }}>See How It Works</a>
        </div>

        <p style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.4)' }}>
          ✓ Free consultation &nbsp;·&nbsp; ✓ No credit card required &nbsp;·&nbsp; ✓ 30-day trial
        </p>

        {/* Logo bar */}
        <div style={{ marginTop: '3.5rem', paddingTop: '2.5rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginBottom: '1.25rem' }}>Deployed at utilities across SERC, WECC, and RFC regions</p>
          <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {['IOU / G&T', 'Co-op', 'ISO / RTO', 'Gen Owner', 'TO / GO'].map(t => (
              <span key={t} style={{ background: 'rgba(0,119,182,0.15)', border: '1px solid rgba(0,168,204,0.2)', borderRadius: 6, padding: '0.375rem 0.875rem', fontSize: '0.8125rem', fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>{t}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── PAIN ───────────────────────────────────────────────────────────────────
function Pain() {
  const items = [
    {
      icon: '⚠',
      title: 'Knowledge Gaps You Can\'t See',
      body: 'Your team can fill out evidence templates — but can they explain the intent behind CIP-002 Attachment 1 Criterion 2.1 without looking at their notes? In an audit, that gap is visible.',
      stat: '60%',
      statLabel: 'of PNC findings involve evidence that exists but can\'t be verbally defended — NERC CMEP',
      color: 'var(--color-warning)',
    },
    {
      icon: '$',
      title: 'Consultant Dependency That Never Ends',
      body: '$300–$450/hour for every standards interpretation question doesn\'t build your team\'s capability — it builds the consultant\'s retainer. You\'re creating dependency, not depth.',
      stat: '$80K+',
      statLabel: 'average annual consultant spend for mid-size utility audit preparation',
      color: 'var(--color-signal)',
    },
    {
      icon: '!',
      title: 'You Are the Ceiling of Your Program',
      body: 'If the knowledge lives only in you, your compliance program is one sick day, one resignation, one travel conflict away from being vulnerable. That\'s not a program — it\'s a single point of failure.',
      stat: '$1.54M',
      statLabel: 'maximum penalty per violation per day — NERC, 2025',
      color: 'var(--color-error)',
    },
  ]

  return (
    <section style={{ background: 'rgba(13,33,55,0.5)', padding: '5rem 1.5rem', borderTop: '1px solid rgba(0,168,204,0.1)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-signal)' }}>The Reality</span>
        </div>
        <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', lineHeight: 1.2, marginBottom: '3rem', maxWidth: 700 }}>
          Still Relying on Bootcamps That Don't Stick and Consultants at $400 an Hour?
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {items.map(item => (
            <div key={item.title} className="gap-card animate-pulse-warning" style={{ borderRadius: 12, padding: '2rem', background: 'rgba(10,22,40,0.8)' }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: `${item.color}22`, border: `1px solid ${item.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', fontSize: '1.125rem', fontWeight: 700, color: item.color }}>
                {item.icon}
              </div>
              <h3 style={{ fontWeight: 600, fontSize: '1.125rem', marginBottom: '0.75rem', color: '#fff' }}>{item.title}</h3>
              <p style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.65, fontSize: '0.9375rem', marginBottom: '1.25rem' }}>{item.body}</p>
              <div style={{ borderTop: `1px solid ${item.color}33`, paddingTop: '1rem' }}>
                <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '1.75rem', color: item.color, marginBottom: '0.25rem' }}>{item.stat}</div>
                <div style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{item.statLabel}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── SOLUTION ────────────────────────────────────────────────────────────────
function Solution() {
  const before = [
    'Knowledge siloed in the compliance manager',
    'Bootcamp training forgotten within 60 days',
    '$80K+ annual consultant spend for audit prep',
    'Analysts freeze on live auditor follow-ups',
    'No way to measure team readiness before the audit',
  ]
  const after = [
    'Every analyst can defend any requirement independently',
    'Always-on SME reinforces knowledge continuously',
    'Consultant spend reduced by 60–80%',
    'Team scores on readiness dashboard before audit day',
    'Zero findings on the audit report',
  ]

  return (
    <section style={{ padding: '5rem 1.5rem' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-verify)' }}>The CIPGuard Approach</span>
        </div>
        <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', lineHeight: 1.2, marginBottom: '1.5rem', maxWidth: 780 }}>
          An AI SME That Thinks Like an Auditor. Trains Like a Mentor.
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.75, maxWidth: 760, marginBottom: '1rem', fontSize: '1rem' }}>
          Most compliance training delivers information. CIPGuard delivers <em>interrogation</em>. It is the first AI platform built exclusively from the complete corpus of official NERC.com standards, CMEP guidance documents, lessons learned from real audit cycles, and NERC technical reference publications.
        </p>
        <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.75, maxWidth: 760, marginBottom: '2rem', fontSize: '1rem' }}>
          The platform doesn't lecture. It challenges. It asks the follow-up question your Regional Entity auditor would ask. It identifies the gap in your analyst's reasoning <em>before</em> the auditor does.
        </p>

        {/* Pull quote */}
        <blockquote style={{ background: 'rgba(0,119,182,0.1)', border: '1px solid rgba(0,168,204,0.25)', borderLeft: '3px solid var(--color-signal)', borderRadius: '0 8px 8px 0', padding: '1.25rem 1.5rem', marginBottom: '3rem', maxWidth: 680 }}>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontStyle: 'italic', lineHeight: 1.65, margin: 0, fontSize: '1rem' }}>
            "Unlike bootcamps that fade in 60 days, CIPGuard is available at 9 PM when your analyst has a question about EACMS scoping — and it doesn't just answer. It makes sure they understand."
          </p>
          <cite style={{ fontSize: '0.8125rem', color: 'var(--color-signal)', marginTop: '0.75rem', display: 'block', fontStyle: 'normal', fontWeight: 500 }}>— Platform Design Principle</cite>
        </blockquote>

        {/* Before / After */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', maxWidth: 900 }}>
          <div style={{ background: 'rgba(229,62,62,0.05)', border: '1px solid rgba(229,62,62,0.2)', borderRadius: 10, padding: '1.5rem' }}>
            <h4 style={{ fontWeight: 700, color: 'var(--color-error)', marginBottom: '1rem', fontSize: '0.9375rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Before CIPGuard</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {before.map(b => (
                <li key={b} style={{ display: 'flex', gap: '0.625rem', alignItems: 'flex-start', color: 'rgba(255,255,255,0.65)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--color-error)', marginTop: 2, flexShrink: 0 }}>✕</span>
                  {b}
                </li>
              ))}
            </ul>
          </div>

          <div style={{ background: 'rgba(0,201,167,0.05)', border: '1px solid rgba(0,201,167,0.25)', borderRadius: 10, padding: '1.5rem' }}>
            <h4 style={{ fontWeight: 700, color: 'var(--color-verify)', marginBottom: '1rem', fontSize: '0.9375rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>After CIPGuard</h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {after.map(a => (
                <li key={a} style={{ display: 'flex', gap: '0.625rem', alignItems: 'flex-start', color: 'rgba(255,255,255,0.65)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--color-verify)', marginTop: 2, flexShrink: 0 }}>✓</span>
                  {a}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── FEATURES ────────────────────────────────────────────────────────────────
function Features() {
  const features = [
    {
      label: 'CIP-002 to CIP-015',
      title: 'AI SME Challenge Interface',
      body: 'Your team doesn\'t just read about requirements — they get challenged on them. CIPGuard asks the same questions a Regional Entity auditor would ask, detects gaps in real time, and escalates the line of questioning until genuine understanding is demonstrated. Not a quiz. An interrogation that builds expertise.',
      metric: '3×',
      metricLabel: 'faster knowledge retention vs. traditional e-learning',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      ),
    },
    {
      label: 'Evidence Readiness',
      title: 'Evidence Substantiation Builder',
      body: 'For every requirement and sub-requirement across CIP-002 through CIP-015, CIPGuard maps the exact documentation types a Regional Entity auditor expects. Deficient evidence items immediately trigger SME review prompts — not after the audit, before it.',
      metric: '89%',
      metricLabel: 'reduction in audit evidence gaps in first cycle',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
        </svg>
      ),
    },
    {
      label: 'BES Classification',
      title: 'CIP-002 Classification Matrix',
      body: 'The most-cited source of audit findings is BES Cyber System misclassification. CIPGuard\'s interactive matrix walks your team through every Attachment 1 criterion, with branching logic, scoping guidance, and evidence rationale. Output: an exportable, audit-ready classification worksheet.',
      metric: '0',
      metricLabel: 'classification PNC findings for teams using this module',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
        </svg>
      ),
    },
    {
      label: 'Manager View',
      title: 'Team Readiness Dashboard',
      body: 'For compliance managers who need to see the whole picture before audit day arrives. Aggregates individual team member performance across all CIP standards, surfaces knowledge gaps by domain, and shows trending improvement curves. Stop wondering — know it before the auditor arrives.',
      metric: '6 wks',
      metricLabel: 'average time to measurable team readiness improvement',
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
      ),
    },
  ]

  return (
    <section style={{ background: 'rgba(13,33,55,0.4)', padding: '5rem 1.5rem', borderTop: '1px solid rgba(0,168,204,0.1)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-signal)' }}>Platform Capabilities</span>
        </div>
        <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', lineHeight: 1.2, marginBottom: '3rem', maxWidth: 600 }}>
          Every Feature Built Around One Question: Can Your Team Answer That?
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {features.map(f => (
            <div key={f.title} className="feature-card" style={{ borderRadius: 12, padding: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ color: 'var(--color-signal)', background: 'rgba(0,168,204,0.1)', borderRadius: 8, padding: '0.625rem' }}>{f.icon}</div>
                <span className="requirement-id" style={{ background: 'rgba(0,168,204,0.08)', padding: '0.25rem 0.625rem', borderRadius: 4 }}>{f.label}</span>
              </div>
              <h3 style={{ fontWeight: 600, fontSize: '1.0625rem', marginBottom: '0.75rem', color: '#fff' }}>{f.title}</h3>
              <p style={{ color: 'rgba(255,255,255,0.6)', lineHeight: 1.65, fontSize: '0.875rem', marginBottom: '1.25rem' }}>{f.body}</p>
              <div style={{ borderTop: '1px solid rgba(0,201,167,0.15)', paddingTop: '1rem' }}>
                <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '1.5rem', color: 'var(--color-verify)' }}>{f.metric}</span>
                <span style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.45)', marginLeft: '0.5rem' }}>{f.metricLabel}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── ROI CALCULATOR ──────────────────────────────────────────────────────────
function ROICalculator() {
  const [teamSize, setTeamSize] = useState(8)
  const [consultantSpend, setConsultantSpend] = useState(80000)
  const [mgrHours, setMgrHours] = useState(10)
  const [riskPct, setRiskPct] = useState(30)

  const consultantSavings = consultantSpend * 0.80
  const timeSavings = mgrHours * 85 * 52 * 0.75
  const riskReduction = (riskPct / 100) * 307000
  const platformCost = teamSize * 149 * 12
  const totalROI = consultantSavings + timeSavings + riskReduction - platformCost

  const fmt = v => '$' + Math.round(v).toLocaleString()

  const sliders = [
    { label: 'Compliance team members', value: teamSize, setValue: setTeamSize, min: 1, max: 50, step: 1, suffix: '' },
    { label: 'Annual consultant spend', value: consultantSpend, setValue: setConsultantSpend, min: 0, max: 300000, step: 5000, suffix: '' },
    { label: 'Hours/week answering team questions', value: mgrHours, setValue: setMgrHours, min: 0, max: 40, step: 1, suffix: ' hrs' },
    { label: 'Estimated risk of a PNC finding', value: riskPct, setValue: setRiskPct, min: 0, max: 100, step: 5, suffix: '%' },
  ]

  const outputs = [
    { label: 'Consultant Savings', value: fmt(consultantSavings), color: 'var(--color-verify)' },
    { label: 'Manager Time Value', value: fmt(timeSavings), color: 'var(--color-signal)' },
    { label: 'Audit Risk Reduction', value: fmt(riskReduction), color: 'var(--color-warning)' },
    { label: 'Platform Cost (est.)', value: '-' + fmt(platformCost), color: 'rgba(255,255,255,0.5)' },
  ]

  return (
    <section style={{ padding: '5rem 1.5rem' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-signal)' }}>Your Numbers</span>
        </div>
        <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', lineHeight: 1.2, marginBottom: '0.75rem' }}>
          Calculate Your Compliance Training ROI
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '3rem', maxWidth: 560 }}>
          See what it actually costs to keep relying on bootcamps, consultants, and yourself as the team's only real SME.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
          {/* Inputs */}
          <div style={{ background: 'rgba(13,33,55,0.8)', border: '1px solid rgba(0,168,204,0.15)', borderRadius: 12, padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {sliders.map(s => (
              <div key={s.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{s.label}</label>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-signal)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {s.suffix === '%' ? s.value + '%' : s.suffix === ' hrs' ? s.value + ' hrs' : s.label.includes('members') ? s.value : '$' + s.value.toLocaleString()}
                  </span>
                </div>
                <input
                  type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                  onChange={e => s.setValue(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--color-verify)', cursor: 'pointer' }}
                />
              </div>
            ))}
          </div>

          {/* Outputs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {outputs.map(o => (
              <div key={o.label} className="stat-card" style={{ borderRadius: 10, padding: '1.25rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9375rem', color: 'rgba(255,255,255,0.7)' }}>{o.label}</span>
                <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '1.25rem', color: o.color }}>{o.value}</span>
              </div>
            ))}
            <div style={{ background: totalROI >= 0 ? 'rgba(0,201,167,0.12)' : 'rgba(229,62,62,0.08)', border: `2px solid ${totalROI >= 0 ? 'var(--color-verify)' : 'var(--color-error)'}`, borderRadius: 10, padding: '1.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.5rem' }}>Total First-Year ROI</div>
              <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '2.25rem', color: totalROI >= 0 ? 'var(--color-verify)' : 'var(--color-error)' }}>{totalROI >= 0 ? '+' : ''}{fmt(totalROI)}</div>
            </div>
            <a href="#" className="cta-btn" style={{ textAlign: 'center', padding: '0.875rem', borderRadius: 8, fontSize: '0.9375rem', textDecoration: 'none', display: 'block' }}>
              Get Your Custom ROI Report →
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── SOCIAL PROOF ────────────────────────────────────────────────────────────
function SocialProof() {
  const testimonials = [
    {
      quote: '"CIPGuard caught a gap in our CIP-005 EACMS scoping that we\'d had for two audit cycles. It asked the follow-up question no one had ever asked us before."',
      name: 'Sarah K.',
      title: 'CIP Compliance Lead — G&T Cooperative',
    },
    {
      quote: '"We cut our external consultant spend by $65,000 in the first year. The team now handles CIP-013 supply chain reviews internally that we used to outsource entirely."',
      name: 'David P.',
      title: 'OT Security Manager — Fossil Generation',
    },
    {
      quote: '"My new analyst had never heard of a BES Cyber Asset when she joined. After eight weeks on CIPGuard, she handled a Regional Entity records request completely independently."',
      name: 'Lisa R.',
      title: 'Compliance Program Director — ISO',
    },
  ]

  const stats = [
    { value: '200+', label: 'Compliance Teams' },
    { value: '1,400+', label: 'Analysts Trained' },
    { value: '97%', label: 'Audit Pass Rate' },
    { value: '$12M+', label: 'Consultant Spend Eliminated' },
  ]

  return (
    <section style={{ background: 'rgba(13,33,55,0.5)', padding: '5rem 1.5rem', borderTop: '1px solid rgba(0,168,204,0.1)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-verify)' }}>Customer Results</span>
        </div>
        <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', lineHeight: 1.2, marginBottom: '3rem' }}>
          What Zero Findings Actually Looks Like
        </h2>

        {/* Featured Case Study */}
        <div style={{ background: 'linear-gradient(135deg, rgba(11,79,130,0.4), rgba(0,119,182,0.2))', border: '1px solid rgba(0,168,204,0.3)', borderRadius: 14, padding: '2.5rem', marginBottom: '2.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', color: 'var(--color-signal)', textTransform: 'uppercase', background: 'rgba(0,168,204,0.1)', padding: '0.25rem 0.625rem', borderRadius: 4 }}>▶ Mid-Size Investor-Owned Utility — SERC Region</span>
          </div>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            {[['0', 'Audit Findings'], ['74%', 'Consultant Cost Reduction'], ['6 wks', 'To Full Team Readiness']].map(([val, lab]) => (
              <div key={lab}>
                <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '2rem', color: 'var(--color-verify)' }}>{val}</div>
                <div style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.125rem' }}>{lab}</div>
              </div>
            ))}
          </div>
          <blockquote style={{ margin: 0 }}>
            <p style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, fontSize: '1rem', marginBottom: '0.75rem' }}>
              "Before CIPGuard, I was the ceiling of my team's knowledge. After six weeks on the platform, my junior analyst walked into a Regional Entity interview on CIP-002 classification and didn't need me in the room. That is the thing I'd been trying to build for three years."
            </p>
            <cite style={{ fontSize: '0.875rem', color: 'var(--color-signal)', fontStyle: 'normal', fontWeight: 500 }}>— Compliance Manager, Fossil & Renewables Generation Portfolio</cite>
          </blockquote>
        </div>

        {/* Testimonials */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '3rem' }}>
          {testimonials.map(t => (
            <div key={t.name} className="testimonial-card" style={{ borderRadius: 10, padding: '1.5rem' }}>
              <p style={{ color: 'rgba(255,255,255,0.8)', lineHeight: 1.65, fontSize: '0.9375rem', marginBottom: '1rem', fontStyle: 'italic' }}>{t.quote}</p>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fff' }}>{t.name}</div>
              <div style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.45)', marginTop: '0.125rem' }}>{t.title}</div>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
          {stats.map(s => (
            <div key={s.label} style={{ textAlign: 'center', padding: '1.5rem', background: 'rgba(10,22,40,0.6)', border: '1px solid rgba(0,168,204,0.12)', borderRadius: 10 }}>
              <div style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '1.875rem', color: 'var(--color-clear)', marginBottom: '0.25rem' }}>{s.value}</div>
              <div style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.5)' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── PRICING ─────────────────────────────────────────────────────────────────
function Pricing() {
  const [annual, setAnnual] = useState(false)

  const plans = [
    {
      name: 'Analyst',
      desc: 'For individual NERC CIP professionals building deep standard expertise.',
      monthly: 79,
      features: [
        'Full CIP-002 through CIP-015 SME access',
        'AI challenge sessions — unlimited',
        'Personal readiness score dashboard',
        'Evidence documentation guides',
        'NERC guidance library (full)',
      ],
      excluded: ['Team readiness dashboard', 'Classification matrix export'],
      cta: 'Start Free Trial',
      popular: false,
    },
    {
      name: 'Team',
      desc: 'For compliance managers building a team that doesn\'t need them in every room.',
      monthly: 149,
      features: [
        'Everything in Analyst',
        'Manager readiness dashboard',
        'Team gap heat map by standard',
        'CIP-002 Classification Matrix (exportable)',
        'Evidence substantiation builder',
        'Audit prep scenario simulations',
        'Progress reporting for leadership',
        'Priority support',
      ],
      excluded: [],
      cta: 'Start Free Trial',
      popular: true,
    },
    {
      name: 'Enterprise',
      desc: 'For large utilities, holding companies, and multi-region compliance programs.',
      monthly: null,
      features: [
        'Everything in Team',
        'Custom standards scope (NERC CIP + regional)',
        'SSO/SAML integration',
        'Dedicated CIP compliance success manager',
        'White-glove onboarding',
        'SLA guarantees',
        'Audit preparation co-piloting',
      ],
      excluded: [],
      cta: 'Schedule Demo',
      popular: false,
    },
  ]

  return (
    <section style={{ padding: '5rem 1.5rem' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ marginBottom: '1rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-signal)' }}>Transparent Pricing</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '3rem' }}>
          <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)', lineHeight: 1.2, maxWidth: 500, margin: 0 }}>
            Invest in Your Team's Depth. Not Your Consultants'.
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.875rem', color: annual ? 'rgba(255,255,255,0.4)' : '#fff', fontWeight: annual ? 400 : 600 }}>Monthly</span>
            <button
              onClick={() => setAnnual(!annual)}
              style={{ width: 44, height: 24, borderRadius: 100, background: annual ? 'var(--color-verify)' : 'rgba(255,255,255,0.15)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 200ms' }}
            >
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: annual ? 23 : 3, transition: 'left 200ms' }} />
            </button>
            <span style={{ fontSize: '0.875rem', color: annual ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: annual ? 600 : 400 }}>Annual <span style={{ color: 'var(--color-verify)', fontSize: '0.75rem' }}>Save 20%</span></span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
          {plans.map(p => {
            const price = p.monthly ? (annual ? Math.round(p.monthly * 0.8) : p.monthly) : null
            return (
              <div key={p.name} className={`pricing-card${p.popular ? ' popular' : ''}`} style={{ borderRadius: 12, padding: '2rem', position: 'relative', display: 'flex', flexDirection: 'column' }}>
                {p.popular && (
                  <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: 'var(--color-verify)', color: 'var(--color-void)', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em', padding: '0.25rem 0.875rem', borderRadius: 100, whiteSpace: 'nowrap' }}>
                    Most Popular
                  </div>
                )}
                <div style={{ marginBottom: '0.5rem' }}>
                  <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '1.25rem', color: '#fff' }}>{p.name}</span>
                </div>
                <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.55)', marginBottom: '1.25rem', lineHeight: 1.5 }}>{p.desc}</p>
                <div style={{ marginBottom: '1.5rem' }}>
                  {price ? (
                    <>
                      <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '2.25rem', color: '#fff' }}>${price}</span>
                      <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.875rem', marginLeft: '0.375rem' }}>/user/mo {annual ? '· billed annually' : '· billed monthly'}</span>
                    </>
                  ) : (
                    <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '1.75rem', color: '#fff' }}>Custom</span>
                  )}
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                  {p.features.map(f => (
                    <li key={f} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.875rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
                      <span style={{ color: 'var(--color-verify)', flexShrink: 0, marginTop: 1 }}>✓</span>
                      {f}
                    </li>
                  ))}
                  {p.excluded.map(f => (
                    <li key={f} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.875rem', color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>
                      <span style={{ flexShrink: 0, marginTop: 1 }}>–</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <a href="#" className={p.popular ? 'cta-btn' : 'secondary-btn'} style={{ textAlign: 'center', padding: '0.75rem', borderRadius: 8, fontSize: '0.9375rem', textDecoration: 'none', display: 'block', fontWeight: 700 }}>
                  {p.cta}
                </a>
              </div>
            )
          })}
        </div>

        <div style={{ textAlign: 'center', display: 'flex', gap: '1.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {['No credit card required', 'Cancel anytime', '30-day money-back guarantee', 'Setup in under 2 hours'].map(t => (
            <span key={t} style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span style={{ color: 'var(--color-verify)' }}>✓</span> {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── FINAL CTA ────────────────────────────────────────────────────────────────
function FinalCTA() {
  return (
    <section style={{ padding: '5rem 1.5rem', borderTop: '1px solid rgba(0,168,204,0.1)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(0,201,167,0.1)', border: '1px solid rgba(0,201,167,0.25)', borderRadius: 100, padding: '0.375rem 1rem', marginBottom: '1.75rem' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-verify)' }}>Zero Findings. Every Time.</span>
        </div>
        <h2 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 'clamp(2rem, 4vw, 3rem)', lineHeight: 1.15, marginBottom: '1.25rem' }}>
          Ready to Stop Being the Only Person Who Can Survive the Audit Room?
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, fontSize: '1.0625rem', marginBottom: '2.5rem' }}>
          Join 200+ NERC CIP compliance teams who have built programs that don't depend on one person being in every room.
        </p>
        <div style={{ display: 'flex', gap: '0.875rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="#" className="cta-btn" style={{ padding: '1rem 2.25rem', borderRadius: 8, fontSize: '1rem', textDecoration: 'none' }}>Schedule a Demo →</a>
          <a href="#" className="secondary-btn" style={{ padding: '1rem 2.25rem', borderRadius: 8, fontSize: '1rem', textDecoration: 'none' }}>Start Free Trial</a>
        </div>
      </div>
    </section>
  )
}

// ─── FOOTER ──────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ background: 'rgba(10,22,40,0.95)', borderTop: '1px solid rgba(0,168,204,0.1)', padding: '3rem 1.5rem' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: 'linear-gradient(135deg, #0077B6, #00C9A7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, color: '#fff', fontSize: '1rem' }}>CIPGuard™</span>
        </div>
        <p style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.35)', margin: 0 }}>
          © 2026 CIPGuard™ — AI-Powered NERC CIP Subject Matter Expert Training. Zero Findings. Every Time.
        </p>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          {['Privacy','Terms','Security'].map(l => (
            <a key={l} href="#" style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }} onMouseEnter={e => e.target.style.color='var(--color-signal)'} onMouseLeave={e => e.target.style.color='rgba(255,255,255,0.4)'}>{l}</a>
          ))}
        </div>
      </div>
    </footer>
  )
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Pain />
        <Solution />
        <Features />
        <ROICalculator />
        <SocialProof />
        <Pricing />
        <FinalCTA />
      </main>
      <Footer />
    </>
  )
}
