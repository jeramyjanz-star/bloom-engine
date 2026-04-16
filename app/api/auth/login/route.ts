import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { password } = body as { password?: string }

  if (!password || typeof password !== 'string') {
    return NextResponse.json({ error: 'Missing password' }, { status: 400 })
  }

  const adminPassword = process.env.BLOOM_ADMIN_PASSWORD
  if (!adminPassword) {
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    )
  }

  if (password !== adminPassword) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const token = Buffer.from(adminPassword).toString('base64')

  const response = NextResponse.json({ success: true })
  response.cookies.set('bloom_auth', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })

  return response
}
