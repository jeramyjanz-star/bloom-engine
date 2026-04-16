import { NextRequest, NextResponse } from 'next/server'
import { ContentEngine, type QABlock } from '@/src/lib/content-engine'
import { loadClientConfig } from '@/src/lib/client-loader'

interface RouteParams {
  params: { clientId: string }
}

type GenerateRequestBody = {
  type: string
  topic?: string
  targetKeyword?: string
  city?: string
  gmbType?: 'update' | 'offer' | 'event' | 'product'
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { clientId } = params

  let body: GenerateRequestBody
  try {
    body = (await request.json()) as GenerateRequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { type, topic, targetKeyword, city, gmbType } = body

  if (!type || typeof type !== 'string') {
    return NextResponse.json(
      { error: 'Missing required field: type' },
      { status: 400 }
    )
  }

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY
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

  const engine = new ContentEngine(anthropicApiKey)

  try {
    switch (type) {
      case 'blog': {
        if (!topic || typeof topic !== 'string') {
          return NextResponse.json(
            { error: 'type "blog" requires field: topic' },
            { status: 400 }
          )
        }
        const keyword = targetKeyword ?? topic
        const content = await engine.generateBlogPost(clientId, topic, keyword, clientConfig)
        const id = await engine.saveToDatabase(clientId, content, 'blog')
        return NextResponse.json({ id, type: 'blog', content })
      }

      case 'location': {
        const targetCity = city ?? topic
        if (!targetCity || typeof targetCity !== 'string') {
          return NextResponse.json(
            { error: 'type "location" requires field: city (or topic)' },
            { status: 400 }
          )
        }
        const content = await engine.generateLocationPage(clientId, targetCity, clientConfig)
        const id = await engine.saveToDatabase(clientId, content, 'location')
        return NextResponse.json({ id, type: 'location', content })
      }

      case 'gmb': {
        if (!topic || typeof topic !== 'string') {
          return NextResponse.json(
            { error: 'type "gmb" requires field: topic' },
            { status: 400 }
          )
        }
        const postType = gmbType ?? 'update'
        const validGmbTypes = ['update', 'offer', 'event', 'product'] as const
        if (!validGmbTypes.includes(postType as (typeof validGmbTypes)[number])) {
          return NextResponse.json(
            { error: 'gmbType must be one of: update, offer, event, product' },
            { status: 400 }
          )
        }
        const content = await engine.generateGMBPost(
          clientId,
          postType as 'update' | 'offer' | 'event' | 'product',
          topic,
          clientConfig
        )
        const id = await engine.saveToDatabase(clientId, content, 'gmb')
        return NextResponse.json({ id, type: 'gmb', content })
      }

      case 'qa': {
        const blocks = await engine.generateQAContent(clientId, clientConfig)
        // Save each QA block individually; return all IDs
        const ids: string[] = []
        for (const block of blocks) {
          const id = await engine.saveToDatabase(clientId, block, 'qa')
          ids.push(id)
        }
        return NextResponse.json({ ids, type: 'qa', content: blocks })
      }

      default:
        return NextResponse.json(
          {
            error: `Unknown type "${type}". Valid types: blog, location, gmb, qa`,
          },
          { status: 400 }
        )
    }
  } catch (err) {
    console.error(`[content/generate] error for type=${type}:`, err)
    return NextResponse.json(
      { error: `Content generation failed: ${String(err)}` },
      { status: 500 }
    )
  }
}
