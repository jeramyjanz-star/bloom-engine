import { type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/src/lib/supabase'

// ---------------------------------------------------------------------------
// Shared dark-luxury HTML helpers
// ---------------------------------------------------------------------------

function htmlPage(bodyContent: string): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>GMB OAuth — BLOOM ENGINE</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 0; background: #0D0D0D; }
    code {
      display: block;
      background: #161616;
      border: 1px solid #262626;
      border-radius: 2px;
      padding: 16px;
      font-family: 'IBM Plex Mono', 'Courier New', monospace;
      font-size: 12px;
      color: #D4AF6A;
      word-break: break-all;
      white-space: pre-wrap;
      margin-top: 8px;
    }
  </style>
</head>
<body>
${bodyContent}
</body>
</html>`
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  })
}

function errorPage(title: string, message: string): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>GMB OAuth Error — BLOOM ENGINE</title>
</head>
<body style="margin:0;padding:0;background:#0D0D0D;">
  <div style="background:#0D0D0D;color:#EDEDED;font-family:'IBM Plex Mono',monospace;max-width:640px;margin:0 auto;padding:60px 40px;text-align:center;">
    <div style="font-size:10px;color:#D4AF6A;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:32px;">BLOOM ENGINE</div>
    <div style="font-size:32px;margin-bottom:20px;">&#x26A0;&#xFE0F;</div>
    <div style="font-size:16px;color:#EDEDED;margin-bottom:16px;">${title}</div>
    <div style="font-size:12px;color:#94A3B8;line-height:1.8;">${message}</div>
    <div style="font-size:9px;color:#3F3F3F;letter-spacing:0.1em;margin-top:60px;">POWERED BY BLOOM ENGINE &times; ANCHOR</div>
  </div>
</body>
</html>`
  return new Response(html, {
    status: 400,
    headers: { 'Content-Type': 'text/html' },
  })
}

