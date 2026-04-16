import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const contentType = request.headers.get('content-type') ?? ''
  const isFormPost = contentType.includes('application/x-www-form-urlencoded')

  let password: string | undefined

  if (isFormPost) {
    const text = await request.text()
    const params = new URLSearchParams(text)
    password = params.get('password') ?? undefined
  } else {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    password = (body as { password?: string }).password
  }

  if (!password || typeof password !== 'string') {
    if (isFormPost) {
      return NextResponse.redirect(new URL('/dashboard/login?error=missing', request.url), 303)
    }
    return NextResponse.json({ error: 'Missing password' }, { status: 400 })
  }

  const adminPassword = process.env.BLOOM_ADMIN_PASSWORD
  if (!adminPassword) {
    if (isFormPost) {
      return NextResponse.redirect(new URL('/dashboard/login?error=config', request.url), 303)
    }
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  if (password !== adminPassword) {
    if (isFormPost) {
      return NextResponse.redirect(new URL('/dashboard/login?error=invalid', request.url), 303)
    }
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const token = Buffer.from(adminPassword).toString('base64')

  const redirectTo = isFormPost
    ? NextResponse.redirect(new URL('/dashboard', request.url), 303)
    : NextResponse.json({ success: true })

  redirectTo.cookies.set('bloom_auth', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })

  return redirectTo
}
