import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always allow login page — must never be redirected
  if (pathname.startsWith('/dashboard/login')) {
    return NextResponse.next()
  }

  // Always allow API and Next.js internals
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/')) {
    return NextResponse.next()
  }

  // Protect all other /dashboard routes
  if (pathname.startsWith('/dashboard')) {
    const authCookie = request.cookies.get('bloom_auth')
    if (!authCookie?.value) {
      return NextResponse.redirect(new URL('/dashboard/login', request.url))
    }

    const adminPassword = process.env.BLOOM_ADMIN_PASSWORD
    if (!adminPassword) {
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
  matcher: ['/dashboard/:path*', '/api/:path*'],
}
