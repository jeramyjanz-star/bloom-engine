/**
 * BLOOM ENGINE — Test All FBOC AEO Queries via Perplexity
 * Usage: doppler run --project anchor-lumen --config prd -- npx ts-node --project tsconfig.json scripts/test-fboc-aeo.ts
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs/promises'
import path from 'path'

const CLIENT_ID = 'fboc'
const CLIENT_NAME = 'French Blooms OC'
const CLIENT_DOMAIN = 'frenchbloomsoc.com'

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const anthropicKey = process.env.ANTHROPIC_API_KEY!
const perplexityKey = process.env.PERPLEXITY_API_KEY!

if (!supabaseUrl || !supabaseServiceKey || !anthropicKey || !perplexityKey) {
  console.error('❌ Missing required env vars. Run via: doppler run --project anchor-lumen --config prd -- ...')
  process.exit(1)
}

const db = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const anthropic = new Anthropic({ apiKey: anthropicKey })

interface PerplexityResponse {
  choices: Array<{ message: { content: string } }>
  citations?: string[]
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

async function testQuery(query: string): Promise<{
  query: string
  clientCited: boolean
  clientUrl: string | null
  citedSources: Array<{ url: string; title: string }>
  competitors: string[]
  answer: string
  recommendations: string[]
}> {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${perplexityKey}` },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [
        { role: 'system', content: 'You are a helpful local business assistant. Answer the query and cite specific local businesses.' },
        { role: 'user', content: query },
      ],
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Perplexity error ${res.status}: ${err}`)
  }

  const data = (await res.json()) as PerplexityResponse
  const answer = data.choices?.[0]?.message?.content ?? ''
  const citationUrls: string[] = data.citations ?? []

  const citedSources = citationUrls.map((url) => ({ url, title: extractDomain(url) }))

  const clientCited = citationUrls.some((url) => extractDomain(url).includes(CLIENT_DOMAIN))
  const clientUrl = clientCited
    ? (citationUrls.find((url) => extractDomain(url).includes(CLIENT_DOMAIN)) ?? null)
    : null

  const competitors = citationUrls
    .map(extractDomain)
    .filter((d) => !d.includes(CLIENT_DOMAIN))
    .filter((d, i, arr) => arr.indexOf(d) === i)

  let recommendations: string[] = []
  if (!clientCited) {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `${CLIENT_NAME} (${CLIENT_DOMAIN}) was NOT cited for the query: "${query}". Competitors cited: ${competitors.join(', ') || 'none found'}. Generate exactly 3 specific, actionable content recommendations to win this query. Number them 1. 2. 3.`,
      }],
    })

    const rawText = msg.content[0].type === 'text' ? msg.content[0].text : ''
    recommendations = rawText
      .split('\n')
      .map((l) => l.replace(/^\s*\d+[\.\)]\s*/, '').trim())
      .filter((l) => l.length > 15)
      .slice(0, 3)
  }

  return { query, clientCited, clientUrl, citedSources, competitors, answer, recommendations }
}

async function main(): Promise<void> {
  console.log('\n🔍 BLOOM ENGINE — FBOC AEO Citation Testing')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  const outputDir = path.join(process.cwd(), 'clients', CLIENT_ID, 'generated')
  await fs.mkdir(outputDir, { recursive: true })

  const results: Array<ReturnType<typeof testQuery> extends Promise<infer T> ? T : never> = []
  let citedCount = 0

  for (let i = 0; i < AEO_QUERIES.length; i++) {
    const query = AEO_QUERIES[i]
    process.stdout.write(`   [${i + 1}/${AEO_QUERIES.length}] "${query.slice(0, 55)}"...\n`)

    try {
      const result = await testQuery(query)
      results.push(result)

      if (result.clientCited) {
        citedCount++
        console.log(`          ✅ CITED at ${result.clientUrl}`)
      } else {
        console.log(`          ❌ NOT CITED — competitors: ${result.competitors.slice(0, 2).join(', ') || 'none'}`)
        if (result.recommendations.length > 0) {
          console.log(`          💡 Rec 1: ${result.recommendations[0]}`)
        }
      }

      // Save to Supabase
      const { error } = await db
        .schema('bloom_engine')
        .from('aeo_queries')
        .upsert({
          client_id: CLIENT_ID,
          query_text: result.query,
          last_tested: new Date().toISOString(),
          client_cited: result.clientCited,
          cited_sources: result.citedSources,
          competitor_cited: result.competitors[0] ?? null,
          raw_response: result.answer,
        }, { onConflict: 'client_id,query_text' })

      if (error) console.warn(`   ⚠️  DB save failed for query ${i + 1}: ${error.message}`)

      // Rate limit: 1.5s between Perplexity calls
      if (i < AEO_QUERIES.length - 1) await new Promise((r) => setTimeout(r, 1500))
    } catch (err) {
      console.error(`   ❌ Query ${i + 1} failed: ${String(err)}`)
    }
  }

  // Save full results to file
  await fs.writeFile(
    path.join(outputDir, 'aeo-results.json'),
    JSON.stringify(results, null, 2),
    'utf-8'
  )

  const citationRate = results.length > 0 ? Math.round((citedCount / results.length) * 100) : 0

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ AEO Testing Complete')
  console.log(`   Queries tested: ${results.length}/10`)
  console.log(`   Cited:          ${citedCount}/${results.length} (${citationRate}%)`)
  console.log(`   NOT cited:      ${results.length - citedCount}/${results.length}`)
  console.log(`   Results saved:  clients/${CLIENT_ID}/generated/aeo-results.json`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
}

main().catch((err) => {
  console.error(`\n❌ Fatal error: ${String(err)}`)
  process.exit(1)
})
