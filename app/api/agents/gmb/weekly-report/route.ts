import { type NextRequest, NextResponse } from 'next/server'
import { listClients } from '@/src/lib/client-loader'
import { runWeeklyReport } from '@/src/lib/agents/gmb-performance-tracker'

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
  status: 'sent' | 'failed'
  error?: string
}

// ---------------------------------------------------------------------------
// POST handler — triggered by n8n cron at 8am PT every Monday
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
      await runWeeklyReport(clientId)
      results.push({ clientId, status: 'sent' })
      console.info(`[gmb/weekly-report] Completed for client "${clientId}"`)
    } catch (err) {
      const errorMsg = String(err)
      console.error(`[gmb/weekly-report] Failed for client "${clientId}":`, errorMsg)
      results.push({ clientId, status: 'failed', error: errorMsg })
      // Continue to next client — do not abort
    }
  }

  const processed = results.filter((r) => r.status === 'sent').length

  return NextResponse.json({
    processed,
    results,
  })
}
