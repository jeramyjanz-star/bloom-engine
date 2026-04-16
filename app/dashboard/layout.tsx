import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Playfair_Display, IBM_Plex_Mono, Inter } from 'next/font/google'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
})

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
  // Secondary auth check — middleware handles the primary redirect
  const cookieStore = cookies()
  const authCookie = cookieStore.get('bloom_auth')
  const adminPassword = process.env.BLOOM_ADMIN_PASSWORD

  if (!authCookie || !adminPassword) {
    redirect('/dashboard/login')
  }

  const decoded = Buffer.from(authCookie.value, 'base64').toString('utf-8')
  if (decoded !== adminPassword) {
    redirect('/dashboard/login')
  }

  return (
    <html
      lang="en"
      className={`${playfair.variable} ${ibmPlexMono.variable} ${inter.variable}`}
    >
      <head />
      <body
        style={{
          ['--bloom-bg' as string]: '#0D0D0D',
          ['--bloom-card' as string]: '#161616',
          ['--bloom-border' as string]: '#262626',
          ['--bloom-gold' as string]: '#D4AF6A',
          ['--bloom-teal' as string]: '#00D4B4',
          ['--bloom-crimson' as string]: '#DC2626',
          ['--bloom-steel' as string]: '#94A3B8',
          background: '#0D0D0D',
          color: '#EDEDED',
          fontFamily: 'var(--font-inter), sans-serif',
          margin: 0,
          padding: 0,
        }}
      >
        <div style={{ display: 'flex', minHeight: '100vh' }}>
          {/* Sidebar */}
          <aside
            style={{
              width: '220px',
              minWidth: '220px',
              background: '#161616',
              borderRight: '1px solid #262626',
              display: 'flex',
              flexDirection: 'column',
              padding: '0',
              position: 'sticky',
              top: 0,
              height: '100vh',
              overflowY: 'auto',
            }}
          >
            {/* Logo */}
            <div
              style={{
                padding: '28px 20px 24px',
                borderBottom: '1px solid #262626',
              }}
            >
              <Link href="/dashboard" style={{ textDecoration: 'none' }}>
                <div
                  style={{
                    fontFamily: 'var(--font-playfair), serif',
                    fontSize: '18px',
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #D4AF6A 0%, #F0D08A 50%, #D4AF6A 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
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

            {/* Nav */}
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

            {/* Bottom anchor */}
            <div
              style={{
                padding: '16px 20px',
                borderTop: '1px solid #262626',
              }}
            >
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
      </body>
    </html>
  )
}

function SidebarLink({
  href,
  label,
  icon,
}: {
  href: string
  label: string
  icon: string
}) {
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
        transition: 'color 0.15s',
      }}
    >
      <span style={{ color: '#D4AF6A', fontSize: '10px' }}>{icon}</span>
      {label}
    </Link>
  )
}
