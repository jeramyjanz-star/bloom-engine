/**
 * BLOOM ENGINE — Generate ALL FBOC Content
 * Generates: 12 blog posts, 7 location pages, 30 GMB posts, 25 Q&A blocks, 90-day calendar
 * Usage: doppler run --project anchor-lumen --config prd -- npx ts-node --project tsconfig.json scripts/generate-fboc-all.ts
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs/promises'
import path from 'path'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const CLIENT_ID = 'fboc'
const CLIENT_NAME = 'French Blooms OC'
const CLIENT_URL = 'https://frenchbloomsoc.com'
const INDUSTRY = 'florist'
const CITY = 'Orange County'
const STATE = 'CA'
const BRAND_VOICE = 'luxury, French-inspired, warm, elegant — like a trusted friend who happens to be an expert florist'

const BLOG_TOPICS: Array<{ topic: string; keyword: string }> = [
  { topic: 'How to Choose the Perfect Wedding Florist in Orange County', keyword: 'wedding florist Orange County' },
  { topic: 'Top Spring Floral Arrangements for Orange County Weddings', keyword: 'spring wedding flowers Orange County' },
  { topic: 'Corporate Flower Accounts: Why Irvine Businesses Choose Fresh Florals', keyword: 'corporate florist Irvine' },
  { topic: 'Baby Shower Flower Ideas for Newport Beach Celebrations', keyword: 'baby shower flowers Newport Beach' },
  { topic: 'French-Inspired Floral Design: What Sets It Apart', keyword: 'French florist Orange County' },
  { topic: 'Same-Day Flower Delivery in Irvine and Orange County', keyword: 'same day flower delivery Irvine' },
  { topic: 'Anniversary Flower Arrangements for Orange County Couples', keyword: 'anniversary flowers Orange County' },
  { topic: 'Behind the Stems: How French Blooms OC Sources Premium Flowers', keyword: 'premium florist Orange County' },
  { topic: 'Event Floral Design for Laguna Beach and Newport Beach Venues', keyword: 'event florist Laguna Beach' },
  { topic: 'Office Flowers for Irvine Companies: Elevate Your Workspace', keyword: 'office flowers Irvine' },
  { topic: "Mother's Day Flowers in Orange County: Order Early Guide", keyword: "Mother's Day flowers Orange County" },
  { topic: 'Why French Floral Aesthetic Is Trending in Southern California', keyword: 'French floral design California' },
]

const CITIES = ['Irvine', 'Newport Beach', 'Costa Mesa', 'Laguna Beach', 'Huntington Beach', 'Anaheim', 'Orange']

const GMB_TOPICS: Array<{ type: 'update' | 'offer' | 'event' | 'product'; topic: string }> = [
  // Week 1 — Spring / Mother's Day
  { type: 'product', topic: 'Spring garden-inspired arrangement featuring ranunculus and sweet peas' },
  { type: 'update', topic: "Mother's Day pre-order now open — limited availability for luxury bouquets" },
  { type: 'event', topic: "Mother's Day weekend pickup and delivery schedule announcement" },
  { type: 'offer', topic: '10% off first corporate floral account setup through May' },
  { type: 'update', topic: 'New French tulip varieties just arrived from Dutch growers' },
  { type: 'product', topic: 'Signature blush and ivory wedding bouquet collection for 2026' },
  { type: 'update', topic: 'Now booking spring and summer wedding florals for Orange County' },
  // Week 2 — Corporate
  { type: 'update', topic: 'Corporate floral subscriptions: weekly, biweekly, and monthly plans available' },
  { type: 'offer', topic: 'Free setup consultation for new Irvine corporate floral accounts' },
  { type: 'product', topic: 'Low-maintenance orchid arrangements for executive offices' },
  { type: 'update', topic: 'Serving 12 Newport Beach corporate clients this spring — join them' },
  { type: 'event', topic: 'Office flower delivery window: Monday and Wednesday mornings' },
  { type: 'update', topic: 'Custom branded vase options now available for corporate accounts' },
  { type: 'product', topic: 'Conference room statement arrangements — elevate your next meeting' },
  // Week 3 — Wedding Season
  { type: 'update', topic: '2026 wedding season bookings: 4 remaining dates in June' },
  { type: 'event', topic: 'Bridal consultation open house at our Orange County studio' },
  { type: 'product', topic: 'Garden-style ceremony arch with blush peonies and eucalyptus' },
  { type: 'update', topic: 'Outdoor Newport Beach reception table designs — portfolio spotlight' },
  { type: 'offer', topic: 'Book your 2026 wedding florals and receive a complimentary tasting arrangement' },
  { type: 'update', topic: 'Rehearsal dinner floral packages now available alongside full wedding packages' },
  { type: 'product', topic: 'Bridesmaid bouquet trio in French dusty rose and sage' },
  // Week 4 — Brand / Behind the Stems
  { type: 'update', topic: 'Behind the stems: how we source seasonal blooms each week' },
  { type: 'update', topic: 'Meet Jocelyn: the story behind French Blooms OC' },
  { type: 'product', topic: 'Baby shower balloon-free luxury arrangement — elevated and elegant' },
  { type: 'event', topic: 'Spring baby shower feature: soft blush and white arrangements for Laguna Beach event' },
  { type: 'offer', topic: 'Anniversary bundle: arrangement + keepsake vase + personal note — special pricing' },
  { type: 'update', topic: 'Same-day delivery available for Irvine, Newport Beach, and Costa Mesa' },
  { type: 'product', topic: 'Dried and pressed flower preservation service for wedding bouquets' },
  { type: 'update', topic: 'French Blooms OC now accepting inquiry forms for all 2026 holiday events' },
  { type: 'update', topic: 'Sustainable sourcing: locally grown California flowers in every seasonal arrangement' },
  { type: 'offer', topic: 'Refer a friend to French Blooms OC and receive 15% off your next order' },
]

const AEO_QUERIES = [
  'What is the best florist in Orange County?',
  'Who does wedding flowers in Newport Beach California?',
  'Best corporate florist in Irvine CA?',
  'French-style florist Orange County?',
  'Who delivers flowers to offices in Orange County?',
  'Best baby shower florist Orange County?',
  'Luxury event florist near Newport Beach?',
  'Same day flower delivery Irvine CA?',
  'Wedding florist recommendation Orange County 2026?',
  'French floral design Orange County California?',
]

// ---------------------------------------------------------------------------
// Supabase + Anthropic init
// ---------------------------------------------------------------------------

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const anthropicKey = process.env.ANTHROPIC_API_KEY!

if (!supabaseUrl || !supabaseServiceKey || !anthropicKey) {
  console.error('❌ Missing required env vars. Run via: doppler run --project anchor-lumen --config prd -- ...')
  process.exit(1)
}

const db = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const anthropic = new Anthropic({ apiKey: anthropicKey })

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-')
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

async function insertContent(row: {
  type: string
  title: string
  slug: string
  body: string
  meta_title: string
  meta_description: string
}): Promise<string> {
  const { data, error } = await db
    .schema('bloom_engine')
    .from('content')
    .insert({
      client_id: CLIENT_ID,
      content_type: row.type,
      title: row.title,
      slug: row.slug,
      body: row.body,
      meta_title: row.meta_title,
      meta_description: row.meta_description,
      status: 'draft',
    })
    .select('id')
    .single()

  if (error) throw new Error(`DB insert failed (${row.type}): ${error.message}`)
  return (data as { id: string }).id
}

// ---------------------------------------------------------------------------
// Blog post generation
// ---------------------------------------------------------------------------

async function generateBlog(topic: string, keyword: string): Promise<{
  title: string; slug: string; body: string; metaTitle: string; metaDescription: string; wordCount: number
}> {
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: `You are a content writer for ${CLIENT_NAME}, a luxury French-inspired florist in ${CITY}, ${STATE}. Brand voice: ${BRAND_VOICE}. Write authentic, specific, on-brand content only.`,
    messages: [{
      role: 'user',
      content: `Write an 800-word SEO blog post for topic: "${topic}". Target keyword: "${keyword}".

Requirements:
- First paragraph must directly answer the primary query
- Use question-format H2 headers (AEO-optimized)
- Weave in keyword and semantic variations naturally
- Mention ${CITY} and service cities (Irvine, Newport Beach, Costa Mesa, Laguna Beach) naturally
- End with a clear CTA for ${CLIENT_NAME}
- Approximately 800 words of body content

After the article, output a JSON block in <json></json> tags:
<json>
{
  "title": "Article title",
  "metaTitle": "55-60 char meta title",
  "metaDescription": "145-155 char meta description",
  "internalLinks": ["Page 1", "Page 2", "Page 3"]
}
</json>`,
    }],
  })

  const raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
  const jsonMatch = raw.match(/<json>([\s\S]*?)<\/json>/)
  const body = raw.replace(/<json>[\s\S]*?<\/json>/, '').trim()

  let title = topic
  let metaTitle = `${keyword} | ${CLIENT_NAME}`
  let metaDescription = `${CLIENT_NAME} shares expert tips on ${keyword} in ${CITY}, ${STATE}.`

  if (jsonMatch) {
    try {
      const meta = JSON.parse(jsonMatch[1]) as Record<string, string>
      title = meta.title ?? title
      metaTitle = meta.metaTitle ?? metaTitle
      metaDescription = meta.metaDescription ?? metaDescription
    } catch { /* use defaults */ }
  }

  return { title, slug: `blog/${slugify(title)}`, body, metaTitle, metaDescription, wordCount: countWords(body) }
}

