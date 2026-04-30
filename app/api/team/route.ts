import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/src/lib/supabase'

// TODO: derive clientId from request context (subdomain/session) when 2nd client onboards
const CLIENT_ID = 'fboc'

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const { data, error } = await supabaseAdmin
    .from('team_members')
    .select('id, client_id, email, role, invited_at, accepted_at, created_at')
    .eq('client_id', CLIENT_ID)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[team/GET]', error)
    return NextResponse.json({ error: 'Failed to fetch team members' }, { status: 500 })
  }

  return NextResponse.json({ members: data })
}
