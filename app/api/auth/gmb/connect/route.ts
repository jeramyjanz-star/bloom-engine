import { type NextRequest, NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// GET /api/auth/gmb/connect?client={clientId}
//
// Initiates the Google OAuth 2.0 flow for Google Business Profile.
// Redirects the browser to Google's consent screen.
// After the user grants access, Google redirects to /api/auth/gmb/callback.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client')

  if (!clientId || typeof clientId !== 'string' || clientId.trim() === '') {
    return NextResponse.json(
      { error: 'Missing required query param: client' },
      { status: 400 }
    )
  }

  const gmbClientId = process.env.GMB_CLIENT_ID
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')

  if (!gmbClientId) {
    return NextResponse.json(
      { error: 'Server configuration error: GMB_CLIENT_ID not set' },
      { status: 500 }
    )
  }

  if (!appUrl) {
    return NextResponse.json(
      { error: 'Server configuration error: NEXT_PUBLIC_APP_URL not set' },
      { status: 500 }
    )
  }

  const redirectUri = `${appUrl}/api/auth/gmb/callback`

  const oauthParams = new URLSearchParams({
    client_id: gmbClientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/business.manage',
    access_type: 'offline',
    prompt: 'consent',
    state: clientId.trim(),
  })

  const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${oauthParams.toString()}`

  return NextResponse.redirect(oauthUrl)
}