// ---------------------------------------------------------------------------
// Location page generation
// ---------------------------------------------------------------------------

async function generateLocationPage(city: string): Promise<{
  title: string; slug: string; body: string; metaTitle: string; metaDescription: string; wordCount: number
}> {
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: `You are a content writer for ${CLIENT_NAME}, a luxury French-inspired florist in ${CITY}, ${STATE}. Brand voice: ${BRAND_VOICE}.`,
    messages: [{
      role: 'user',
      content: `Write a 450-word location service page targeting ${city}, ${STATE} for ${CLIENT_NAME}.

Requirements:
- Strong location-specific headline and intro
- Weave in ${city} landmarks, zip codes, or neighborhoods naturally
- Mention services relevant to ${city} residents
- Clear CTA at the end
- Unique content — don't reuse phrasing from other city pages
- Approximately 450 words

After the content, output a JSON block in <json></json> tags:
<json>
{
  "title": "Page title including ${city}",
  "metaTitle": "55-60 char meta title with ${city}",
  "metaDescription": "145-155 char meta description mentioning ${city}"
}
</json>`,
    }],
  })

  const raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
  const jsonMatch = raw.match(/<json>([\s\S]*?)<\/json>/)
  const body = raw.replace(/<json>[\s\S]*?<\/json>/, '').trim()

  let title = `${INDUSTRY} Services in ${city} | ${CLIENT_NAME}`
  let metaTitle = `${CLIENT_NAME} – ${city}, ${STATE}`
  let metaDescription = `${CLIENT_NAME} serves ${city} with premium floral services. Contact us today.`

  if (jsonMatch) {
    try {
      const meta = JSON.parse(jsonMatch[1]) as Record<string, string>
      title = meta.title ?? title
      metaTitle = meta.metaTitle ?? metaTitle
      metaDescription = meta.metaDescription ?? metaDescription
    } catch { /* use defaults */ }
  }

  return { title, slug: `locations/${slugify(city)}`, body, metaTitle, metaDescription, wordCount: countWords(body) }
}

