import { type NextRequest, NextResponse } from 'next/server'
import { postApproved } from '@/src/lib/agents/gmb-posting-engine'

// ---------------------------------------------------------------------------
// POST /api/agents/gmb/post-approved
//
// Fire-and-forget endpoint called by the approve route after the owner clicks
// the approval link. Triggers the actual GBP post via the posting engine.
//
// Auth: Bearer token matching INTERNAL_API_SECRET env var.
// ---------------------------------------------------------------------------

interface PostApprovedBody {
  postId: string
  clientId: string
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Auth check — verify INTERNAL_API_SECRET Bearer token
  const authHeader = request.headers.get('Authorization') ?? ''
  const internalSecret = process.env.INTERNAL_API_SECRET

  if (internalSecret) {
    const provided = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : ''

    if (provided !== internalSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }
  // If INTERNAL_API_SECRET is not set, allow the call (internal network only).
  // This matches how the approve route fires it without a token — set the env
  // var in production to enforce auth.

  // 2. Parse body
  let body: PostApprovedBody
  try {
    body = (await request.json()) as PostApprovedBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { postId, clientId } = body

  if (!postId || typeof postId !== 'string') {
    return NextResponse.json({ error: 'Missing required field: postId' }, { status: 400 })
  }
  if (!clientId || typeof clientId !== 'string') {
    return NextResponse.json({ error: 'Missing required field: clientId' }, { status: 400 })
  }

  // 3. Call the posting engine orchestrator
  try {
    const result = await postApproved(postId, clientId)
    return NextResponse.json(result, { status: result.success ? 200 : 500 })
  } catch (err) {
    console.error('[post-approved] Unexpected error:', err)
    return NextResponse.json(
      { success: false, error: `Unexpected error: ${String(err)}` },
      { status: 500 }
    )
  }
}
