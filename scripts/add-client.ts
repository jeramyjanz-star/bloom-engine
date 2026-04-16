/**
 * BLOOM ENGINE — Add Client CLI
 * Usage: npm run add-client -- --id=wren --name="WREN AI" --url=xwrenx.com --industry=saas --city="Houston, TX"
 */

import fs from 'fs/promises'
import path from 'path'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Industry templates
// ---------------------------------------------------------------------------

interface IndustryTemplate {
  gmb: { category: string }
  voice: string
}

const INDUSTRY_TEMPLATES: Record<string, IndustryTemplate> = {
  florist: { gmb: { category: 'Florist' }, voice: 'elegant, floral, luxury' },
  saas: { gmb: { category: 'Software Company' }, voice: 'technical, innovative, clear' },
  hvac: { gmb: { category: 'HVAC Contractor' }, voice: 'reliable, professional, expert' },
  plumbing: { gmb: { category: 'Plumber' }, voice: 'trustworthy, local, responsive' },
  roofing: { gmb: { category: 'Roofing Contractor' }, voice: 'durable, protective, expert' },
  restaurant: { gmb: { category: 'Restaurant' }, voice: 'warm, appetizing, welcoming' },
  'med-spa': { gmb: { category: 'Medical Spa' }, voice: 'luxurious, clinical, transformative' },
  'real-estate': { gmb: { category: 'Real Estate Agency' }, voice: 'authoritative, local, trustworthy' },
  recruiting: { gmb: { category: 'Employment Agency' }, voice: 'professional, opportunity-focused' },
  ecommerce: { gmb: { category: 'E-commerce Service' }, voice: 'direct, value-focused, helpful' },
}

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

interface CliArgs {
  id: string
  name: string
  url: string
  industry: string
  city: string
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  const parsed: Record<string, string> = {}

  for (const arg of args) {
    const match = arg.match(/^--([a-zA-Z-]+)=(.+)$/)
    if (match) {
      parsed[match[1]] = match[2].replace(/^["']|["']$/g, '')
    }
  }

  const required = ['id', 'name', 'url', 'industry', 'city']
  for (const key of required) {
    if (!parsed[key]) {
      console.error(`❌ Missing required argument: --${key}`)
      console.error(
        `Usage: npm run add-client -- --id=wren --name="WREN AI" --url=xwrenx.com --industry=saas --city="Houston, TX"`
      )
      process.exit(1)
    }
  }

  return {
    id: parsed['id'],
    name: parsed['name'],
    url: parsed['url'],
    industry: parsed['industry'],
    city: parsed['city'],
  }
}

// ---------------------------------------------------------------------------
// Claude keyword/query generation
// ---------------------------------------------------------------------------

interface GeneratedContent {
  services: string[]
  targetKeywords: string[]
  aeoQueries: string[]
}

async function generateKeywordsWithClaude(
  name: string,
  url: string,
  industry: string,
  city: string,
  voice: string
): Promise<GeneratedContent> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('Missing env var: ANTHROPIC_API_KEY')
  }

  const client = new Anthropic({ apiKey })

  const prompt = `You are an SEO strategist. Generate a JSON object for a new business client with these details:
- Business name: ${name}
- Website: ${url}
- Industry: ${industry}
- City: ${city}
- Brand voice: ${voice}

Return ONLY valid JSON (no markdown, no extra text) with this exact structure:
{
  "services": ["service1", "service2", "service3", "service4", "service5"],
  "targetKeywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6", "keyword7", "keyword8", "keyword9", "keyword10"],
  "aeoQueries": ["question1?", "question2?", "question3?", "question4?", "question5?", "question6?", "question7?", "question8?"]
}

- services: 5 core services this business likely offers
- targetKeywords: 10 high-intent local/industry SEO keywords including city name where relevant
- aeoQueries: 8 natural language questions a potential customer might ask an AI search engine about this business type`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const textBlock = message.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude returned no text content')
  }

  const rawText = textBlock.text.trim()
  const jsonText = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw new Error(`Failed to parse Claude response as JSON: ${rawText.slice(0, 300)}`)
  }

  const result = parsed as Record<string, unknown>
  return {
    services: Array.isArray(result.services) ? (result.services as string[]) : [],
    targetKeywords: Array.isArray(result.targetKeywords) ? (result.targetKeywords as string[]) : [],
    aeoQueries: Array.isArray(result.aeoQueries) ? (result.aeoQueries as string[]) : [],
  }
}