// ---------------------------------------------------------------------------
// GMB post generation
// ---------------------------------------------------------------------------

async function generateGMBPost(type: 'update' | 'offer' | 'event' | 'product', topic: string): Promise<{
  title: string; slug: string; body: string; metaTitle: string; metaDescription: string; wordCount: number
}> {
  const typeGuide = { update: 'business update', offer: 'special offer', event: 'event announcement', product: 'product highlight' }

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: `You are a content writer for ${CLIENT_NAME}. Brand voice: ${BRAND_VOICE}.`,
    messages: [{
      role: 'user',
      content: `Write a Google Business Profile ${typeGuide[type]} post about: "${topic}".

Output ONLY valid JSON (no markdown fencing):
{
  "headline": "compelling headline 60-80 chars",
  "body": "exactly 150 words, on-brand, references ${CITY}",
  "cta": "single action sentence"
}`,
    }],
  })

  const raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

  let headline = topic
  let bodyText = raw.slice(0, 150)
  let cta = `Visit ${CLIENT_URL} to learn more.`

  try {
    const parsed = JSON.parse(cleaned) as Record<string, string>
    headline = parsed.headline ?? headline
    bodyText = parsed.body ?? bodyText
    cta = parsed.cta ?? cta
  } catch { /* use defaults */ }

  const fullBody = `${bodyText}\n\n${cta}`

  return {
    title: headline,
    slug: `gmb/${type}/${slugify(headline)}`,
    body: fullBody,
    metaTitle: headline,
    metaDescription: bodyText.slice(0, 155),
    wordCount: countWords(fullBody),
  }
}

