import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/src/lib/supabase'
import { loadClientConfig } from '@/src/lib/client-loader'
import SEOHealthPanel from './components/SEOHealthPanel'
import AEOPanel from './components/AEOPanel'
import ContentPanel from './components/ContentPanel'
import SchemaPanel from './components/SchemaPanel'

interface AuditRow {
  id: string
  client_id: string
  health_score: number
  critical_issues: number
  high_issues: number
  pages_crawled: number
  crawled_at: string
  issues: Array<{
    type: string
    severity: 'critical' | 'high' | 'medium' | 'low'
    description: string
    recommendation: string
    fixContent?: string
  }>
  site_checks: Record<string, boolean>
}

interface AEORow {
  id: string
  query_text: string
  client_cited: boolean
  client_url: string | null
  competitors: string[]
  last_tested: string | null
  recommendations: string[]
}

interface ContentRow {
  id: string
  channel: string
  title: string
  body: string
  status: string
  scheduled_for: string | null
  published_at: string | null
  created_at: string
  meta_title?: string
  meta_description?: string
}

interface SchemaRow {
  id: string
  schema_type: string
  schema_data: object
  generated_at: string
  installed: boolean
}

async function getAuditData(clientId: string) {
  const { data: latest } = await supabaseAdmin
    .schema('bloom_engine')
    .from('seo_audits')
    .select('*')
    .eq('client_id', clientId)
    .order('crawled_at', { ascending: false })
    .limit(1)
    .single()

  const { data: history } = await supabaseAdmin
    .schema('bloom_engine')
    .from('seo_audits')
    .select('id, crawled_at, health_score, critical_issues, high_issues, pages_crawled')
    .eq('client_id', clientId)
    .order('crawled_at', { ascending: false })
    .limit(5)

  return {
    latest: latest as AuditRow | null,
    history: (history ?? []) as Array<{
      id: string
      crawled_at: string
      health_score: number
      critical_issues: number
      high_issues: number
      pages_crawled: number
    }>,
  }
}

async function getAEOData(clientId: string) {
  const { data } = await supabaseAdmin
    .schema('bloom_engine')
    .from('aeo_queries')
    .select('*')
    .eq('client_id', clientId)
    .order('last_tested', { ascending: false, nullsFirst: false })

  return (data ?? []) as AEORow[]
}

async function getContentData(clientId: string) {
  const { data } = await supabaseAdmin
    .schema('bloom_engine')
    .from('content_pieces')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(100)

  return (data ?? []) as ContentRow[]
}

async function getSchemaData(clientId: string) {
  const { data } = await supabaseAdmin
    .schema('bloom_engine')
    .from('schema_registry')
    .select('*')
    .eq('client_id', clientId)
    .order('schema_type', { ascending: true })

  return (data ?? []) as SchemaRow[]
}

export default async function ClientDashboardPage({
  params,
}: {
  params: { clientId: string }
}) {
  const { clientId } = params

  // Verify client exists
  let clientConfig
  try {
    clientConfig = await loadClientConfig(clientId)
  } catch {
    notFound()
  }

  // Fetch all panel data in parallel
  const [auditData, aeoRows, contentRows, schemaRows] = await Promise.all([
    getAuditData(clientId),
    getAEOData(clientId),
    getContentData(clientId),
    getSchemaData(clientId),
  ])

  return (
    <div style={{ padding: '40px 40px 80px' }}>
      {/* Page header */}
      <div style={{ marginBottom: '40px' }}>
        <div
          style={{
            fontFamily: 'var(--font-ibm-plex-mono, monospace)',
            fontSize: '9px',
            color: '#94A3B8',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            marginBottom: '8px',
          }}
        >
          Client Dashboard
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-playfair, "Playfair Display", serif)',
            fontSize: '36px',
            fontWeight: 700,
            color: '#EDEDED',
            margin: 0,
            lineHeight: 1.1,
          }}
        >
          {clientConfig.name}
        </h1>
        <div
          style={{
            fontFamily: 'var(--font-ibm-plex-mono, monospace)',
            fontSize: '11px',
            color: '#D4AF6A',
            marginTop: '6px',
          }}
        >
          {clientConfig.url}
        </div>
      </div>

      {/* Panels */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* Panel 1: SEO Health */}
        <SEOHealthPanel
          clientId={clientId}
          latestAudit={auditData.latest}
          auditHistory={auditData.history}
        />

        {/* Panel 2: AEO Citation Intelligence */}
        <AEOPanel
          clientId={clientId}
          aeoRows={aeoRows}
          clientConfig={clientConfig}
        />

        {/* Panel 3: Content Command Center */}
        <ContentPanel
          clientId={clientId}
          contentRows={contentRows}
          clientConfig={clientConfig}
        />

        {/* Panel 4: Schema Status */}
        <SchemaPanel
          clientId={clientId}
          schemaRows={schemaRows}
        />
      </div>
    </div>
  )
}
