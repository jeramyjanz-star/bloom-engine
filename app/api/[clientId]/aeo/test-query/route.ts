import { NextRequest, NextResponse } from 'next/server'
import { PerplexityEngine } from '@/src/lib/perplexity-engine'
import { loadClientConfig } from '@/src/lib/client-loader'

interface RouteParams {
  params: { clientId: string }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { clientId } = params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { query } = body as { query?: string }

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return NextResponse.json(
      { error: 'Missing required field: query (non-empty string)' },
      { status: 400 }
    )
  }

  const perplexityApiKey = process.env.PERPLEXITY_API_KEY
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY

  if (!perplexityApiKey) {
    return NextResponse.json(
      { error: 'Server configuration error: PERPLEXITY_API_KEY not set' },
      { status: 500 }
    )
  }
  if (!anthropicApiKey) {
    return NextResponse.json(
      { error: 'Server configuration error: ANTHROPIC_API_KEY not set' },
      { status: 500 }
    )
  }

  let clientConfig
  try {
    clientConfig = await loadClientConfig(clientId)
  } catch (err) {
    return NextResponse.json(
      { error: `Client not found: ${String(err)}` },
      { status: 404 }
    )
  }

  const engine = new PerplexityEngine(perplexityApiKey, anthropicApiKey)

  try {
    const result = await engine.testQuery(query.trim(), clientConfig)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[aeo/test-query] error:', err)
    return NextResponse.json(
      { error: `Query test failed: ${String(err)}` },
      { status: 500 }
    )
  }
}
