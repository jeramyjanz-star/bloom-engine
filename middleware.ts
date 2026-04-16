import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only protect /dashboard/* — but NOT /dashboard/login
  if (pathname.startsWith('/dashboard') && !pathname.startsWith('/dashboard/login')) {
    const authCookie = request.cookies.get('bloom_auth')
    const adminPassword = process.env.BLOOM_ADMIN_PASSWORD

    if (!authCookie || !adminPassword) {
      return NextResponse.redirect(new URL('/dashboard/login', request.url))
    }

    let decoded: string
    try {
      decoded = Buffer.from(authCookie.value, 'base64').toString('utf-8')
    } catch {
      return NextResponse.redirect(new URL('/dashboard/login', request.url))
    }

    if (decoded !== adminPassword) {
      return NextResponse.redirect(new URL('/dashboard/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