// ---------------------------------------------------------------------------
// Q&A blocks generation
// ---------------------------------------------------------------------------

async function generateQABlocks(): Promise<Array<{ question: string; answer: string }>> {
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    system: `You are a content writer for ${CLIENT_NAME}. Brand voice: ${BRAND_VOICE}.`,
    messages: [{
      role: 'user',
      content: `Generate 25 Q&A pairs for ${CLIENT_NAME}, a luxury French-inspired florist in ${CITY}, ${STATE}.

Base queries: ${AEO_QUERIES.join(' | ')}

Rules:
- Use the base queries as starting points, then add 15 natural variations
- Every answer: 2-4 sentences, written to be directly cited by AI search engines
- Factual, specific, mention ${CLIENT_NAME} and ${CITY} naturally
- Answers in third person ("French Blooms OC is...", not "We are...")

Output ONLY a JSON array (no markdown fencing):
[
  { "question": "...", "answer": "..." }
]`,
    }],
  })

  const raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
  const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

  try {
    return (JSON.parse(cleaned) as Array<{ question: string; answer: string }>).slice(0, 25)
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/)
    if (match) {
      try { return (JSON.parse(match[0]) as Array<{ question: string; answer: string }>).slice(0, 25) } catch { /* fall */ }
    }
    return []
  }
}

// ---------------------------------------------------------------------------
// 90-day calendar generation
// ---------------------------------------------------------------------------