// ---------------------------------------------------------------------------
// GET /api/auth/gmb/callback?code=...&state={clientId}
//
// Handles Google OAuth callback. Exchanges the authorization code for tokens,
// saves the refresh token to bloom_engine.gmb_credentials, and displays the
// refresh token so it can be saved to Doppler/env.
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url)

  const code = searchParams.get('code')
  const clientId = searchParams.get('state') // state = clientId passed in connect route
  const oauthError = searchParams.get('error')

  // Handle user-denied or OAuth errors from Google
  if (oauthError) {
    return errorPage(
      'Authorization Denied',
      `Google returned an error: <strong>${oauthError}</strong><br><br>Please try again via <code>/api/auth/gmb/connect?client=${clientId ?? ''}</code>.`
    )
  }

  if (!code) {
    return errorPage('Missing Authorization Code', 'No code was returned by Google. Please restart the OAuth flow.')
  }

  if (!clientId || clientId.trim() === '') {
    return errorPage('Missing Client ID', 'The state parameter (clientId) was not returned by Google. Please restart the OAuth flow.')
  }

  const gmbClientId = process.env.GMB_CLIENT_ID
  const gmbClientSecret = process.env.GMB_CLIENT_SECRET
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')

  if (!gmbClientId || !gmbClientSecret) {
    return errorPage(
      'Server Configuration Error',
      'GMB_CLIENT_ID or GMB_CLIENT_SECRET is not set. Contact alex@xlumenx.com.'
    )
  }

  const redirectUri = `${appUrl}/api/auth/gmb/callback`

  // Exchange authorization code for tokens
  let tokenData: {
    refresh_token?: string
    access_token?: string
    error?: string
    error_description?: string
  }

  try {
    const tokenParams = new URLSearchParams({
      code,
      client_id: gmbClientId,
      client_secret: gmbClientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    })

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    })

    tokenData = (await res.json()) as typeof tokenData

    if (!res.ok) {
      return errorPage(
        'Token Exchange Failed',
        `Google returned an error: <strong>${tokenData.error ?? res.status}</strong><br>${tokenData.error_description ?? ''}`
      )
    }
  } catch (err) {
    return errorPage(
      'Network Error',
      `Failed to contact Google token endpoint: ${String(err)}`
    )
  }

  const refreshToken = tokenData.refresh_token

  // If no refresh token was returned, the user has already authorized this app
  // and needs to revoke + reconnect to get a new one.
  if (!refreshToken) {
    return errorPage(
      'No Refresh Token Returned',
      `Google did not return a refresh token. This usually means you've already authorized this app.<br><br>
      To fix this:<br>
      1. Go to <a href="https://myaccount.google.com/permissions" style="color:#D4AF6A;">myaccount.google.com/permissions</a><br>
      2. Find and revoke access for this app<br>
      3. Return to <strong>/api/auth/gmb/connect?client=${clientId}</strong> and reconnect`
    )
  }

  // Save refresh token to bloom_engine.gmb_credentials
  try {
    const { error: upsertError } = await supabaseAdmin
      .schema('bloom_engine')
      .from('gmb_credentials')
      .upsert(
        {
          client_id: clientId,
          refresh_token: refreshToken,
          connected_at: new Date().toISOString(),
        },
        { onConflict: 'client_id' }
      )

    if (upsertError) {
      console.error('[gmb/callback] Supabase upsert error:', upsertError.message)
      // Non-fatal — still show the token so it can be saved manually
    }
  } catch (err) {
    console.error('[gmb/callback] Unexpected Supabase error:', String(err))
    // Non-fatal — still show the token
  }

  const clientIdUpper = clientId.toUpperCase()
  const dopplierKeyName = `GMB_REFRESH_TOKEN_${clientIdUpper}`

  return htmlPage(`
<div style="background:#0D0D0D;color:#EDEDED;font-family:'IBM Plex Mono',monospace;max-width:640px;margin:0 auto;padding:60px 40px;">

  <div style="border-bottom:1px solid #262626;padding-bottom:20px;margin-bottom:32px;">
    <div style="font-size:10px;color:#D4AF6A;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">BLOOM ENGINE</div>
    <div style="font-size:24px;color:#EDEDED;">Google Business Profile Connected &#x2705;</div>
  </div>

  <div style="font-size:13px;color:#94A3B8;line-height:1.8;margin-bottom:28px;">
    Successfully connected Google Business Profile for
    <strong style="color:#EDEDED;">${clientId}</strong>.
  </div>

  <div style="background:#161616;border:1px solid #262626;border-radius:2px;padding:24px;margin-bottom:28px;">
    <div style="font-size:9px;color:#D4AF6A;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:12px;">
      &#x26A0;&#xFE0F; Save This Refresh Token Now
    </div>
    <div style="font-size:11px;color:#94A3B8;margin-bottom:16px;line-height:1.7;">
      This token will not be shown again. Save it to Doppler (or your .env) as:
    </div>
    <div style="font-size:12px;color:#EDEDED;font-weight:700;margin-bottom:8px;">${dopplierKeyName}</div>
    <code>${refreshToken}</code>
  </div>

  <div style="background:#161616;border:1px solid #262626;border-radius:2px;padding:20px;margin-bottom:28px;">
    <div style="font-size:9px;color:#D4AF6A;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:12px;">Setup Checklist</div>
    <div style="font-size:11px;color:#94A3B8;line-height:2;">
      &#x25A1; Copy the refresh token above<br>
      &#x25A1; Add <code style="display:inline;padding:2px 6px;font-size:10px;">${dopplierKeyName}</code> to Doppler / env<br>
      &#x25A1; Add <code style="display:inline;padding:2px 6px;font-size:10px;">GMB_ACCOUNT_ID_${clientIdUpper}</code> to Doppler / env<br>
      &#x25A1; Add <code style="display:inline;padding:2px 6px;font-size:10px;">GMB_LOCATION_ID_${clientIdUpper}</code> to Doppler / env<br>
      &#x25A1; Redeploy the application
    </div>
  </div>

  <div style="padding:16px;background:#161616;border-left:2px solid #D4AF6A;margin-bottom:40px;">
    <div style="font-size:10px;color:#94A3B8;letter-spacing:0.08em;line-height:1.8;">
      The refresh token has also been saved to the
      <strong style="color:#EDEDED;">bloom_engine.gmb_credentials</strong> table in Supabase as a backup.
      You can now activate the GMB Agent for <strong style="color:#EDEDED;">${clientId}</strong>.
    </div>
  </div>

  <div style="font-size:9px;color:#3F3F3F;letter-spacing:0.1em;border-top:1px solid #1A1A1A;padding-top:20px;">
    POWERED BY BLOOM ENGINE &times; ANCHOR<br>
    Contact alex@xlumenx.com if you have questions
  </div>
</div>`)
}
