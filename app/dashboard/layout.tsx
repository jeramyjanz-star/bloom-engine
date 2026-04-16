import Link from 'next/link'
import { IBM_Plex_Mono, Inter } from 'next/font/google'
import AuthWrapper from './auth-wrapper'

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthWrapper>
      <div
        className={`${ibmPlexMono.variable} ${inter.variable}`}
        style={{
          display: 'flex',
          minHeight: '100vh',
          background: '#0D0D0D',
          color: '#EDEDED',
          fontFamily: 'var(--font-inter), sans-serif',
        }}
      >
        {/* Sidebar */}
        <aside
          style={{
            width: '220px',
            minWidth: '220px',
            background: '#161616',
            borderRight: '1px solid #262626',
            display: 'flex',
            flexDirection: 'column',
            position: 'sticky',
            top: 0,
            height: '100vh',
            overflowY: 'auto',
          }}
        >
          <div style={{ padding: '28px 20px 24px', borderBottom: '1px solid #262626' }}>
            <Link href="/dashboard" style={{ textDecoration: 'none' }}>
              <div
                style={{
                  fontFamily: 'var(--font-ibm-plex-mono), monospace',
                  fontSize: '18px',
                  fontWeight: 700,
                  color: '#D4AF6A',
                  letterSpacing: '0.05em',
                  lineHeight: 1.2,
                }}
              >
                BLOOM ENGINE
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-ibm-plex-mono), monospace',
                  fontSize: '9px',
                  color: '#94A3B8',
                  letterSpacing: '0.12em',
                  marginTop: '4px',
                }}
              >
                INTELLIGENCE PLATFORM
              </div>
            </Link>
          </div>

          <nav style={{ padding: '16px 0', flex: 1 }}>
            <div
              style={{
                fontFamily: 'var(--font-ibm-plex-mono), monospace',
                fontSize: '9px',
                color: '#94A3B8',
                letterSpacing: '0.15em',
                padding: '0 20px 8px',
                textTransform: 'uppercase',
              }}
            >
              Navigation
            </div>
            <SidebarLink href="/dashboard" label="Overview" icon="◈" />
            <SidebarLink href="/dashboard" label="Client List" icon="◇" />
          </nav>

          <div style={{ padding: '16px 20px', borderTop: '1px solid #262626' }}>
            <div
              style={{
                fontFamily: 'var(--font-ibm-plex-mono), monospace',
                fontSize: '9px',
                color: '#D4AF6A',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                opacity: 0.8,
              }}
            >
              ANCHOR Intelligence
            </div>
            <div
              style={{
                fontFamily: 'var(--font-ibm-plex-mono), monospace',
                fontSize: '8px',
                color: '#94A3B8',
                marginTop: '4px',
                opacity: 0.6,
              }}
            >
              v1.0.0
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, minWidth: 0, overflowX: 'hidden' }}>
          {children}
        </main>
      </div>
    </AuthWrapper>
  )
}

function SidebarLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 20px',
        color: '#94A3B8',
        textDecoration: 'none',
        fontFamily: 'var(--font-inter), sans-serif',
        fontSize: '13px',
        fontWeight: 500,
      }}
    >
      <span style={{ color: '#D4AF6A', fontSize: '10px' }}>{icon}</span>
      {label}
    </Link>
  )
}