// ---------------------------------------------------------------------------
// Config generation
// ---------------------------------------------------------------------------

function buildConfig(
  args: CliArgs,
  template: IndustryTemplate,
  generated: GeneratedContent
): object {
  const [cityName, stateName] = args.city.split(',').map((s) => s.trim())
  const normalizedUrl = args.url.startsWith('http') ? args.url : `https://${args.url}`

  return {
    id: args.id,
    name: args.name,
    url: normalizedUrl,
    industry: args.industry,
    location: {
      city: cityName,
      state: stateName ?? '',
      serviceCities: [cityName],
    },
    brand: {
      colors: {
        primary: '#000000',
        secondary: '#ffffff',
        dark: '#111111',
      },
      fonts: {
        display: 'Inter',
        body: 'Inter',
      },
      voice: template.voice,
    },
    services: generated.services,
    targetKeywords: generated.targetKeywords,
    aeoQueries: generated.aeoQueries,
    gmb: {
      category: template.gmb.category,
      additionalCategories: [],
      priceRange: '$$',
    },
    owner: {
      name: '',
      email: '',
    },
  }
}

// ---------------------------------------------------------------------------
// Directory structure
// ---------------------------------------------------------------------------

async function createClientDirectories(clientId: string): Promise<void> {
  const projectRoot = path.resolve(__dirname, '..')
  const base = path.join(projectRoot, 'clients', clientId)

  const dirs = [
    base,
    path.join(base, 'audit'),
    path.join(base, 'content'),
    path.join(base, 'schema'),
  ]

  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true })
  }
}

// ---------------------------------------------------------------------------
// Supabase insert
// ---------------------------------------------------------------------------

async function insertClientToSupabase(args: CliArgs, config: object): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn(
      '⚠️  Supabase env vars not set — skipping database insert. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    )
    return
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error } = await supabaseAdmin
    .schema('bloom_engine')
    .from('clients')
    .upsert(
      {
        id: args.id,
        name: args.name,
        url: args.url,
        industry: args.industry,
        city: args.city,
        config,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )

  if (error) {
    throw new Error(`Supabase insert failed: ${error.message}`)
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs()

  // Validate industry
  const template = INDUSTRY_TEMPLATES[args.industry]
  if (!template) {
    const available = Object.keys(INDUSTRY_TEMPLATES).join(', ')
    console.error(`❌ Unknown industry "${args.industry}". Available: ${available}`)
    process.exit(1)
  }

  console.log(`\n🌸 BLOOM ENGINE — Adding client: ${args.name}`)
  console.log(`   Industry: ${args.industry} | City: ${args.city}`)

  // 1. Create directory structure
  await createClientDirectories(args.id)
  console.log(`   ✓ Created directory: clients/${args.id}/`)

  // 2. Generate keywords/queries with Claude Haiku
  console.log(`   ⟳ Generating keywords and queries with Claude Haiku...`)
  let generated: GeneratedContent
  try {
    generated = await generateKeywordsWithClaude(
      args.name,
      args.url,
      args.industry,
      args.city,
      template.voice
    )
    console.log(`   ✓ Generated ${generated.targetKeywords.length} keywords, ${generated.aeoQueries.length} AEO queries`)
  } catch (err) {
    console.warn(`   ⚠️  Claude generation failed (${String(err)}) — using empty defaults`)
    generated = { services: [], targetKeywords: [], aeoQueries: [] }
  }

  // 3. Build and write config.json
  const config = buildConfig(args, template, generated)
  const projectRoot = path.resolve(__dirname, '..')
  const configPath = path.join(projectRoot, 'clients', args.id, 'config.json')
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8')
  console.log(`   ✓ Wrote config.json`)

  // 4. Insert into Supabase
  try {
    await insertClientToSupabase(args, config)
    console.log(`   ✓ Inserted into bloom_engine.clients`)
  } catch (err) {
    console.warn(`   ⚠️  Supabase insert failed: ${String(err)}`)
  }

  // 5. Done
  console.log(`
✅ ${args.name} added to BLOOM ENGINE
📁 Config: /clients/${args.id}/config.json
🚀 Run: npm run audit -- --client=${args.id} to run first SEO audit
`)
}

main().catch((err) => {
  console.error(`\n❌ Fatal error: ${String(err)}`)
  process.exit(1)
})
