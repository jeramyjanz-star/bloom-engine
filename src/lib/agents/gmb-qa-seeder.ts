import Anthropic from '@anthropic-ai/sdk'
import type { ClientConfig } from '@/src/lib/client-loader'

// gmb-posting-engine is a peer module that will exist at runtime.
// We load it lazily via a path string so the compiler does not try to resolve
// it at build time (the file will be created in a later step).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _requirePostingEngine = (): { getGMBAccessToken: (clientId: string) => Promise<string> } =>
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('./gmb-posting-engine') as { getGMBAccessToken: (clientId: string) => Promise<string> }

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QASeed {
  question: string
  answer: string
}

interface GBPQuestionResponse {
  name: string
  text: string
}

// ---------------------------------------------------------------------------
// Generate a brand-voice answer for a question using Claude Haiku
// ---------------------------------------------------------------------------

async function generateAnswer(
  question: string,
  config: ClientConfig,
  anthropic: Anthropic
): Promise<string> {
  const websiteUrl = config.url

  const prompt = `You are writing a Google Business Profile Q&A answer for ${config.name}, a ${config.industry} located in ${config.location.city}, ${config.location.state}.

Question: "${question}"

Write a 2-3 sentence answer that:
- Mentions "${config.name}" naturally
- Mentions "${config.location.city}" or a relevant service area
- Ends with the website URL: ${websiteUrl}
- Is factual, helpful, and written in this brand voice: ${config.brand.voice}
- Does NOT use corporate buzzwords or AI-sounding phrases
- Sounds like the business owner answering directly

Reply with ONLY the answer text — no quotes, no labels, just the answer.`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    return raw || `${config.name} in ${config.location.city} would be happy to help with that. Visit ${websiteUrl} for more details.`
  } catch (err) {
    console.warn('[gmb-qa-seeder] Answer generation failed for question:', question, String(err))
    return `${config.name} in ${config.location.city} is here to help. Visit ${websiteUrl} to learn more.`
  }
}

// ---------------------------------------------------------------------------
// GBP API: post a question, then post its answer
// ---------------------------------------------------------------------------

async function seedSingleQA(
  question: string,
  answer: string,
  accountId: string,
  locationId: string,
  accessToken: string
): Promise<void> {
  const baseUrl = 'https://mybusiness.googleapis.com/v4'
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }

  // Step 1: Post the question
  const questionsUrl = `${baseUrl}/accounts/${accountId}/locations/${locationId}/questions`
  const questionRes = await fetch(questionsUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text: question }),
  })

  if (!questionRes.ok) {
    const errBody = await questionRes.text()
    throw new Error(`GBP question POST failed (${questionRes.status}): ${errBody}`)
  }

  const questionData = (await questionRes.json()) as GBPQuestionResponse

  // GBP returns the question resource name, e.g. accounts/.../questions/QUESTION_ID
  const questionName = questionData.name
  if (!questionName) {
    throw new Error('GBP question response missing "name" field')
  }

  // Extract just the question ID from the full resource name
  const questionId = questionName.split('/').pop()
  if (!questionId) {
    throw new Error(`Could not parse question ID from resource name: ${questionName}`)
  }

  // Step 2: Upsert the answer
  const answersUrl = `${baseUrl}/accounts/${accountId}/locations/${locationId}/questions/${questionId}/answers:upsert`
  const answerRes = await fetch(answersUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ text: answer }),
  })

  if (!answerRes.ok) {
    const errBody = await answerRes.text()
    throw new Error(`GBP answer upsert failed (${answerRes.status}): ${errBody}`)
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function seedQAForClient(
  clientId: string,
  config: ClientConfig
): Promise<{ seeded: number; failed: number }> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // Resolve GBP credentials from env
  const clientIdUpper = clientId.toUpperCase().replace(/-/g, '_')
  const accountId = process.env[`GMB_ACCOUNT_ID_${clientIdUpper}`]
  const locationId = process.env[`GMB_LOCATION_ID_${clientIdUpper}`]

  if (!accountId || !locationId) {
    throw new Error(
      `Missing GBP credentials for client "${clientId}". ` +
      `Expected env vars: GMB_ACCOUNT_ID_${clientIdUpper} and GMB_LOCATION_ID_${clientIdUpper}`
    )
  }

  // Get a valid GBP OAuth access token (peer module loaded at runtime)
  let accessToken: string
  try {
    const { getGMBAccessToken } = _requirePostingEngine()
    accessToken = await getGMBAccessToken(clientId)
  } catch (err) {
    throw new Error(`Failed to obtain GBP access token for "${clientId}": ${String(err)}`)
  }

  const questions = config.aeoQueries
  let seeded = 0
  let failed = 0

  for (const question of questions) {
    try {
      // Generate the answer via Claude
      const answer = await generateAnswer(question, config, anthropic)

      // Post to GBP
      await seedSingleQA(question, answer, accountId, locationId, accessToken)

      console.info(`[gmb-qa-seeder] Seeded Q&A for: "${question}"`)
      seeded++
    } catch (err) {
      console.error(`[gmb-qa-seeder] Failed to seed Q&A for "${question}":`, String(err))
      failed++
      // Continue with the next question — don't throw
    }
  }

  console.info(`[gmb-qa-seeder] Done for client "${clientId}": ${seeded} seeded, ${failed} failed`)
  return { seeded, failed }
}
