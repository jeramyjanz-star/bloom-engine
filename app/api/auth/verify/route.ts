import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'

const TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get('token')
  const secret = process.env.BLOOM_ADMIN_PASSWORD
  const baseUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}`

  if (!token || !secret) {
    return NextResponse.redirect(new URL('/dashboard?ml=error', baseUrl))
  }

  const dotIdx = token.lastIndexOf('.')
  if (dotIdx === -1) {
    return NextResponse.redirect(new URL('/dashboard?ml=error', baseUrl))
  }

  let email: string
  let timestamp: number
  try {
    const payload = Buffer.from(token.slice(0, dotIdx), 'base64url').toString('utf-8')
    const colonIdx = payload.lastIndexOf(':')
    email = payload.slice(0, colonIdx)
    timestamp = parseInt(payload.slice(colonIdx + 1), 10)
    if (!email || isNaN(timestamp)) throw new Error('invalid')
  } catch {
    return NextResponse.redirect(new URL('/dashboard?ml=error', baseUrl))
  }

  // Verify HMAC
  const expectedSig = createHmac('sha256', secret)
    .update(`${email}:${timestamp}`)
    .digest('hex')
  if (token.slice(dotIdx + 1) !== expectedSig) {
    return NextResponse.redirect(new URL('/dashboard?ml=error', baseUrl))
  }

  // Check TTL
  if (Date.now() - timestamp > TOKEN_TTL_MS) {
    return NextResponse.redirect(new URL('/dashboard?ml=expired', baseUrl))
  }

  return NextResponse.redirect(new URL('/dashboard?ml=1', baseUrl))
}
