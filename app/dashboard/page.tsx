import Link from 'next/link'
import { supabaseAdmin } from '@/src/lib/supabase'
import { listClients } from '@/src/lib/client-loader'

interface DBClient {
  id: string
  name: string
  url: string
  industry: string
  city: string
  health_score?: number
  aeo_win_rate?: number
  content_queue?: number
  created_at?: string
}

interface AggregateStats {
  totalClients: number
  totalBlogPosts: number
  totalAeoTests: number
  avgHealthScore: number
}

async function getAggregateStats(): Promise<AggregateStats> {
  // Total clients
  const { count: totalClients } = await supabaseAdmin
    .schema('bloom_engine')
    .from('clients')
    .select('*', { count: 'exact', head: true })

  // Total blog posts
  const { count: totalBlogPosts } = await supabaseAdmin
    .schema('bloom_engine')
    .from('content_pieces')
    .select('*', { count: 'exact', head: true })
    .eq('channel', 'blog')

  // Total AEO tests
  const { count: totalAeoTests } = await supabaseAdmin
    .schema('bloom_engine')
    .from('aeo_queries')
    .select('*', { count: 'exact', head: true })

  // Avg health score from latest audits
  const { data: audits } = await supabaseAdmin
    .schema('bloom_engine')
    .from('seo_audits')
    .select('client_id, health_score, crawled_at')
    .order('crawled_at', { ascending: false })

  // Get latest audit per client
  const latestByClient = new Map<string, number>()
  for (const audit of (audits ?? []) as Array<{ client_id: string; health_score: number }>) {
    if (!latestByClient.has(audit.client_id)) {
      latestByClient.set(audit.client_id, audit.health_score)
    }
  }
  const scores = Array.from(latestByClient.values())
  const avgHealthScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0

  return {
    totalClients: totalClients ?? 0,
    totalBlogPosts: totalBlogPosts ?? 0,
    totalAeoTests: totalAeoTests ?? 0,
    avgHealthScore,
  }
}

async function getClientsWithStats(): Promise<DBClient[]> {
  const { data: clients } = await supabaseAdmin
    .schema('bloom_engine')
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  if (!clients || clients.length === 0) return []

  // Fetch latest health score per client
  const { data: audits } = await supabaseAdmin
    .schema('bloom_engine')
    .from('seo_audits')
    .select('client_id, health_score, crawled_at')
    .order('crawled_at', { ascending: false })

  const healthByClient = new Map<string, number>()
  for (const a of (audits ?? []) as Array<{ client_id: string; health_score: number }>) {
    if (!healthByClient.has(a.client_id)) {
      healthByClient.set(a.client_id, a.health_score)
    }
  }

  // Fetch AEO win rates
  const { data: aeoRows } = await supabaseAdmin
    .schema('bloom_engine')
    .from('aeo_queries')
    .select('client_id, client_cited')

  const aeoByClient = new Map<string, { total: number; cited: number }>()
  for (const row of (aeoRows ?? []) as Array<{ client_id: string; client_cited: boolean }>) {
    const prev = aeoByClient.get(row.client_id) ?? { total: 0, cited: 0 }
    aeoByClient.set(row.client_id, {
      total: prev.total + 1,
      cited: prev.cited + (row.client_cited ? 1 : 0),
    })
  }

  // Fetch content queue counts (draft status)
  const { data: contentRows } = await supabaseAdmin
    .schema('bloom_engine')
    .from('content_pieces')
    .select('client_id, status')
    .eq('status', 'draft')

  const queueByClient = new Map<string, number>()
  for (const row of (contentRows ?? []) as Array<{ client_id: string }>) {
    queueByClient.set(row.client_id, (queueByClient.get(row.client_id) ?? 0) + 1)
  }

  return (clients as DBClient[]).map((c) => {
    const aeo = aeoByClient.get(c.id)
    return {
      ...c,
      health_score: healthByClient.get(c.id),
      aeo_win_rate: aeo
        ? Math.round((aeo.cited / aeo.total) * 100)
        : undefined,
      content_queue: queueByClient.get(c.id) ?? 0,
    }
  })
}

function healthColor(score: number | undefined): string {
  if (score === undefined) return '#94A3B8'
  if (score >= 80) return '#00D4B4'
  if (score >= 60) return '#D4AF6A'
  return '#DC2626'
}

