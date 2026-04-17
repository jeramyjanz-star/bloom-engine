import Anthropic from '@anthropic-ai/sdk'
import type { ClientConfig } from '@/src/lib/client-loader'
import type { GMBPost } from '@/src/lib/content-engine'
import { supabaseAdmin } from '@/src/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GeneratedPost extends GMBPost {
  postType: string
  seasonalTopic: string
  qualityScore: number
  attemptCount: number
}

// ---------------------------------------------------------------------------
// Day-of-week → post type mapping
// ---------------------------------------------------------------------------

const DAY_POST_TYPE: Record<number, GMBPost['type']> = {
  1: 'update',   // Monday   — seasonal/timely
  2: 'offer',    // Tuesday  — service spotlight
  3: 'update',   // Wednesday — behind-the-stems process story
  4: 'update',   // Thursday  — social proof / client story
  5: 'offer',    // Friday    — weekend offer
  6: 'product',  // Saturday  — visual/arrangement focus
  0: 'event',    // Sunday    — upcoming event or general
}

function getPostTypeForToday(): GMBPost['type'] {
  const dow = new Date().getDay() // 0 = Sunday … 6 = Saturday
  return DAY_POST_TYPE[dow] ?? 'update'
}

// ---------------------------------------------------------------------------
// Seasonal topic awareness
// ---------------------------------------------------------------------------

export function getSeasonalTopic(month: number, config: ClientConfig): string {
  const topics: Record<number, string> = {
    1:  'Winter arrangements and fresh-start florals for the new year in Orange County',
    2:  'Valentine\'s Day luxury bouquets and romance arrangements',
    3:  'Spring awakening — ranunculus season and fresh spring blooms',
    4:  'Spring weddings, Easter florals, and Mother\'s Day prep in Orange County',
    5:  'Mother\'s Day peak season — bespoke bouquets and same-day delivery',
    6:  'Wedding season peak — ceremony arches and reception centrepieces',
    7:  'Summer arrangements — tropical blooms and outdoor event florals OC',
    8:  'Late summer wedding season and back-to-school office florals',
    9:  'Fall florals — dahlias, sunflowers, and autumn wedding arrangements',
    10: 'Harvest season arrangements and Halloween/fall event florals',
    11: 'Thanksgiving centerpieces and holiday floral prep',
    12: 'Holiday floral season — Christmas arrangements, corporate gifts, New Year\'s events',
  }
  return topics[month] ?? `Seasonal florals and arrangements from ${config.name}`
}

// ---------------------------------------------------------------------------
// Anti-repetition: fetch last 30 post bodies from Supabase
// ---------------------------------------------------------------------------

async function getRecentPostSnippets(clientId: string): Promise<string[]> {
  try {
    const { data, error } = await supabaseAdmin
      .schema('bloom_engine')
      .from('gmb_post_log')
      .select('content')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) {
      console.warn('[gmb-content-brain] Could not fetch recent posts:', error.message)
      return []
    }

    return (data ?? []).map((row: { content: string }) => row.content).filter(Boolean)
  } catch (err) {
    console.warn('[gmb-content-brain] Exception fetching recent posts:', String(err))
    return []
  }
}

// ---------------------------------------------------------------------------
// Quality checks
// ---------------------------------------------------------------------------

const AI_SLOP = [
  'we are excited to',
  'we are thrilled',
  'we pride ourselves',
  'we are delighted',
  'leveraging',
  'utilize',
  'cutting-edge',
  'game-changer',
]

function passesQualityChecks(
  post: GMBPost,
  config: ClientConfig
): { pass: boolean; reasons: string[] } {
  const reasons: string[] = []

  // 1. No AI slop phrases (case-insensitive)
  const fullText = `${post.headline} ${post.body} ${post.cta}`.toLowerCase()
  for (const slop of AI_SLOP) {
    if (fullText.includes(slop.toLowerCase())) {
      reasons.push(`Contains AI slop phrase: "${slop}"`)
    }
  }

  // 2. Total length under 1500 chars
  const totalLength = post.headline.length + post.body.length + post.cta.length
  if (totalLength >= 1500) {
    reasons.push(`Total length ${totalLength} chars exceeds 1500 char limit`)
  }

  // 3. Contains at least one service city, "Orange County", or "OC"
  const locationTerms = [
    ...config.location.serviceCities,
    'Orange County',
    'OC',
  ]
  const hasLocation = locationTerms.some((term) =>
    fullText.includes(term.toLowerCase())
  )
  if (!hasLocation) {
    reasons.push('No local reference found (service city, Orange County, or OC)')
  }

  // 4. Non-empty CTA
  if (!post.cta || post.cta.trim().length === 0) {
    reasons.push('CTA is empty')
  }

  return { pass: reasons.length === 0, reasons }
}

// ---------------------------------------------------------------------------
// Self-evaluation: score 1-10 for brand voice authenticity
// ---------------------------------------------------------------------------