function generate90DayCalendar(
  blogIds: string[],
  locationIds: string[],
  gmbIds: string[],
  qaIds: string[]
): Array<{
  client_id: string
  week_start: string
  content_id: string
  channel: string
  status: string
}> {
  const calendar: Array<{
    client_id: string
    week_start: string
    content_id: string
    channel: string
    status: string
  }> = []

  // Start from Monday of next week
  const today = new Date('2026-04-16')
  const dayOfWeek = today.getDay()
  const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7 || 7
  const startMonday = new Date(today)
  startMonday.setDate(today.getDate() + daysToMonday)

  const weekThemes = [
    'Spring / Mother\'s Day',
    'Corporate Accounts',
    'Wedding Season',
    'Behind the Stems',
    'Summer Events',
    'Baby Showers',
    'Anniversary & Romance',
    'Corporate Q3',
    'Fall Preview',
    'Wedding Final Push',
    'Holiday Prep',
    'Year in Review',
    'New Year Planning',
  ]

  let blogIdx = 0
  let locationIdx = 0
  let gmbIdx = 0

  for (let week = 0; week < 13; week++) {
    const weekStart = new Date(startMonday)
    weekStart.setDate(startMonday.getDate() + week * 7)
    const weekStartStr = weekStart.toISOString().split('T')[0]

    if (blogIdx < blogIds.length) {
      calendar.push({ client_id: CLIENT_ID, week_start: weekStartStr, content_id: blogIds[blogIdx++], channel: 'blog', status: 'pending' })
    }
    if (gmbIdx < gmbIds.length) {
      calendar.push({ client_id: CLIENT_ID, week_start: weekStartStr, content_id: gmbIds[gmbIdx++], channel: 'gmb', status: 'pending' })
    }
    if (locationIdx < locationIds.length) {
      calendar.push({ client_id: CLIENT_ID, week_start: weekStartStr, content_id: locationIds[locationIdx++], channel: 'web', status: 'pending' })
    } else if (gmbIdx < gmbIds.length) {
      calendar.push({ client_id: CLIENT_ID, week_start: weekStartStr, content_id: gmbIds[gmbIdx++], channel: 'gmb', status: 'pending' })
    }
    if (gmbIdx < gmbIds.length) {
      calendar.push({ client_id: CLIENT_ID, week_start: weekStartStr, content_id: gmbIds[gmbIdx++], channel: 'gmb', status: 'pending' })
    }
  }

  return calendar
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('\n🌸 BLOOM ENGINE — FBOC Full Content Generation')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const generatedDir = path.join(process.cwd(), 'clients', CLIENT_ID, 'generated')
  await fs.mkdir(generatedDir, { recursive: true })

  const blogIds: string[] = []
  const locationIds: string[] = []
  const gmbIds: string[] = []
  const qaIds: string[] = []

  // ── 1. BLOG POSTS ─────────────────────────────────────────────────────────
  console.log(`📝 Generating ${BLOG_TOPICS.length} blog posts...`)
  const blogs: Array<ReturnType<typeof generateBlog> extends Promise<infer T> ? T : never> = []

  for (let i = 0; i < BLOG_TOPICS.length; i++) {
    const { topic, keyword } = BLOG_TOPICS[i]
    process.stdout.write(`   [${i + 1}/${BLOG_TOPICS.length}] ${topic.slice(0, 55)}...`)
    try {
      const post = await generateBlog(topic, keyword)
      blogs.push(post)
      const id = await insertContent({
        type: 'blog',
        title: post.title,
        slug: post.slug,
        body: post.body,
        meta_title: post.metaTitle,
        meta_description: post.metaDescription,
      })
      blogIds.push(id)
      process.stdout.write(` ✓ (${post.wordCount}w, id: ${id.slice(0, 8)})\n`)
    } catch (err) {
      process.stdout.write(` ❌ ${String(err)}\n`)
    }
  }

  // Save to file
  await fs.writeFile(path.join(generatedDir, 'blog-posts.json'), JSON.stringify(blogs, null, 2), 'utf-8')
  console.log(`   → Saved to clients/${CLIENT_ID}/generated/blog-posts.json\n`)

  // ── 2. LOCATION PAGES ─────────────────────────────────────────────────────
  console.log(`📍 Generating ${CITIES.length} location pages...`)
  const locationPages: Array<ReturnType<typeof generateLocationPage> extends Promise<infer T> ? T : never> = []

  for (let i = 0; i < CITIES.length; i++) {
    const city = CITIES[i]
    process.stdout.write(`   [${i + 1}/${CITIES.length}] ${city}...`)
    try {
      const page = await generateLocationPage(city)
      locationPages.push(page)
      const id = await insertContent({
        type: 'location_page',
        title: page.title,
        slug: page.slug,
        body: page.body,
        meta_title: page.metaTitle,
        meta_description: page.metaDescription,
      })
      locationIds.push(id)
      process.stdout.write(` ✓ (${page.wordCount}w, id: ${id.slice(0, 8)})\n`)
    } catch (err) {
      process.stdout.write(` ❌ ${String(err)}\n`)
    }
  }

  await fs.writeFile(path.join(generatedDir, 'location-pages.json'), JSON.stringify(locationPages, null, 2), 'utf-8')
  console.log(`   → Saved to clients/${CLIENT_ID}/generated/location-pages.json\n`)

  // ── 3. GMB POSTS ──────────────────────────────────────────────────────────
  console.log(`📱 Generating ${GMB_TOPICS.length} GMB posts...`)
  const gmbPosts: Array<ReturnType<typeof generateGMBPost> extends Promise<infer T> ? T : never> = []

  for (let i = 0; i < GMB_TOPICS.length; i++) {
    const { type, topic } = GMB_TOPICS[i]
    process.stdout.write(`   [${i + 1}/${GMB_TOPICS.length}] [${type}] ${topic.slice(0, 45)}...`)
    try {
      const post = await generateGMBPost(type, topic)
      gmbPosts.push(post)
      const id = await insertContent({
        type: 'gmb_post',
        title: post.title,
        slug: post.slug,
        body: post.body,
        meta_title: post.metaTitle,
        meta_description: post.metaDescription,
      })
      gmbIds.push(id)
      process.stdout.write(` ✓ (id: ${id.slice(0, 8)})\n`)
    } catch (err) {
      process.stdout.write(` ❌ ${String(err)}\n`)
    }
  }

  await fs.writeFile(path.join(generatedDir, 'gmb-posts.json'), JSON.stringify(gmbPosts, null, 2), 'utf-8')
  console.log(`   → Saved to clients/${CLIENT_ID}/generated/gmb-posts.json\n`)

  // ── 4. Q&A BLOCKS ─────────────────────────────────────────────────────────
  console.log(`💬 Generating 25 Q&A blocks...`)
  try {
    const pairs = await generateQABlocks()
    console.log(`   Generated ${pairs.length} Q&A pairs`)

    for (const pair of pairs) {
      const schema = {
        '@context': 'https://schema.org',
        '@type': 'Question',
        name: pair.question,
        acceptedAnswer: { '@type': 'Answer', text: pair.answer },
      }

      const id = await insertContent({
        type: 'qa_block',
        title: pair.question,
        slug: `qa/${slugify(pair.question).slice(0, 80)}`,
        body: `${pair.question}\n\n${pair.answer}\n\n${JSON.stringify(schema)}`,
        meta_title: pair.question,
        meta_description: pair.answer.slice(0, 155),
      })
      qaIds.push(id)
    }

    await fs.writeFile(path.join(generatedDir, 'qa-blocks.json'), JSON.stringify(pairs, null, 2), 'utf-8')
    console.log(`   → Saved to clients/${CLIENT_ID}/generated/qa-blocks.json\n`)
  } catch (err) {
    console.error(`   ❌ Q&A generation failed: ${String(err)}\n`)
  }

  // ── 5. 90-DAY CALENDAR ────────────────────────────────────────────────────
  console.log(`📅 Building 90-day content calendar...`)
  const calendarRows = generate90DayCalendar(blogIds, locationIds, gmbIds, qaIds)

  if (calendarRows.length > 0) {
    const { error: calError } = await db
      .schema('bloom_engine')
      .from('content_calendar')
      .insert(calendarRows)

    if (calError) {
      console.error(`   ❌ Calendar DB insert failed: ${calError.message}`)
    } else {
      console.log(`   ✓ ${calendarRows.length} calendar entries saved to DB`)
    }
  }

  await fs.writeFile(
    path.join(generatedDir, 'content-calendar.json'),
    JSON.stringify(calendarRows, null, 2),
    'utf-8'
  )
  console.log(`   → Saved to clients/${CLIENT_ID}/generated/content-calendar.json\n`)

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ FBOC Content Generation Complete')
  console.log(`   Blog posts:      ${blogIds.length}/12`)
  console.log(`   Location pages:  ${locationIds.length}/7`)
  console.log(`   GMB posts:       ${gmbIds.length}/30`)
  console.log(`   Q&A blocks:      ${qaIds.length}/25`)
  console.log(`   Calendar entries: ${calendarRows.length}`)
  console.log(`   All files: clients/${CLIENT_ID}/generated/`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

main().catch((err) => {
  console.error(`\n❌ Fatal error: ${String(err)}`)
  process.exit(1)
})
