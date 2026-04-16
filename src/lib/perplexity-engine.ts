import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from '@/src/lib/supabase'
import type { ClientConfig } from '@/src/lib/client-loader'

export interface AEOTestResult {
  query: string
  clientCited: boolean
  clientUrl: string | null
  citedSources: Array<{ url: string; title: string; snippet: string }>
  competitors: string[]
  answer: string
  testedAt: string
  recommendations: string[]
}

interface PerplexityMessage {
  role: string
  content: string
}

interface PerplexityChoice {
  message: PerplexityMessage
}

interface PerplexityResponse {
  choices: PerplexityChoice[]
  citations?: string[]
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export class PerplexityEngine {
  private anthropic: Anthropic

  constructor(
    private perplexityApiKey: string,
    private anthropicApiKey: string
  ) {
    this.anthropic = new Anthropic({ apiKey: anthropicApiKey })
  }

  async testQuery(query: string, clientConfig: ClientConfig): Promise<AEOTestResult> {
    const testedAt = new Date().toISOString()

    // Call Perplexity sonar-pro
    const perplexityRes = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.perplexityApiKey}`,
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful assistant. Answer the user\'s question about local businesses. Be specific and cite your sources.',
          },
          {
            role: 'user',
            content: query,
          },
        ],
      }),
    })

    if (!perplexityRes.ok) {
      const errorText = await perplexityRes.text()
      throw new Error(`Perplexity API error ${perplexityRes.status}: ${errorText}`)
    }

    const perplexityData = (await perplexityRes.json()) as PerplexityResponse

    const answer = perplexityData.choices?.[0]?.message?.content ?? ''
    const citationUrls: string[] = perplexityData.citations ?? []

    // Build cited sources array — Perplexity returns flat URL list, no title/snippet
    // We construct placeholder title/snippet from URL and answer context
    const citedSources: AEOTestResult['citedSources'] = citationUrls.map((url) => {
      const domain = extractDomain(url)
      // Pull a short snippet from the answer that might reference this domain
      const snippet = answer.length > 200 ? answer.slice(0, 200) + '…' : answer
      return { url, title: domain, snippet }
    })

    // Check if client domain appears in any citation URL
    const clientDomain = extractDomain(clientConfig.url)
    const clientCited = citationUrls.some((url) =>
      extractDomain(url).includes(clientDomain)
    )
    const clientUrl = clientCited
      ? (citationUrls.find((url) => extractDomain(url).includes(clientDomain)) ?? null)
      : null

    // Extract competitor domains (citations that are NOT the client)
    const competitors = clientCited
      ? []
      : citationUrls
          .map(extractDomain)
          .filter((d) => !d.includes(clientDomain))
          .filter((d, i, arr) => arr.indexOf(d) === i) // unique

    // Generate recommendations via Claude Haiku if client not cited
    let recommendations: string[] = []
    if (!clientCited) {
      const competitorList =
        competitors.length > 0 ? competitors.join(', ') : 'unknown competitors'

      const message = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: `Client ${clientConfig.name} was not cited for '${query}'. Competitors cited: ${competitorList}. Generate 3 specific content recommendations to win this query.`,
          },
        ],
      })

      const rawText =
        message.content[0].type === 'text' ? message.content[0].text : ''

      // Parse out 3 recommendations — handle numbered lists or plain paragraphs
      const lines = rawText
        .split('\n')
        .map((l) => l.replace(/^\s*\d+[\.\)]\s*/, '').trim())
        .filter((l) => l.length > 10)

      recommendations = lines.slice(0, 3)
    }

    return {
      query,
      clientCited,
      clientUrl,
      citedSources,
      competitors,
      answer,
      testedAt,
      recommendations,
    }
  }

  async testAllQueries(
    clientId: string,
    clientConfig: ClientConfig
  ): Promise<AEOTestResult[]> {
    const results: AEOTestResult[] = []

    for (const query of clientConfig.aeoQueries) {
      const result = await this.testQuery(query, clientConfig)
      await this.saveResult(clientId, result)
      results.push(result)

      // Rate limit: 1 request/second
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    return results
  }

  async saveResult(clientId: string, result: AEOTestResult): Promise<void> {
    const { error } = await supabaseAdmin
      .from('bloom_engine.aeo_queries')
      .upsert(
        {
          client_id: clientId,
          query: result.query,
          client_cited: result.clientCited,
          client_url: result.clientUrl,
          cited_sources: result.citedSources,
          competitors: result.competitors,
          answer: result.answer,
          last_tested: result.testedAt,
          recommendations: result.recommendations,
        },
        { onConflict: 'client_id,query' }
      )

    if (error) {
      throw new Error(`Failed to save AEO result: ${error.message}`)
    }
  }
}
