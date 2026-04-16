import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { Resend } from 'resend'

function generateToken(email: string, secret: string): string {
  const timestamp = Date.now().toString()
  const payload = Buffer.from(`${email}:${timestamp}`).toString('base64url')
  const sig = createHmac('sha256', secret).update(`${email}:${timestamp}`).digest('hex')
  return `${payload}.${sig}`
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let email: string | undefined
  try {
    const body = await request.json() as { email?: string }
    email = body.email?.trim().toLowerCase()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  if (email !== 'jeramyjanz@gmail.com') {
    return NextResponse.json({ error: 'Unauthorized email address' }, { status: 403 })
  }

  const secret = process.env.BLOOM_ADMIN_PASSWORD
  const resendKey = process.env.RESEND_API_KEY
  if (!secret || !resendKey) {
    return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
  }

  const token = generateToken(email, secret)
  const baseUrl = request.headers.get('origin') ?? `https://${request.headers.get('host')}`
  const magicUrl = `${baseUrl}/api/auth/verify?token=${token}`

  const resend = new Resend(resendKey)
  const { error } = await resend.emails.send({
    from: 'BLOOM ENGINE <alex@xlumenx.com>',
    to: email,
    subject: 'Your BLOOM ENGINE access link',
    html: `
      <div style="font-family:monospace;background:#0D0D0D;color:#EDEDED;padding:40px;max-width:480px;">
        <div style="font-size:20px;color:#D4AF6A;letter-spacing:0.06em;margin-bottom:8px;">BLOOM ENGINE</div>
        <div style="font-size:11px;color:#94A3B8;letter-spacing:0.15em;margin-bottom:32px;text-transform:uppercase;">ANCHOR Intelligence Platform</div>
        <p style="color:#EDEDED;font-size:14px;line-height:1.6;margin-bottom:24px;">Click the link below to access your dashboard. This link expires in 1 hour.</p>
        <a href="${magicUrl}" style="display:inline-block;background:linear-gradient(135deg,#D4AF6A,#B8943A);color:#0D0D0D;padding:12px 24px;text-decoration:none;font-weight:600;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;">ACCESS DASHBOARD →</a>
        <p style="color:#94A3B8;font-size:11px;margin-top:32px;">If you didn't request this, ignore this email.</p>
      </div>
    `,
  })

  if (error) {
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
