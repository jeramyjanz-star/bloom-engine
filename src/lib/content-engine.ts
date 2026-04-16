import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/src/lib/supabase'
import type { ClientConfig } from '@/src/lib/client-loader'

export interface BlogPost {
  title: string
  slug: string
  body: string
  metaTitle: string
  metaDescription: string
  targetKeyword: string
  wordCount: number
  internalLinkSuggestions: string[]
  schemaMarkup: object
}

export interface LocationPage {
  city: string
  title: string
  slug: string
  body: string
  metaTitle: string
  metaDescription: string
}

export interface GMBPost {
  type: 'update' | 'offer' | 'event' | 'product'
  headline: string
  body: string
  cta: string
  offerDetails?: string
}

export interface QABlock {
  question: string
  answer: string
  schema: object
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export class ContentEngine {
  private anthropic: Anthropic

  constructor(private anthropicApiKey: string) {
    this.anthropic = new Anthropic({ apiKey: anthropicApiKey })
  }

  private getSystemPrompt(config: ClientConfig): string {
    return `You are a content writer for ${config.name}, a ${config.industry} business in ${config.location.city}, ${config.location.state}. Brand voice: ${config.brand.voice}. Write in this voice exclusively. Every piece should feel authentic to this brand, not generic.`
  }

  async generateBlogPost(
    clientId: string,
    topic: string,
    targetKeyword: string,
    config: ClientConfig
  ): Promise<BlogPost> {
    const prompt = `Write an 800-word SEO blog article for the topic: "${topic}".
Target keyword: "${targetKeyword}"

Requirements:
- First paragraph must directly answer the primary query a searcher would have
- Use question-format H2 headers (AEO-optimized, e.g. "What is...?", "How do...?", "Why choose...?")
- Naturally weave in the target keyword and semantic variations throughout
- Write approximately 800 words of body content
- End with a clear call to action relevant to ${config.name}
- Mention ${config.location.city}, ${config.location.state} and relevant service cities naturally

After the article, output a JSON block wrapped in <json></json> tags with this exact structure:
<json>
{
  "title": "Article title here",
  "metaTitle": "55-60 char meta title",
  "metaDescription": "145-155 char meta description",
  "internalLinkSuggestions": ["Page or topic 1", "Page or topic 2", "Page or topic 3"]
}
</json>`

    const message = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: this.getSystemPrompt(config),
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''

    // Split body from JSON metadata
    const jsonMatch = raw.match(/<json>([\s\S]*?)<\/json>/)
    const body = raw.replace(/<json>[\s\S]*?<\/json>/, '').trim()

    let title = topic
    let metaTitle = `${targetKeyword} | ${config.name}`
    let metaDescription = `${config.name} shares expert tips on ${targetKeyword} in ${config.location.city}, ${config.location.state}.`
    let internalLinkSuggestions: string[] = []

    if (jsonMatch) {
      try {
        const meta = JSON.parse(jsonMatch[1]) as {
          title?: string
          metaTitle?: string
          metaDescription?: string
          internalLinkSuggestions?: string[]
        }
        title = meta.title ?? title
        metaTitle = meta.metaTitle ?? metaTitle
        metaDescription = meta.metaDescription ?? metaDescription
        internalLinkSuggestions = meta.internalLinkSuggestions ?? []
      } catch {
        // fallback to defaults above
      }
    }

    const slug = slugify(title)
    const wordCount = countWords(body)

    const schemaMarkup = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: title,
      description: metaDescription,
      author: {
        '@type': 'Organization',
        name: config.name,
        url: config.url,
      },
      publisher: {
        '@type': 'Organization',
        name: config.name,
        url: config.url,
      },
      keywords: targetKeyword,
      datePublished: new Date().toISOString().split('T')[0],
    }

    return {
      title,
      slug,
      body,
      metaTitle,
      metaDescription,
      targetKeyword,
      wordCount,
      internalLinkSuggestions,
      schemaMarkup,
    }
  }

