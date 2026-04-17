import Anthropic from '@anthropic-ai/sdk'
import type { ClientConfig } from '@/src/lib/client-loader'
import { loadClientConfig } from '@/src/lib/client-loader'
import { supabaseAdmin } from '@/src/lib/supabase'
import { sendWeeklyReportEmail } from '@/src/lib/agents/gmb-approval-gate'
import { getGMBAccessToken, sendTelegramMessage } from '@/src/lib/agents/gmb-posting-engine'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WeeklyMetrics {
  weekStart: string          // ISO date of Monday
  profileViews: number
  websiteClicks: number
  directionRequests: number
  calls: number
  photoViews: number
  topPostId?: string
  topPostViews?: number
  topPostContent?: string    // first 100 chars of top post
  aeoCitationRate?: number   // percentage
  seoHealth?: number         // score out of 100
  aiInsight?: string
}

interface GBPMetricValue {
  metric: string
  dimensionalValues?: Array<{ value?: string }>
}

interface GBPLocationMetrics {
  metricValues?: GBPMetricValue[]
}

interface GBPInsightsResponse {
  locationMetrics?: GBPLocationMetrics[]
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Returns the ISO date string (YYYY-MM-DD) for the most recent Monday */
function getLastMonday(): string {
  const d = new Date()
  const day = d.getDay() // 0=Sun, 1=Mon … 6=Sat
  // If today is Sunday (0), go back 6 days; otherwise go back (day - 1) days
  const daysBack = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - daysBack)
  return d.toISOString().split('T')[0]
}

/** Returns the ISO date string for the Monday before lastMonday (i.e. 7 days prior) */
function getPreviousMonday(lastMonday: string): string {
  const d = new Date(lastMonday)
  d.setDate(d.getDate() - 7)
  return d.toISOString().split('T')[0]
}

// ---------------------------------------------------------------------------
// GBP Insights API fetch
// ---------------------------------------------------------------------------

