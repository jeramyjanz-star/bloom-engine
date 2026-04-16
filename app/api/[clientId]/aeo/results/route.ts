import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/src/lib/supabase'
import { loadClientConfig } from '@/src/lib/client-loader'

interface RouteParams {
  params: { clientId: string }
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { clientId } = params

  // Verify client exists
  try {
    await loadClientConfig(clientId)
  } catch (err) {
    return NextResponse.json(
      { error: `Client not found: ${String(err)}` },
      { status: 404 }
    )
  }

  const { data, error } = await supabaseAdmin
    .from('bloom_engine.aeo_queries')
    .select('*')
    .eq('client_id', clientId)
    .order('last_tested', { ascending: false })

  if (error) {
    console.error('[aeo/results] Supabase error:', error)
    return NextResponse.json(
      { error: `Failed to fetch AEO results: ${error.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ clientId, results: data ?? [] })
}
