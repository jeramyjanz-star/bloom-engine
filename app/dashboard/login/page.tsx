'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (res.ok) {
        router.push('/dashboard')
        router.refresh()
      } else {
        const data = await res.json() as { error?: string }
        setError(data.error ?? 'Invalid password')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0D0D0D',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-inter, Inter, sans-serif)',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          background: '#161616',
          border: '1px solid #262626',
          borderRadius: '2px',
          padding: '48px 40px',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div
            style={{
              fontFamily: 'var(--font-playfair, "Playfair Display", serif)',
              fontSize: '32px',
              fontWeight: 700,
              background: 'linear-gradient(135deg, #D4AF6A 0%, #F0D08A 50%, #D4AF6A 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              letterSpacing: '0.06em',
              lineHeight: 1.2,
            }}
          >
            BLOOM ENGINE
          </div>
          <div
            style={{
              fontFamily: 'var(--font-ibm-plex-mono, "IBM Plex Mono", monospace)',
              fontSize: '10px',
              color: '#94A3B8',
              letterSpacing: '0.2em',
              marginTop: '8px',
              textTransform: 'uppercase',
            }}
          >
            ANCHOR Intelligence Platform
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            height: '1px',
            background: 'linear-gradient(90deg, transparent, #262626, transparent)',
            marginBottom: '32px',
          }}
        />

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                fontSize: '10px',
                color: '#94A3B8',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                marginBottom: '8px',
              }}
            >
              Access Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter dashboard password"
              style={{
                width: '100%',
                background: '#0D0D0D',
                border: '1px solid #262626',
                borderRadius: '2px',
                padding: '12px 14px',
                color: '#EDEDED',
                fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#D4AF6A' }}
              onBlur={(e) => { e.target.style.borderColor = '#262626' }}
            />
          </div>

          {error && (
            <div
              style={{
                background: 'rgba(220, 38, 38, 0.1)',
                border: '1px solid rgba(220, 38, 38, 0.3)',
                borderRadius: '2px',
                padding: '10px 14px',
                marginBottom: '20px',
                fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                fontSize: '11px',
                color: '#DC2626',
                letterSpacing: '0.05em',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: loading
                ? '#262626'
                : 'linear-gradient(135deg, #D4AF6A 0%, #B8943A 100%)',
              border: 'none',
              borderRadius: '2px',
              padding: '13px',
              color: loading ? '#94A3B8' : '#0D0D0D',
              fontFamily: 'var(--font-ibm-plex-mono, monospace)',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.15s',
            }}
          >
            {loading ? 'AUTHENTICATING...' : 'ACCESS DASHBOARD'}
          </button>
        </form>

        {/* Footer */}
        <div
          style={{
            textAlign: 'center',
            marginTop: '32px',
            fontFamily: 'var(--font-ibm-plex-mono, monospace)',
            fontSize: '9px',
            color: '#94A3B8',
            letterSpacing: '0.1em',
            opacity: 0.5,
          }}
        >
          Powered by ANCHOR × BLOOM ENGINE
        </div>
      </div>
    </div>
  )
}
