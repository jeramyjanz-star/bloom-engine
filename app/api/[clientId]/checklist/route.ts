import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/src/lib/supabase'

interface RouteParams {
  params: { clientId: string }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { clientId } = params

  let itemKey: string | undefined
  let completed: boolean | undefined
  try {
    const body = await request.json() as { itemKey?: string; completed?: boolean }
    itemKey = body.itemKey
    completed = body.completed
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!itemKey || typeof completed !== 'boolean') {
    return NextResponse.json({ error: 'itemKey and completed required' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .schema('bloom_engine')
    .from('launch_checklist')
    .upsert(
      {
        client_id: clientId,
        item_key: itemKey,
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      },
      { onConflict: 'client_id,item_key' }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
