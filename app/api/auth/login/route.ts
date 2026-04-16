import { NextRequest, NextResponse } from 'next/server'

const FALLBACK_PASSWORD = 'OkiUirTYaHMVBQe3ly7J7kJuZzQOXgDR'

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
  console.log('[auth/login] BLOOM_ADMIN_PASSWORD:', adminPassword ?? '(undefined — using fallback)')

  const effectivePassword = adminPassword ?? FALLBACK_PASSWORD

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
