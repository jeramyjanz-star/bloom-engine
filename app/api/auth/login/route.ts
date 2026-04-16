import { NextRequest, NextResponse } from 'next/server'

const FALLBACK_PASSWORD = 'AnchorBloom2026'

export async function POST(request: NextRequest): Promise<NextResponse> {
  let password: string | undefined
  try {
    const body = await request.json() as { password?: string }
    password = body.password
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!password || typeof password !== 'string') {
    return NextResponse.json({ error: 'Password required' }, { status: 400 })
  }

  const adminPassword = process.env.BLOOM_ADMIN_PASSWORD
  const effectivePassword = adminPassword ?? FALLBACK_PASSWORD

  console.log('[auth/login] submitted length:', password.length)
  console.log('[auth/login] submitted chars:', JSON.stringify(password))
  console.log('[auth/login] env var present:', adminPassword !== undefined)
  console.log('[auth/login] effective length:', effectivePassword.length)
  console.log('[auth/login] match:', password === effectivePassword)

  if (password !== effectivePassword) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set('bloom_auth', Buffer.from(effectivePassword).toString('base64'), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  return response
}
