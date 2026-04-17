import { type NextRequest, NextResponse } from 'next/server'
import { listClients, loadClientConfig } from '@/src/lib/client-loader'
import { generateDailyPost } from '@/src/lib/agents/gmb-content-brain'
import { sendApprovalEmail } from '@/src/lib/agents/gmb-approval-gate'
import { supabaseAdmin } from '@/src/lib/supabase'

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

function checkInternalAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') ?? ''
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false
  return authHeader === `Bearer ${secret}`
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClientResult {
  clientId: string
  postId: string | null
  status: 'sent' | 'failed'
  error?: string
}

// ---------------------------------------------------------------------------
// POST handler — triggered by n8n cron at 7am PT daily
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!checkInternalAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { clientId?: string } = {}
  try {
    body = (await req.json()) as { clientId?: string }
  } catch {
    // Body is optional — empty body means run for all clients
  }

  // Resolve the list of clients to process
  let clientIds: string[]
  if (body.clientId) {
    clientIds = [body.clientId]
  } else {
    try {
      const allClients = await listClients()
      clientIds = allClients.map((c) => c.id)
    } catch (err) {
      return NextResponse.json(
        { error: `Failed to list clients: ${String(err)}` },
        { status: 500 }
      )
    }
  }

  const results: ClientResult[] = []

  for (const clientId of clientIds) {
    try {
      // a. Load config
      const config = await loadClientConfig(clientId)

      // b. Generate the daily post
      const generatedPost = await generateDailyPost(clientId, config)

      // c. Save to gmb_post_log
      const { data: insertedRows, error: insertError } = await supabaseAdmin
        .schema('bloom_engine')
        .from('gmb_post_log')
        .insert({
          client_id: clientId,
          post_type: generatedPost.postType,
          content: JSON.stringify(generatedPost),
          status: 'pending_approval',
          created_at: new Date().toISOString(),
        })
        .select('id')
        .single()

      if (insertError || !insertedRows) {
        throw new Error(
          `DB insert failed: ${insertError?.message ?? 'no row returned'}`
        )
      }

      const newPostId = (insertedRows as { id: string }).id

      // d. Send approval email
      await sendApprovalEmail(clientId, newPostId, generatedPost, config)

      results.push({ clientId, postId: newPostId, status: 'sent' })
      console.info(`[gmb/generate-daily] Processed client "${clientId}" — post ${newPostId}`)
    } catch (err) {
      const errorMsg = String(err)
      console.error(`[gmb/generate-daily] Failed for client "${clientId}":`, errorMsg)
      results.push({ clientId, postId: null, status: 'failed', error: errorMsg })
      // Continue to next client — do not abort
    }
  }

  const processed = results.filter((r) => r.status === 'sent').length

  return NextResponse.json({
    processed,
    results,
  })
}