async function fetchGBPInsightsFromAPI(
  accountId: string,
  locationId: string,
  accessToken: string,
  weekStart: string
): Promise<Partial<WeeklyMetrics>> {
  const thisMonday = weekStart
  // endTime is the Monday after weekStart (exclusive upper bound)
  const endDate = new Date(weekStart)
  endDate.setDate(endDate.getDate() + 7)
  const endTime = endDate.toISOString()
  const startTime = new Date(thisMonday).toISOString()

  const url = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}:reportInsights`

  const body = {
    locationNames: [`accounts/${accountId}/locations/${locationId}`],
    basicRequest: {
      metricRequests: [
        { metric: 'QUERIES_DIRECT' },
        { metric: 'QUERIES_INDIRECT' },
        { metric: 'VIEWS_MAPS' },
        { metric: 'VIEWS_SEARCH' },
        { metric: 'ACTIONS_WEBSITE' },
        { metric: 'ACTIONS_PHONE' },
        { metric: 'ACTIONS_DRIVING_DIRECTIONS' },
        { metric: 'PHOTOS_VIEWS_MERCHANT' },
      ],
      timeRange: {
        startTime,
        endTime,
      },
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`GBP Insights API error (${res.status}): ${errBody}`)
  }

  const data = (await res.json()) as GBPInsightsResponse
  const metricValues = data.locationMetrics?.[0]?.metricValues ?? []

  // Extract scalar value from dimensionalValues[0].value (it's a string number)
  function extractValue(metric: string): number {
    const entry = metricValues.find((m) => m.metric === metric)
    const raw = entry?.dimensionalValues?.[0]?.value
    if (!raw) return 0
    const n = parseInt(raw, 10)
    return isNaN(n) ? 0 : n
  }

  const queriesDirect = extractValue('QUERIES_DIRECT')
  const queriesIndirect = extractValue('QUERIES_INDIRECT')
  const viewsMaps = extractValue('VIEWS_MAPS')
  const viewsSearch = extractValue('VIEWS_SEARCH')

  return {
    profileViews: queriesDirect + queriesIndirect + viewsMaps + viewsSearch,
    websiteClicks: extractValue('ACTIONS_WEBSITE'),
    calls: extractValue('ACTIONS_PHONE'),
    directionRequests: extractValue('ACTIONS_DRIVING_DIRECTIONS'),
    photoViews: extractValue('PHOTOS_VIEWS_MERCHANT'),
  }
}

// ---------------------------------------------------------------------------
// Supabase supplementary data fetches
// ---------------------------------------------------------------------------

async function fetchTopPost(
  clientId: string,
  weekStart: string
): Promise<{ topPostId?: string; topPostViews?: number; topPostContent?: string }> {
  try {
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    const { data, error } = await supabaseAdmin
      .schema('bloom_engine')
      .from('gmb_post_log')
      .select('id, views, content')
      .eq('client_id', clientId)
      .eq('status', 'posted')
      .gte('posted_at', new Date(weekStart).toISOString())
      .lt('posted_at', weekEnd.toISOString())
      .order('views', { ascending: false })
      .limit(1)

    if (error || !data || data.length === 0) return {}

    const top = data[0] as { id: string; views: number; content: string }

    // Parse the JSON content to extract the headline/body for the snippet
    let snippet = ''
    try {
      const parsed = JSON.parse(top.content) as { headline?: string; body?: string }
      const text = `${parsed.headline ?? ''} ${parsed.body ?? ''}`.trim()
      snippet = text.slice(0, 100)
    } catch {
      snippet = top.content.slice(0, 100)
    }

    return {
      topPostId: top.id,
      topPostViews: top.views,
      topPostContent: snippet,
    }
  } catch (err) {
    console.warn('[gmb-performance-tracker] fetchTopPost error:', String(err))
    return {}
  }
}

async function fetchAEOCitationRate(clientId: string): Promise<number | undefined> {
  try {
    const { data, error } = await supabaseAdmin
      .schema('bloom_engine')
      .from('aeo_queries')
      .select('client_cited')
      .eq('client_id', clientId)

    if (error || !data || data.length === 0) return undefined

    const rows = data as Array<{ client_cited: boolean }>
    const cited = rows.filter((r) => r.client_cited === true).length
    const rate = Math.round((cited / rows.length) * 100)
    return rate
  } catch (err) {
    console.warn('[gmb-performance-tracker] fetchAEOCitationRate error:', String(err))
    return undefined
  }
}

async function fetchSEOHealthScore(clientId: string): Promise<number | undefined> {
  try {
    const { data, error } = await supabaseAdmin
      .schema('bloom_engine')
      .from('seo_audits')
      .select('score')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (error || !data || data.length === 0) return undefined

    const row = data[0] as { score: number }
    return row.score
  } catch (err) {
    console.warn('[gmb-performance-tracker] fetchSEOHealthScore error:', String(err))
    return undefined
  }
}

// ---------------------------------------------------------------------------
// Main: fetchGMBInsights
// ---------------------------------------------------------------------------

export async function fetchGMBInsights(clientId: string): Promise<WeeklyMetrics> {
  const weekStart = getPreviousMonday(getLastMonday())

  const clientIdUpper = clientId.toUpperCase().replace(/-/g, '_')
  const accountId = process.env[`GMB_ACCOUNT_ID_${clientIdUpper}`]
  const locationId = process.env[`GMB_LOCATION_ID_${clientIdUpper}`]

  // Base metrics object with zero values — used when API credentials are missing
  const baseMetrics: WeeklyMetrics = {
    weekStart,
    profileViews: 0,
    websiteClicks: 0,
    directionRequests: 0,
    calls: 0,
    photoViews: 0,
  }

  // Fetch GBP API metrics (gracefully degrade if credentials are missing)
  let apiMetrics: Partial<WeeklyMetrics> = {}
  if (accountId && locationId) {
    try {
      const accessToken = await getGMBAccessToken(clientId)
      apiMetrics = await fetchGBPInsightsFromAPI(accountId, locationId, accessToken, weekStart)
    } catch (err) {
      console.warn(
        `[gmb-performance-tracker] GBP API call failed for "${clientId}", using zero metrics:`,
        String(err)
      )
    }
  } else {
    console.warn(
      `[gmb-performance-tracker] Missing GMB_ACCOUNT_ID_${clientIdUpper} or GMB_LOCATION_ID_${clientIdUpper} — returning zero metrics.`
    )
  }

  // Fetch supplementary data in parallel
  const [topPostData, aeoCitationRate, seoHealth] = await Promise.all([
    fetchTopPost(clientId, weekStart),
    fetchAEOCitationRate(clientId),
    fetchSEOHealthScore(clientId),
  ])

  return {
    ...baseMetrics,
    ...apiMetrics,
    ...topPostData,
    ...(aeoCitationRate !== undefined ? { aeoCitationRate } : {}),
    ...(seoHealth !== undefined ? { seoHealth } : {}),
  }
}

// ---------------------------------------------------------------------------
// generateAIInsight
// ---------------------------------------------------------------------------

export async function generateAIInsight(
  metrics: WeeklyMetrics,
  config: ClientConfig
): Promise<string> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const metricsText = [
    `Profile Views: ${metrics.profileViews}`,
    `Website Clicks: ${metrics.websiteClicks}`,
    `Direction Requests: ${metrics.directionRequests}`,
    `Calls: ${metrics.calls}`,
    `Photo Views: ${metrics.photoViews}`,
    metrics.aeoCitationRate !== undefined
      ? `AEO Citation Rate: ${metrics.aeoCitationRate}%`
      : null,
    metrics.seoHealth !== undefined ? `SEO Health Score: ${metrics.seoHealth}/100` : null,
    metrics.topPostViews !== undefined
      ? `Top Post Views: ${metrics.topPostViews}`
      : null,
    metrics.topPostContent
      ? `Top Post Preview: "${metrics.topPostContent}"`
      : null,
  ]
    .filter(Boolean)
    .join('\n')

  const prompt = `Based on these Google Business Profile metrics for the week of ${metrics.weekStart}, write a 2-sentence insight and one specific actionable recommendation for a ${config.industry} business.

