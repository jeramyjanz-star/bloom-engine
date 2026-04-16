import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/src/lib/supabase'

export async function GET(): Promise<NextResponse> {
  const { data, error } = await supabaseAdmin
    .schema('bloom_engine')
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json(
      { error: `Failed to fetch clients: ${error.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ clients: data ?? [] })
}