export default async function DashboardOverviewPage() {
  const [stats, clients] = await Promise.all([
    getAggregateStats(),
    getClientsWithStats(),
  ])

  return (
    <div style={{ padding: '40px 40px 60px', minHeight: '100vh' }}>
      <style>{`.add-client-card:hover { border-color: #D4AF6A !important; }`}</style>
      {/* Header */}
      <div style={{ marginBottom: '40px' }}>
        <h1
          style={{
            fontFamily: 'var(--font-playfair, "Playfair Display", serif)',
            fontSize: '42px',
            fontWeight: 700,
            color: '#EDEDED',
            margin: 0,
            lineHeight: 1.1,
            letterSpacing: '0.02em',
          }}
        >
          BLOOM ENGINE
        </h1>
        <div
          style={{
            fontFamily: 'var(--font-ibm-plex-mono, monospace)',
            fontSize: '11px',
            color: '#D4AF6A',
            letterSpacing: '0.2em',
            marginTop: '8px',
            textTransform: 'uppercase',
          }}
        >
          ANCHOR Intelligence Platform
        </div>
      </div>

      {/* Stat bar */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1px',
          background: '#262626',
          border: '1px solid #262626',
          marginBottom: '40px',
        }}
      >
        <StatCard label="Total Clients" value={String(stats.totalClients)} />
        <StatCard label="Blog Posts" value={String(stats.totalBlogPosts)} />
        <StatCard label="AEO Tests" value={String(stats.totalAeoTests)} />
        <StatCard
          label="Avg Health Score"
          value={stats.avgHealthScore > 0 ? `${stats.avgHealthScore}` : '—'}
          valueColor={healthColor(stats.avgHealthScore)}
        />
      </div>

      {/* Section label */}
      <div
        style={{
          fontFamily: 'var(--font-ibm-plex-mono, monospace)',
          fontSize: '10px',
          color: '#94A3B8',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          marginBottom: '20px',
        }}
      >
        Client Empire
      </div>

      {/* Client grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '16px',
        }}
      >
        {clients.map((client) => (
          <ClientCard key={client.id} client={client} />
        ))}

        {/* Add New Client card */}
        <Link
          href="/dashboard/add-client"
          style={{ textDecoration: 'none' }}
        >
          <div
            className="add-client-card"
            style={{
              background: '#161616',
              border: '1px dashed #262626',
              borderRadius: '2px',
              padding: '32px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              minHeight: '200px',
              cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                border: '1px dashed #D4AF6A',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#D4AF6A',
                fontSize: '24px',
                fontWeight: 300,
              }}
            >
              +
            </div>
            <div
              style={{
                fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                fontSize: '10px',
                color: '#94A3B8',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
              }}
            >
              Add New Client
            </div>
          </div>
        </Link>
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: '60px',
          paddingTop: '24px',
          borderTop: '1px solid #262626',
          textAlign: 'center',
          fontFamily: 'var(--font-ibm-plex-mono, monospace)',
          fontSize: '9px',
          color: '#94A3B8',
          letterSpacing: '0.15em',
          opacity: 0.5,
        }}
      >
        Powered by ANCHOR × BLOOM ENGINE
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  valueColor = '#EDEDED',
}: {
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <div
      style={{
        background: '#161616',
        padding: '24px 28px',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-ibm-plex-mono, monospace)',
          fontSize: '9px',
          color: '#94A3B8',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
          marginBottom: '10px',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-playfair, "Playfair Display", serif)',
          fontSize: '36px',
          fontWeight: 700,
          color: valueColor,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
    </div>
  )
}

function ClientCard({ client }: { client: DBClient }) {
  const score = client.health_score
  const color = healthColor(score)

  return (
    <div
      style={{
        background: '#161616',
        border: '1px solid #262626',
        borderRadius: '2px',
        padding: '28px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '0',
      }}
    >
      {/* Health score */}
      <div
        style={{
          fontFamily: 'var(--font-playfair, "Playfair Display", serif)',
          fontSize: '72px',
          fontWeight: 700,
          color,
          lineHeight: 1,
          marginBottom: '12px',
        }}
      >
        {score !== undefined ? score : '—'}
      </div>

      {/* Client name */}
      <div
        style={{
          fontFamily: 'var(--font-inter, Inter, sans-serif)',
          fontSize: '15px',
          fontWeight: 600,
          color: '#EDEDED',
          marginBottom: '4px',
        }}
      >
        {client.name}
      </div>

      {/* URL */}
      <div
        style={{
          fontFamily: 'var(--font-ibm-plex-mono, monospace)',
          fontSize: '10px',
          color: '#94A3B8',
          marginBottom: '12px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {client.url}
      </div>

      {/* Industry badge */}
      <div style={{ marginBottom: '16px' }}>
        <span
          style={{
            fontFamily: 'var(--font-ibm-plex-mono, monospace)',
            fontSize: '9px',
            color: '#D4AF6A',
            background: 'rgba(212, 175, 106, 0.1)',
            border: '1px solid rgba(212, 175, 106, 0.2)',
            borderRadius: '2px',
            padding: '3px 8px',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          {client.industry}
        </span>
      </div>

      {/* Mini stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          marginBottom: '20px',
          paddingTop: '16px',
          borderTop: '1px solid #262626',
        }}
      >
        <div>
          <div
            style={{
              fontFamily: 'var(--font-ibm-plex-mono, monospace)',
              fontSize: '8px',
              color: '#94A3B8',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginBottom: '4px',
            }}
          >
            AEO Win Rate
          </div>
          <div
            style={{
              fontFamily: 'var(--font-playfair, serif)',
              fontSize: '22px',
              fontWeight: 700,
              color:
                client.aeo_win_rate === undefined
                  ? '#94A3B8'
                  : client.aeo_win_rate > 50
                    ? '#00D4B4'
                    : client.aeo_win_rate >= 25
                      ? '#D4AF6A'
                      : '#DC2626',
            }}
          >
            {client.aeo_win_rate !== undefined ? `${client.aeo_win_rate}%` : '—'}
          </div>
        </div>
        <div>
          <div
            style={{
              fontFamily: 'var(--font-ibm-plex-mono, monospace)',
              fontSize: '8px',
              color: '#94A3B8',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginBottom: '4px',
            }}
          >
            Content Queue
          </div>
          <div
            style={{
              fontFamily: 'var(--font-playfair, serif)',
              fontSize: '22px',
              fontWeight: 700,
              color: '#EDEDED',
            }}
          >
            {client.content_queue ?? 0}
          </div>
        </div>
      </div>

      {/* CTA button */}
      <Link
        href={`/dashboard/${client.id}`}
        style={{
          display: 'block',
          background: 'transparent',
          border: '1px solid #D4AF6A',
          borderRadius: '2px',
          padding: '10px 16px',
          color: '#D4AF6A',
          fontFamily: 'var(--font-ibm-plex-mono, monospace)',
          fontSize: '10px',
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          textDecoration: 'none',
          textAlign: 'center',
          transition: 'background 0.15s, color 0.15s',
        }}
      >
        Open Dashboard →
      </Link>
    </div>
  )
}
