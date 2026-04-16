'use client'

import { useState, useEffect, FormEvent } from 'react'

export default function AuthWrapper({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false)
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwLoading, setPwLoading] = useState(false)

  const [email, setEmail] = useState('')
  const [mlSent, setMlSent] = useState(false)
  const [mlError, setMlError] = useState('')
  const [mlLoading, setMlLoading] = useState(false)

  useEffect(() => {
    // Check magic link param first
    const params = new URLSearchParams(window.location.search)
    const ml = params.get('ml')
    if (ml === '1') {
      localStorage.setItem('bloom_authenticated', 'true')
      // Clean URL
      const clean = window.location.pathname
      window.history.replaceState({}, '', clean)
      setAuthenticated(true)
      setReady(true)
      return
    }
    if (ml === 'expired') {
      setPwError('Magic link expired — request a new one below')
      const clean = window.location.pathname
      window.history.replaceState({}, '', clean)
    }
    if (ml === 'error') {
      setPwError('Invalid magic link — try again')
      const clean = window.location.pathname
      window.history.replaceState({}, '', clean)
    }

    const stored = localStorage.getItem('bloom_authenticated')
    if (stored === 'true') setAuthenticated(true)
    setReady(true)
  }, [])

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault()
    setPwError('')
    setPwLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        localStorage.setItem('bloom_authenticated', 'true')
        setAuthenticated(true)
      } else {
        const data = await res.json() as { error?: string }
        setPwError(data.error ?? 'Invalid password')
      }
    } catch {
      setPwError('Network error — please try again')
    } finally {
      setPwLoading(false)
    }
  }

  async function handleMagicLink(e: FormEvent) {
    e.preventDefault()
    setMlError('')
    setMlLoading(true)
    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.ok) {
        setMlSent(true)
      } else {
        const data = await res.json() as { error?: string }
        setMlError(data.error ?? 'Failed to send link')
      }
    } catch {
      setMlError('Network error — please try again')
    } finally {
      setMlLoading(false)
    }
  }

  if (!ready) return null
  if (authenticated) return <>{children}</>

  return (
    <div style={{
      minHeight: '100vh', background: '#0D0D0D', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, sans-serif', padding: '20px',
    }}>
      <div style={{
        width: '100%', maxWidth: '400px', background: '#161616',
        border: '1px solid #262626', borderRadius: '2px', padding: '48px 40px',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#D4AF6A', letterSpacing: '0.06em' }}>
            BLOOM ENGINE
          </div>
          <div style={{
            fontSize: '10px', color: '#94A3B8', letterSpacing: '0.2em',
            marginTop: '8px', textTransform: 'uppercase', fontFamily: 'monospace',
          }}>
            ANCHOR Intelligence Platform
          </div>
        </div>

        <div style={{ height: '1px', background: '#262626', marginBottom: '32px' }} />

        {/* Password form */}
        <form onSubmit={handlePasswordSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block', fontFamily: 'monospace', fontSize: '10px',
              color: '#94A3B8', letterSpacing: '0.15em',
              textTransform: 'uppercase', marginBottom: '8px',
            }}>
              Access Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoFocus
                placeholder="Enter dashboard password"
                style={{
                  width: '100%', background: '#0D0D0D',
                  border: `1px solid ${pwError ? '#DC2626' : '#262626'}`,
                  borderRadius: '2px', padding: '12px 44px 12px 14px', color: '#EDEDED',
                  fontFamily: 'monospace', fontSize: '14px', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{
                  position: 'absolute', right: '12px', top: '50%',
                  transform: 'translateY(-50%)', background: 'none', border: 'none',
                  cursor: 'pointer', color: '#94A3B8', fontSize: '16px', padding: '2px',
                  lineHeight: 1,
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          {pwError && (
            <div style={{
              background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)',
              borderRadius: '2px', padding: '10px 14px', marginBottom: '20px',
              fontFamily: 'monospace', fontSize: '11px', color: '#DC2626',
            }}>
              {pwError}
            </div>
          )}

          <button type="submit" disabled={pwLoading} style={{
            width: '100%',
            background: pwLoading ? '#262626' : 'linear-gradient(135deg, #D4AF6A 0%, #B8943A 100%)',
            border: 'none', borderRadius: '2px', padding: '13px',
            color: pwLoading ? '#94A3B8' : '#0D0D0D', fontFamily: 'monospace',
            fontSize: '11px', fontWeight: 600, letterSpacing: '0.15em',
            textTransform: 'uppercase', cursor: pwLoading ? 'not-allowed' : 'pointer',
          }}>
            {pwLoading ? 'AUTHENTICATING...' : 'ACCESS DASHBOARD'}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '28px 0' }}>
          <div style={{ flex: 1, height: '1px', background: '#262626' }} />
          <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#94A3B8', letterSpacing: '0.1em' }}>
            OR
          </span>
          <div style={{ flex: 1, height: '1px', background: '#262626' }} />
        </div>

        {/* Magic link form */}
        {mlSent ? (
          <div style={{
            background: 'rgba(0,212,180,0.08)', border: '1px solid rgba(0,212,180,0.25)',
            borderRadius: '2px', padding: '14px 16px', textAlign: 'center',
            fontFamily: 'monospace', fontSize: '11px', color: '#00D4B4', letterSpacing: '0.05em',
          }}>
            Magic link sent — check your inbox
          </div>
        ) : (
          <form onSubmit={handleMagicLink}>
            <div style={{ marginBottom: '12px' }}>
              <label style={{
                display: 'block', fontFamily: 'monospace', fontSize: '10px',
                color: '#94A3B8', letterSpacing: '0.15em',
                textTransform: 'uppercase', marginBottom: '8px',
              }}>
                Get a magic link
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
                style={{
                  width: '100%', background: '#0D0D0D',
                  border: `1px solid ${mlError ? '#DC2626' : '#262626'}`,
                  borderRadius: '2px', padding: '12px 14px', color: '#EDEDED',
                  fontFamily: 'monospace', fontSize: '14px', outline: 'none',
                  boxSizing: 'border-box', marginBottom: '12px',
                }}
              />
              {mlError && (
                <div style={{
                  background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)',
                  borderRadius: '2px', padding: '10px 14px', marginBottom: '12px',
                  fontFamily: 'monospace', fontSize: '11px', color: '#DC2626',
                }}>
                  {mlError}
                </div>
              )}
              <button type="submit" disabled={mlLoading} style={{
                width: '100%', background: 'transparent',
                border: '1px solid #262626', borderRadius: '2px', padding: '12px',
                color: mlLoading ? '#94A3B8' : '#EDEDED', fontFamily: 'monospace',
                fontSize: '11px', fontWeight: 500, letterSpacing: '0.15em',
                textTransform: 'uppercase', cursor: mlLoading ? 'not-allowed' : 'pointer',
              }}>
                {mlLoading ? 'SENDING...' : 'SEND MAGIC LINK'}
              </button>
            </div>
          </form>
        )}

        <div style={{
          textAlign: 'center', marginTop: '28px', fontFamily: 'monospace',
          fontSize: '9px', color: '#94A3B8', letterSpacing: '0.1em', opacity: 0.5,
        }}>
          Powered by ANCHOR × BLOOM ENGINE
        </div>
      </div>
    </div>
  )
}
