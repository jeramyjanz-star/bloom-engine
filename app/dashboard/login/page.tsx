export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const errorMsg =
    searchParams.error === 'invalid'
      ? 'Invalid password'
      : searchParams.error === 'missing'
      ? 'Password required'
      : searchParams.error === 'config'
      ? 'Server configuration error'
      : null

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0D0D0D',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, sans-serif',
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
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div
            style={{
              fontSize: '28px',
              fontWeight: 700,
              color: '#D4AF6A',
              letterSpacing: '0.06em',
            }}
          >
            BLOOM ENGINE
          </div>
          <div
            style={{
              fontSize: '10px',
              color: '#94A3B8',
              letterSpacing: '0.2em',
              marginTop: '8px',
              textTransform: 'uppercase',
              fontFamily: 'monospace',
            }}
          >
            ANCHOR Intelligence Platform
          </div>
        </div>

        <div style={{ height: '1px', background: '#262626', marginBottom: '32px' }} />

        <form action="/api/auth/login" method="POST">
          <div style={{ marginBottom: '20px' }}>
            <label
              htmlFor="password"
              style={{
                display: 'block',
                fontFamily: 'monospace',
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
              id="password"
              type="password"
              name="password"
              required
              autoFocus
              placeholder="Enter dashboard password"
              style={{
                width: '100%',
                background: '#0D0D0D',
                border: `1px solid ${errorMsg ? '#DC2626' : '#262626'}`,
                borderRadius: '2px',
                padding: '12px 14px',
                color: '#EDEDED',
                fontFamily: 'monospace',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {errorMsg && (
            <div
              style={{
                background: 'rgba(220, 38, 38, 0.1)',
                border: '1px solid rgba(220, 38, 38, 0.3)',
                borderRadius: '2px',
                padding: '10px 14px',
                marginBottom: '20px',
                fontFamily: 'monospace',
                fontSize: '11px',
                color: '#DC2626',
                letterSpacing: '0.05em',
              }}
            >
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            style={{
              width: '100%',
              background: 'linear-gradient(135deg, #D4AF6A 0%, #B8943A 100%)',
              border: 'none',
              borderRadius: '2px',
              padding: '13px',
              color: '#0D0D0D',
              fontFamily: 'monospace',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            ACCESS DASHBOARD
          </button>
        </form>

        <div
          style={{
            textAlign: 'center',
            marginTop: '32px',
            fontFamily: 'monospace',
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
