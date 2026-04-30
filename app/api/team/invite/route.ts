import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/src/lib/supabase'
import { sendClientEmail } from '@/src/lib/email/client'
import { loadClientConfig } from '@/src/lib/client-loader'
import crypto from 'crypto'

// TODO: derive clientId from request context (subdomain/session) when 2nd client onboards
const CLIENT_ID = 'fboc'

const VALID_ROLES = ['admin', 'editor', 'viewer'] as const
type Role = typeof VALID_ROLES[number]

function signInviteToken(payload: { clientId: string; email: string; role: string }): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('Missing env var: JWT_SECRET')

  const base64url = (input: string | Buffer) => {
    const buf = typeof input === 'string' ? Buffer.from(input, 'utf-8') : input
    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  }

  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64url(JSON.stringify({ ...payload, exp: Date.now() + 7 * 24 * 3600 * 1000 }))
  const sig = base64url(
    crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest()
  )
  return `${header}.${body}.${sig}`
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { email?: string; role?: string; inviterEmail?: string }
  try {
    body = await request.json() as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase()
  const role = body.role as Role | undefined
  const inviterEmail = body.inviterEmail ?? 'the team'

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }
  if (!role || !VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: `Role must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 })
  }

  // Insert team member row
  const { data: member, error: insertError } = await supabaseAdmin
    .from('team_members')
    .insert({ client_id: CLIENT_ID, email, role })
    .select()
    .single()

  if (insertError) {
    if (insertError.code === '23505') {
      return NextResponse.json({ error: 'This email is already a team member' }, { status: 409 })
    }
    console.error('[team/invite]', insertError)
    return NextResponse.json({ error: 'Failed to create team member' }, { status: 500 })
  }

  // Send invite email
  try {
    const config = await loadClientConfig(CLIENT_ID)
    const token = signInviteToken({ clientId: CLIENT_ID, email, role })
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
    const acceptUrl = `${appUrl}/invite/${token}`

    await sendClientEmail({
      clientId: CLIENT_ID,
      to: email,
      subject: `You've been invited to ${config.name}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:40px 20px;">
          <h2 style="color:#1c1917;">You've been invited</h2>
          <p style="color:#57534e;">${inviterEmail} has invited you to join <strong>${config.name}</strong> as a <strong>${role}</strong>.</p>
          <p style="margin:32px 0;">
            <a href="${acceptUrl}" style="background:#be185d;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Accept Invitation</a>
          </p>
          <p style="color:#a8a29e;font-size:12px;">This link expires in 7 days. If you didn't expect this invitation, you can safely ignore this email.</p>
        </div>
      `,
    })
  } catch (err) {
    console.error('[team/invite] email failed:', err)
    // Don't fail the invite — row is created, email failure is non-fatal
  }

  return NextResponse.json({ member }, { status: 201 })
}