async function evaluatePost(
  post: GMBPost,
  config: ClientConfig,
  anthropic: Anthropic
): Promise<number> {
  const evalPrompt = `You are evaluating a Google Business Profile post for ${config.name}, a ${config.industry} in ${config.location.city}.
Brand voice: ${config.brand.voice}

POST TO EVALUATE:
Headline: ${post.headline}
Body: ${post.body}
CTA: ${post.cta}

Score this post 1–10 for brand voice authenticity:
- 10 = Sounds exactly like the business owner wrote it; vivid, local, personal, zero corporate-speak
- 7-9 = Mostly authentic, minor generic phrases
- 4-6 = Mix of authentic and generic/AI-sounding content
- 1-3 = Generic, corporate, or clearly AI-generated tone

Reply with ONLY a single integer (1–10), nothing else.`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8,
      messages: [{ role: 'user', content: evalPrompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : '0'
    const score = parseInt(raw, 10)
    return isNaN(score) ? 0 : Math.min(10, Math.max(1, score))
  } catch (err) {
    console.warn('[gmb-content-brain] Evaluation call failed:', String(err))
    return 0
  }
}

// ---------------------------------------------------------------------------
// Core generation: calls Anthropic directly with the enhanced system prompt
// ---------------------------------------------------------------------------

async function generatePostDirect(
  postType: GMBPost['type'],
  seasonalTopic: string,
  config: ClientConfig,
  recentPosts: string[],
  anthropic: Anthropic
): Promise<GMBPost> {
  const typeGuidance: Record<GMBPost['type'], string> = {
    update:  'a business update or timely story post',
    offer:   'a special offer or promotion post',
    event:   'an event announcement post',
    product: 'a product highlight post',
  }

  const recentPostsSnippet =
    recentPosts.length > 0
      ? recentPosts.slice(0, 10).join(' | ')
      : 'None yet'

  const systemPrompt = `You are the voice of ${config.name}, a ${config.industry} in ${config.location.city}, ${config.location.state}.
Brand voice: ${config.brand.voice}
You write Google Business Profile posts that feel personal, local, and premium — never corporate, never generic, never AI-sounding.
Every post must:
- Open with a hook (NOT 'We are excited to...' — ever. Not 'We are thrilled'. Start with something specific, vivid, or local)
- Include at least one specific local reference (neighborhood, season, current month, local event)
- End with a soft, natural CTA
- Be under 1,500 characters total (headline + body + cta combined)
- Sound like the business owner wrote it on a good day
- Previous posts to avoid repeating: ${recentPostsSnippet}`

  const userPrompt = `Write a Google Business Profile ${typeGuidance[postType]} about: "${seasonalTopic}" for ${config.name}.

Requirements:
- Headline: compelling, 60–80 characters — do NOT start with "We are excited" or "We are thrilled"
- Body: approximately 150 words, on-brand, naturally includes a local reference to ${config.location.city} or Orange County
- CTA line: a single action sentence (e.g. "Book online at ${config.url}", "Call us today")
${postType === 'offer' ? '- offerDetails: one sentence summarizing the offer terms\n' : ''}
Output ONLY a JSON object with no markdown fencing:
{
  "headline": "...",
  "body": "...",
  "cta": "..."${postType === 'offer' ? ',\n  "offerDetails": "..."' : ''}
}`

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

  let parsed: Partial<GMBPost & { offerDetails?: string }> = {}
  try {
    parsed = JSON.parse(cleaned) as Partial<GMBPost & { offerDetails?: string }>
  } catch {
    // Use fallback values below
  }

  return {
    type: postType,
    headline: parsed.headline ?? seasonalTopic.slice(0, 80),
    body: parsed.body ?? cleaned.slice(0, 300),
    cta: parsed.cta ?? `Visit ${config.url} to learn more.`,
    ...(postType === 'offer' && parsed.offerDetails
      ? { offerDetails: parsed.offerDetails }
      : {}),
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function generateDailyPost(
  clientId: string,
  config: ClientConfig
): Promise<GeneratedPost> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const now = new Date()
  const postType = getPostTypeForToday()
  const seasonalTopic = getSeasonalTopic(now.getMonth() + 1, config)

  // Fetch recent posts for anti-repetition
  const recentPosts = await getRecentPostSnippets(clientId)

  const MAX_ATTEMPTS = 3
  let bestPost: GMBPost | null = null
  let bestScore = 0
  let attemptCount = 0

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    attemptCount = attempt

    let post: GMBPost
    try {
      post = await generatePostDirect(
        postType,
        seasonalTopic,
        config,
        recentPosts,
        anthropic
      )
    } catch (err) {
      console.warn(`[gmb-content-brain] Generation attempt ${attempt} failed:`, String(err))
      continue
    }

    // Quality checks
    const { pass, reasons } = passesQualityChecks(post, config)
    if (!pass) {
      console.warn(`[gmb-content-brain] Attempt ${attempt} failed quality checks:`, reasons)
      if (!bestPost) bestPost = post // keep as fallback
      continue
    }

    // Self-evaluation
    const score = await evaluatePost(post, config, anthropic)
    console.info(`[gmb-content-brain] Attempt ${attempt} quality score: ${score}/10`)

    if (score > bestScore) {
      bestScore = score
      bestPost = post
    }

    if (score >= 8) {
      // Good enough — stop regenerating
      break
    }

    // Score < 8: try again unless we've hit max attempts
    if (attempt < MAX_ATTEMPTS) {
      console.info(`[gmb-content-brain] Score ${score} < 8, regenerating (attempt ${attempt + 1}/${MAX_ATTEMPTS})`)
    }
  }

  // If all attempts failed quality checks, bestPost may still be null
  // Fall back to a minimal valid post
  if (!bestPost) {
    console.warn('[gmb-content-brain] All attempts failed. Returning minimal fallback post.')
    bestPost = {
      type: postType,
      headline: seasonalTopic.slice(0, 80),
      body: `${config.name} in ${config.location.city} brings you beautiful, hand-crafted floral arrangements for every occasion. Our team creates bespoke designs tailored to your vision. Whether it's a wedding, corporate event, or everyday luxury, we're here for you in Orange County.`,
      cta: `Visit ${config.url} to explore our collections.`,
    }
    bestScore = 0
  }

  return {
    ...bestPost,
    postType,
    seasonalTopic,
    qualityScore: bestScore,
    attemptCount,
  }
}
