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
    .select('id, crawled_at, health_score, critical_issues, high_issues, pages_crawled')
    .eq('client_id', clientId)
    .order('crawled_at', { ascending: false })
    .limit(5)

  if (error) {
    return NextResponse.json(
      { error: `Database error: ${error.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json(
    { clientId, history: data ?? [] },
    { status: 200 }
  )
}