Metrics:
${metricsText}

Business: ${config.name} in ${config.location.city}, ${config.location.state}

Keep it concise, specific, and actionable. Do NOT use corporate buzzwords.`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    return raw || 'No insight available this week.'
  } catch (err) {
    console.warn('[gmb-performance-tracker] generateAIInsight failed:', String(err))
    return 'No insight available this week.'
  }
}

// ---------------------------------------------------------------------------
// runWeeklyReport
// ---------------------------------------------------------------------------

export async function runWeeklyReport(clientId: string): Promise<void> {
  // 1. Load client config
  const config = await loadClientConfig(clientId)

  // 2. Fetch metrics
  const metrics = await fetchGMBInsights(clientId)

  // 3. Save to gmb_metrics (upsert on client_id + week_start)
  const { error: upsertError } = await supabaseAdmin
    .schema('bloom_engine')
    .from('gmb_metrics')
    .upsert(
      {
        client_id: clientId,
        week_start: metrics.weekStart,
        profile_views: metrics.profileViews,
        website_clicks: metrics.websiteClicks,
        direction_requests: metrics.directionRequests,
        calls: metrics.calls,
        photo_views: metrics.photoViews,
        top_post_id: metrics.topPostId ?? null,
        top_post_views: metrics.topPostViews ?? 0,
      },
      { onConflict: 'client_id,week_start' }
    )

  if (upsertError) {
    console.error(
      `[gmb-performance-tracker] Failed to upsert gmb_metrics for "${clientId}":`,
      upsertError.message
    )
  }

  // 4. Generate AI insight
  const insight = await generateAIInsight(metrics, config)

  // Update the row with the AI insight
  await supabaseAdmin
    .schema('bloom_engine')
    .from('gmb_metrics')
    .update({ ai_insight: insight })
    .eq('client_id', clientId)
    .eq('week_start', metrics.weekStart)

  // 5. Add insight to metrics object
  const metricsWithInsight: WeeklyMetrics = { ...metrics, aiInsight: insight }

  // 6. Send weekly report email
  await sendWeeklyReportEmail(clientId, config, metricsWithInsight)

  // 7. Send Telegram summary to Jeramy
  const telegramMsg = [
    `📊 *Weekly GMB Report — ${config.name}*`,
    `Week of: ${metrics.weekStart}`,
    ``,
    `👁 Profile Views: ${metrics.profileViews.toLocaleString()}`,
    `🌐 Website Clicks: ${metrics.websiteClicks.toLocaleString()}`,
    `📍 Directions: ${metrics.directionRequests.toLocaleString()}`,
    `📞 Calls: ${metrics.calls.toLocaleString()}`,
    `📷 Photo Views: ${metrics.photoViews.toLocaleString()}`,
    metrics.aeoCitationRate !== undefined
      ? `🤖 AEO Citation Rate: ${metrics.aeoCitationRate}%`
      : null,
    metrics.seoHealth !== undefined ? `🔍 SEO Health: ${metrics.seoHealth}/100` : null,
    metrics.topPostViews !== undefined
      ? `🏆 Top Post Views: ${metrics.topPostViews.toLocaleString()}`
      : null,
    ``,
    `💡 ${insight}`,
  ]
    .filter((line) => line !== null)
    .join('\n')

  try {
    await sendTelegramMessage(telegramMsg)
  } catch (err) {
    console.warn('[gmb-performance-tracker] Telegram notification failed:', String(err))
  }

  console.info(`[gmb-performance-tracker] Weekly report completed for "${clientId}"`)
}
