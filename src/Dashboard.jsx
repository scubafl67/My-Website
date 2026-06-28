import { useState } from 'react'
import { useAuth } from './context/AuthContext'
import CIPStandards from './components/CIPStandards'
import KnowledgeBase from './components/KnowledgeBase'
import ProfilePanel from './components/ProfilePanel'

// Authenticated view: NERC CIP connector content + weather + profile.
// Only rendered for signed-in users (gated in App.jsx).
export default function Dashboard() {
  const { user, signOut } = useAuth()
  const [tab, setTab] = useState('standards')

  const displayName =
    user.user_metadata?.full_name?.trim() || user.email?.split('@')[0]

  const tabs = [
    { id: 'standards', label: 'CIP Standards' },
    { id: 'knowledge', label: 'Knowledge Base' },
    { id: 'profile', label: 'Profile' },
  ]

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Top bar */}
      <nav style={{ background: 'rgba(10,22,40,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(0,168,204,0.15)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div style={{ width: 32, height: 32, borderRadius: 6, background: 'linear-gradient(135deg, #0077B6, #00C9A7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: '1.125rem', color: '#fff' }}>CIPGuard™</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.65)' }} className="hidden md:inline">
              {displayName}
            </span>
            <button onClick={signOut} className="secondary-btn" style={{ padding: '0.5rem 1.125rem', borderRadius: 6, fontSize: '0.875rem', cursor: 'pointer' }}>
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '2rem 1.5rem 4rem' }}>
        {/* Welcome header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontFamily: 'Sora, sans-serif', fontWeight: 700, fontSize: 'clamp(1.5rem, 3vw, 2rem)', color: '#fff', margin: '0 0 0.375rem' }}>
            Welcome back, {displayName}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', margin: 0 }}>
            Your NERC CIP standards library and compliance workspace.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid rgba(0,168,204,0.15)', marginBottom: '2rem' }}>
          {tabs.map((t) => (
            <button
              key={t.id} onClick={() => setTab(t.id)}
              style={{
                padding: '0.75rem 1.25rem', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.9375rem', fontWeight: 600,
                color: tab === t.id ? '#fff' : 'rgba(255,255,255,0.5)',
                borderBottom: `2px solid ${tab === t.id ? 'var(--color-verify)' : 'transparent'}`,
                marginBottom: -1,
              }}
            >{t.label}</button>
          ))}
        </div>

        {tab === 'standards' && <CIPStandards />}
        {tab === 'knowledge' && <KnowledgeBase />}
        {tab === 'profile' && (
          <div style={{ maxWidth: 720 }}>
            <ProfilePanel />
          </div>
        )}
      </main>
    </div>
  )
}
