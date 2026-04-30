'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface InvitePayload {
  clientId: string
  email: string
  role: string
  exp: number
}

function decodeInviteToken(token: string): InvitePayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as InvitePayload
    if (!payload.email || !payload.clientId || !payload.exp) return null
    if (Date.now() > payload.exp) return null
    return payload
  } catch {
    return null
  }
}

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>()
  const [payload, setPayload] = useState<InvitePayload | null>(null)
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'expired'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const decoded = decodeInviteToken(token)
    if (!decoded) {
      setStatus('expired')
    } else {
      setPayload(decoded)
      setEmail(decoded.email)
    }
  }, [token])

  const handleAccept = async () => {
    setStatus('loading')
    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, inviteToken: token }),
      })
      if (res.ok) {
        setStatus('success')
      } else {
        const data = await res.json() as { error?: string }
        setErrorMsg(data.error ?? 'Failed to send access link')
        setStatus('error')
      }
    } catch {
      setErrorMsg('Network error — please try again')
      setStatus('error')
    }
  }

  if (status === 'expired') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f3' }}>
        <div style={{ maxWidth: 400, padding: '40px 24px', textAlign: 'center', fontFamily: 'Georgia, serif' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏰</div>
          <h1 style={{ fontSize: 22, color: '#1c1917', marginBottom: 12 }}>Invitation Expired</h1>
          <p style={{ color: '#78716c', fontSize: 14, lineHeight: 1.6 }}>
            This invitation link has expired. Please ask the site owner to send a new invite.
          </p>
        </div>
      </div>
    )
  }

  if (!payload) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f3' }}>
        <div style={{ color: '#78716c' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fdf8f3', fontFamily: 'Georgia, serif' }}>
      <div style={{ maxWidth: 420, width: '100%', padding: '40px 24px', background: '#fff', borderRadius: 16, border: '1px solid #e8d5c4', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>✿</div>
          <h1 style={{ fontSize: 22, color: '#1c1917', margin: '0 0 8px', fontWeight: 600 }}>You&apos;re Invited</h1>
          <p style={{ color: '#78716c', fontSize: 13, margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{payload.clientId.toUpperCase()} Dashboard</p>
        </div>

        {status === 'success' ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✉️</div>
            <p style={{ color: '#1c1917', fontSize: 15, lineHeight: 1.6 }}>
              Check your inbox at <strong>{email}</strong> for your access link.
            </p>
          </div>
        ) : (
          <>
            <p style={{ color: '#57534e', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              You&apos;ve been invited as a <strong>{payload.role}</strong>. Click below and we&apos;ll email you a sign-in link.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#78716c', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Your email</label>
              <input
                type="email"
                value={email}
                readOnly
                style={{ width: '100%', padding: '10px 12px', border: '1px solid #e8d5c4', borderRadius: 8, fontSize: 14, color: '#1c1917', background: '#fdf8f3', boxSizing: 'border-box' }}
              />
            </div>

            {status === 'error' && (
              <p style={{ color: '#be185d', fontSize: 13, marginBottom: 12 }}>{errorMsg}</p>
            )}

            <button
              onClick={handleAccept}
              disabled={status === 'loading'}
              style={{ width: '100%', padding: '12px 24px', background: '#be185d', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: status === 'loading' ? 0.7 : 1 }}
            >
              {status === 'loading' ? 'Sending...' : 'Send My Access Link'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
