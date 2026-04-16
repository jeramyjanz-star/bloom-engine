import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/src/lib/supabase'

export async function GET(
  _request: NextRequest,
  { params }: { params: { clientId: string } }
): Promise<NextResponse> {
  const { clientId } = params

  const { data, error } = await supabaseAdmin
    .schema('bloom_engine')
    .from('seo_audits')
    .select('*')
    .eq('client_id', clientId)
    .order('crawled_at', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    const status = error.code === 'PGRST116' ? 404 : 500
    return NextResponse.json(
      {
        error:
          status === 404
            ? `No audit found for client "${clientId}".`
            : `Database error: ${error.message}`,
      },
      { status }
    )
  }

  return NextResponse.json(data, { status: 200 })
}
