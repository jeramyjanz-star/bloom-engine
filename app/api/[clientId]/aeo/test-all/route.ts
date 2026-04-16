import { NextRequest } from 'next/server'
import { PerplexityEngine } from '@/src/lib/perplexity-engine'
import { loadClientConfig } from '@/src/lib/client-loader'

interface RouteParams {
  params: { clientId: string }
}

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  const { clientId } = params

  const perplexityApiKey = process.env.PERPLEXITY_API_KEY
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY

  if (!perplexityApiKey || !anthropicApiKey) {
    return new Response(
      JSON.stringify({ error: 'Missing API key environment variables' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  let clientConfig
  try {
    clientConfig = await loadClientConfig(clientId)
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Client not found: ${String(err)}` }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const encoder = new TextEncoder()
  const queries = clientConfig.aeoQueries
  const engine = new PerplexityEngine(perplexityApiKey, anthropicApiKey)

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial metadata
      controller.enqueue(
        encoder.encode(
          sseEvent('start', { clientId, totalQueries: queries.length })
        )
      )

      for (let i = 0; i < queries.length; i++) {
        const query = queries[i]

        controller.enqueue(
          encoder.encode(
            sseEvent('progress', {
              index: i,
              total: queries.length,
              query,
              status: 'testing',
            })
          )
        )

        try {
          const result = await engine.testQuery(query, clientConfig)
          await engine.saveResult(clientId, result)

          controller.enqueue(
            encoder.encode(
              sseEvent('result', {
                index: i,
                total: queries.length,
                query,
                result,
              })
            )
          )
        } catch (err) {
          controller.enqueue(
            encoder.encode(
              sseEvent('error', {
                index: i,
                query,
                error: String(err),
              })
            )
          )
        }

        // Rate limit: 1 request/second — skip delay after last item
        if (i < queries.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      }

      controller.enqueue(
        encoder.encode(sseEvent('done', { clientId, totalQueries: queries.length }))
      )
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