  async generateLocationPage(
    clientId: string,
    city: string,
    config: ClientConfig
  ): Promise<LocationPage> {
    const prompt = `Write a 450-word location service page for ${config.name} targeting the city of ${city}, ${config.location.state}.

Requirements:
- Open with a strong, location-specific headline and intro paragraph
- Weave in local landmarks, zip codes, or neighborhoods naturally (research common ones for ${city})
- Mention specific services offered by ${config.name} relevant to ${city} residents
- Include a clear call to action at the end
- Unique content — do not reuse phrasing from other city pages
- Keep to approximately 450 words

After the content, output a JSON block in <json></json> tags:
<json>
{
  "title": "Page title here",
  "metaTitle": "55-60 char meta title including ${city}",
  "metaDescription": "145-155 char meta description mentioning ${city}"
}
</json>`

    const message = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: this.getSystemPrompt(config),
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = raw.match(/<json>([\s\S]*?)<\/json>/)
    const body = raw.replace(/<json>[\s\S]*?<\/json>/, '').trim()

    let title = `${config.industry} Services in ${city} | ${config.name}`
    let metaTitle = `${config.name} – ${city}, ${config.location.state}`
    let metaDescription = `${config.name} serves ${city} with premium ${config.industry} services. Contact us today.`

    if (jsonMatch) {
      try {
        const meta = JSON.parse(jsonMatch[1]) as {
          title?: string
          metaTitle?: string
          metaDescription?: string
        }
        title = meta.title ?? title
        metaTitle = meta.metaTitle ?? metaTitle
        metaDescription = meta.metaDescription ?? metaDescription
      } catch {
        // use defaults
      }
    }

    const slug = `locations/${slugify(city)}`

    return { city, title, slug, body, metaTitle, metaDescription }
  }

  async generateGMBPost(
    clientId: string,
    type: GMBPost['type'],
    topic: string,
    config: ClientConfig
  ): Promise<GMBPost> {
    const typeGuidance: Record<GMBPost['type'], string> = {
      update: 'a business update or news post',
      offer: 'a special offer or promotion post',
      event: 'an event announcement post',
      product: 'a product highlight post',
    }

    const prompt = `Write a Google Business Profile ${typeGuidance[type]} about: "${topic}" for ${config.name}.

Requirements:
- Headline: compelling, 60–80 characters
- Body: exactly 150 words, on-brand, naturally includes a local reference to ${config.location.city}
- CTA line: a single action sentence (e.g. "Call us today", "Book online at frenchbloomsoc.com")
${type === 'offer' ? '- offerDetails: one sentence summarizing the offer terms' : ''}

Output ONLY a JSON object with no markdown fencing:
{
  "headline": "...",
  "body": "...",
  "cta": "..."${type === 'offer' ? ',\n  "offerDetails": "..."' : ''}
}`

    const message = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: this.getSystemPrompt(config),
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''

    // Strip any accidental markdown fences
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

    let parsed: Partial<GMBPost> = {}
    try {
      parsed = JSON.parse(cleaned) as Partial<GMBPost>
    } catch {
      // fallback defaults if parse fails
    }

    return {
      type,
      headline: parsed.headline ?? topic,
      body: parsed.body ?? raw.slice(0, 150),
      cta: parsed.cta ?? `Visit ${config.url} to learn more.`,
      ...(type === 'offer' && parsed.offerDetails
        ? { offerDetails: parsed.offerDetails }
        : {}),
    }
  }

  async generateQAContent(
    clientId: string,
    config: ClientConfig
  ): Promise<QABlock[]> {
    const baseQueries = config.aeoQueries
    const prompt = `You are writing FAQ content for ${config.name}, a ${config.industry} in ${config.location.city}, ${config.location.state}.

Generate 25 Q&A pairs:
- Use these base questions as your starting point: ${baseQueries.join(' | ')}
- Expand to include 15 natural variations and related questions a local customer would ask
- Every answer must be 2-4 sentences, written to be directly cited by AI search engines
- Answers must be factual, specific, and mention ${config.name} and ${config.location.city} naturally
- Brand voice: ${config.brand.voice}

Output ONLY a JSON array with no markdown fencing:
[
  { "question": "...", "answer": "..." },
  ...
]`

    const message = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: this.getSystemPrompt(config),
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

    let pairs: Array<{ question: string; answer: string }> = []
    try {
      pairs = JSON.parse(cleaned) as Array<{ question: string; answer: string }>
    } catch {
      // If JSON parse fails, attempt to extract any partial valid array
      const arrayMatch = cleaned.match(/\[[\s\S]*\]/)
      if (arrayMatch) {
        try {
          pairs = JSON.parse(arrayMatch[0]) as Array<{ question: string; answer: string }>
        } catch {
          pairs = []
        }
      }
    }

    return pairs.slice(0, 25).map((pair) => ({
      question: pair.question,
      answer: pair.answer,
      schema: {
        '@context': 'https://schema.org',
        '@type': 'Question',
        name: pair.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: pair.answer,
        },
      },
    }))
  }

  async saveToDatabase(
    clientId: string,
    content: BlogPost | LocationPage | GMBPost | QABlock,
    contentType: string
  ): Promise<string> {
    const { data, error } = await supabaseAdmin
      .from('bloom_engine.content')
      .insert({
        client_id: clientId,
        content_type: contentType,
        content_data: content,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) {
      throw new Error(`Failed to save content: ${error.message}`)
    }

    return (data as { id: string }).id
  }
}
