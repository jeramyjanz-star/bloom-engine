import { type NextRequest } from 'next/server'
import { verifyToken, sendSkipConfirmationEmail } from '@/src/lib/agents/gmb-approval-gate'
import { loadClientConfig } from '@/src/lib/client-loader'
import { supabaseAdmin } from '@/src/lib/supabase'

// ---------------------------------------------------------------------------
// Shared HTML helpers
// ---------------------------------------------------------------------------

function errorPage(message: string): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Link Expired — BLOOM ENGINE</title>
</head>
<body style="margin:0;padding:0;background:#0D0D0D;">
  <div style="background:#0D0D0D;color:#EDEDED;font-family:'IBM Plex Mono',monospace;max-width:600px;margin:0 auto;padding:60px 40px;text-align:center;">
    <div style="font-size:10px;color:#D4AF6A;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:32px;">BLOOM ENGINE</div>
    <div style="font-size:32px;margin-bottom:20px;">&#x26A0;&#xFE0F;</div>
    <div style="font-size:16px;color:#EDEDED;margin-bottom:16px;">Link Expired</div>
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

function skippedPage(): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Post Skipped — BLOOM ENGINE</title>
</head>
<body style="margin:0;padding:0;background:#0D0D0D;">
  <div style="background:#0D0D0D;color:#EDEDED;font-family:'IBM Plex Mono',monospace;max-width:600px;margin:0 auto;padding:60px 40px;text-align:center;">
    <div style="font-size:10px;color:#D4AF6A;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:32px;">BLOOM ENGINE</div>
    <div style="font-size:48px;margin-bottom:20px;">&#x23ED;&#xFE0F;</div>
    <div style="font-size:18px;color:#EDEDED;font-weight:700;margin-bottom:16px;letter-spacing:0.05em;">Skipped</div>
    <div style="font-size:12px;color:#94A3B8;line-height:1.8;">
      No post today — we'll send tomorrow's for approval.
    </div>
    <div style="margin-top:32px;padding:16px;background:#161616;border-left:2px solid #D4AF6A;text-align:left;">
      <div style="font-size:10px;color:#94A3B8;letter-spacing:0.08em;">A confirmation has been sent to your email.</div>
    </div>
    <div style="font-size:9px;color:#3F3F3F;letter-spacing:0.1em;margin-top:60px;">POWERED BY BLOOM ENGINE &times; ANCHOR</div>
  </div>
</body>
</html>`
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  })
}

// ---------------------------------------------------------------------------
// GET /api/agents/gmb/skip?token=...
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token') ?? ''

  // 1. Verify token
  const payload = verifyToken(token)
  if (!payload) {
    return errorPage(
      'This link has expired. Please check tomorrow\'s email for a new post.'
    )
  }

  const { clientId, postId } = payload

  try {
    // 2. Load client config
    const config = await loadClientConfig(clientId)

    // 3. Update gmb_post_log: set status = 'skipped'
    const { error } = await supabaseAdmin
      .schema('bloom_engine')
      .from('gmb_post_log')
      .update({ status: 'skipped' })
      .eq('id', postId)

    if (error) {
      console.error('[gmb/skip] Supabase update error:', error)
      return errorPage('Something went wrong. Please contact alex@xlumenx.com.')
    }

    // 4. Send skip confirmation email
    await sendSkipConfirmationEmail(clientId, config)

    // 5. Return HTML page
    return skippedPage()
  } catch (err) {
    console.error('[gmb/skip] Unexpected error:', err)
    return errorPage('An unexpected error occurred. Please contact alex@xlumenx.com.')
  }
}
