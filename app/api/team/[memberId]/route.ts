import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/src/lib/supabase'

// TODO: derive clientId from request context (subdomain/session) when 2nd client onboards
const CLIENT_ID = 'fboc'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
): Promise<NextResponse> {
  const { memberId } = await params

  // Fetch the member being removed
  const { data: target, error: fetchError } = await supabaseAdmin
    .from('team_members')
    .select('id, email, role, client_id')
    .eq('id', memberId)
    .eq('client_id', CLIENT_ID)
    .single()

  if (fetchError || !target) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  // Protect the owner from removal
  if (target.role === 'owner') {
    return NextResponse.json({ error: 'Cannot remove the owner' }, { status: 403 })
  }

  // Get requester email from header (set by auth middleware or client)
  const requesterEmail = request.headers.get('x-user-email')?.toLowerCase()
  if (!requesterEmail) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Verify requester is admin or owner of this client
  const { data: requester } = await supabaseAdmin
    .from('team_members')
    .select('role')
    .eq('client_id', CLIENT_ID)
    .eq('email', requesterEmail)
    .single()

  if (!requester || !['admin', 'owner'].includes(requester.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const { error: deleteError } = await supabaseAdmin
    .from('team_members')
    .delete()
    .eq('id', memberId)
    .eq('client_id', CLIENT_ID)

  if (deleteError) {
    console.error('[team/delete]', deleteError)
    return NextResponse.json({ error: 'Failed to remove team member' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
