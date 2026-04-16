import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { loadClientConfig } from '@/src/lib/client-loader'
import { SchemaEngine } from '@/src/lib/schema-engine'

const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001'

interface FAQQAPair {
  question: string
  answer: string
}

/**
 * Use Claude Haiku to expand a list of AEO query strings into full Q&A pairs
 * grounded in the client's name, services, and location.
 */
async function expandQueriesWithClaude(
  queries: string[],
  clientName: string,
  services: string[],
  location: { city: string; state: string }
): Promise<FAQQAPair[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('Missing env var: ANTHROPIC_API_KEY')
  }

  const client = new Anthropic({ apiKey })

  const systemPrompt = `You are an SEO and AEO (Answer Engine Optimisation) expert writing structured FAQ content for a florist business. Your answers must be:
- Factually accurate based only on the information provided
- 2-4 sentences long
- Written in a warm, helpful tone
- Optimised to appear in AI-powered search snippets (Google SGE, Bing Copilot, Perplexity)
- Free of superlatives you cannot prove (e.g., avoid "the best" unless quoting a query)`

  const userPrompt = `Business: ${clientName}
Location: ${location.city}, ${location.state}
Services: ${services.join(', ')}

For each of the following questions, write a concise, factually grounded answer (2-4 sentences). Return ONLY valid JSON — an array of objects with "question" and "answer" keys. Do not include any text outside the JSON array.

Questions:
${queries.map((q, i) => `${i + 1}. ${q}`).join('\n')}`

  const message = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 2048,
    messages: [{ role: 'user', content: userPrompt }],
    system: systemPrompt,
  })

  // Extract text content from the response
  const textContent = message.content.find((block) => block.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('Claude returned no text content')
  }

  const rawText = textContent.text.trim()

  // Strip markdown code fences if present
  const jsonText = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw new Error(
      `Failed to parse Claude FAQ response as JSON. Raw response: ${rawText.slice(0, 500)}`
    )
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Claude FAQ response was not a JSON array')
  }

  return (parsed as Array<Record<string, unknown>>).map((item, idx) => {
    if (typeof item.question !== 'string' || typeof item.answer !== 'string') {
      throw new Error(
        `FAQ item at index ${idx} is missing "question" or "answer" string fields`
      )
    }
    return { question: item.question, answer: item.answer }
  })
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { clientId: string } }
): Promise<NextResponse> {
  const { clientId } = params

  // 1. Load client config
  let config: Awaited<ReturnType<typeof loadClientConfig>>
  try {
    config = await loadClientConfig(clientId)
  } catch (err) {
    return NextResponse.json(
      { error: `Client not found: ${String(err)}` },
      { status: 404 }
    )
  }

  // 2. Expand AEO queries into Q&A pairs using Claude Haiku
  let faqQAPairs: FAQQAPair[] | undefined
  try {
    faqQAPairs = await expandQueriesWithClaude(
      config.aeoQueries,
      config.name,
      config.services,
      { city: config.location.city, state: config.location.state }
    )
  } catch (err) {
    // Non-fatal: fall back to raw queries as questions
    console.warn(
      `[schema/generate] Claude FAQ expansion failed for "${clientId}", using raw queries: ${String(err)}`
    )
    faqQAPairs = undefined
  }

  // 3. Generate the full schema bundle
  const engine = new SchemaEngine()
  let bundle: Awaited<ReturnType<SchemaEngine['generateAll']>>
  try {
    bundle = await engine.generateAll(clientId, faqQAPairs)
  } catch (err) {
    return NextResponse.json(
      { error: `Schema generation failed: ${String(err)}` },
      { status: 500 }
    )
  }

  // 4. Save to database
  try {
    await engine.saveToDatabase(clientId, bundle)
  } catch (err) {
    return NextResponse.json(
      { error: `Database save failed: ${String(err)}` },
      { status: 500 }
    )
  }

  // 5. Return the bundle and a helpful install guide
  const installGuide = engine.generateInstallGuide(clientId, bundle)

  return NextResponse.json(
    {
      success: true,
      clientId,
      bundle,
      installGuide,
    },
    { status: 200 }
  )
}
