import { NextRequest, NextResponse } from 'next/server'

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
  if (!adminPassword) {
    return NextResponse.json({ error: 'BLOOM_ADMIN_PASSWORD not configured in Vercel environment variables' }, { status: 500 })
  }

  if (password !== adminPassword) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set('bloom_auth', Buffer.from(adminPassword).toString('base64'), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  return response
}
