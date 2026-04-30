import { type NextRequest } from 'next/server'
import {
  verifyToken,
  sendApprovalEmail,
  type GMBPostContent,
} from '@/src/lib/agents/gmb-approval-gate'
import { loadClientConfig } from '@/src/lib/client-loader'
import { supabaseAdmin } from '@/src/lib/supabase'

// ---------------------------------------------------------------------------
// HTML helpers
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

function editFormPage(token: string, post: GMBPostContent): Response {
  // Escape HTML entities for safe insertion into attribute values and textareas
  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Edit Post — BLOOM ENGINE</title>
  <style>
    * { box-sizing: border-box; }
    body { margin:0; padding:0; background:#0D0D0D; }
    .wrap { background:#0D0D0D; color:#EDEDED; font-family:'IBM Plex Mono',monospace; max-width:600px; margin:0 auto; padding:40px; }
    .label { font-size:9px; color:#D4AF6A; letter-spacing:0.2em; text-transform:uppercase; margin-bottom:8px; }
    input, textarea {
      display:block; width:100%; background:#161616; border:1px solid #262626; color:#EDEDED;
      font-family:'IBM Plex Mono',monospace; font-size:13px; padding:12px 14px;
      border-radius:2px; outline:none; resize:vertical; margin-bottom:24px;
    }
    input:focus, textarea:focus { border-color:#D4AF6A; }
    button[type=submit] {
      display:block; width:100%; background:#D4AF6A; color:#0D0D0D;
      font-family:'IBM Plex Mono',monospace; font-size:11px; font-weight:700;
      letter-spacing:0.15em; text-transform:uppercase; padding:16px 24px;
      border:none; cursor:pointer;
    }
    button[type=submit]:hover { background:#C49E58; }
  </style>
</head>
<body>
  <div class="wrap">
    <div style="border-bottom:1px solid #262626; padding-bottom:20px; margin-bottom:32px;">
      <div style="font-size:10px;color:#D4AF6A;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:8px;">BLOOM ENGINE</div>
      <div style="font-size:24px;color:#EDEDED;">Edit Today's Post</div>
    </div>

    <div style="font-size:11px;color:#94A3B8;margin-bottom:28px;">
      Make your changes below. When you submit, a new approval email will be sent so you can review the updated version.
    </div>

    <form method="POST" action="/api/agents/gmb/edit?token=${encodeURIComponent(token)}">

      <div class="label">Headline</div>
      <input type="text" name="headline" value="${esc(post.headline)}" required maxlength="200" />

      <div class="label">Post Body</div>
      <textarea name="body" rows="8" required maxlength="1500">${esc(post.body)}</textarea>

      <div class="label">Call to Action</div>
      <input type="text" name="cta" value="${esc(post.cta)}" required maxlength="200" />

      <button type="submit">&#x270F;&#xFE0F; Update Post &amp; Send for Re-approval</button>
    </form>

    <div style="font-size:9px;color:#3F3F3F;letter-spacing:0.1em;border-top:1px solid #1A1A1A;padding-top:20px;margin-top:40px;">
      POWERED BY BLOOM ENGINE &times; ANCHOR
    </div>
  </div>
</body>
</html>`
  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  })
}

function updatedPage(): Response {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Updated — BLOOM ENGINE</title>
</head>
<body style="margin:0;padding:0;background:#0D0D0D;">
  <div style="background:#0D0D0D;color:#EDEDED;font-family:'IBM Plex Mono',monospace;max-width:600px;margin:0 auto;padding:60px 40px;text-align:center;">
    <div style="font-size:10px;color:#D4AF6A;letter-spacing:0.2em;text-transform:uppercase;margin-bottom:32px;">BLOOM ENGINE</div>
    <div style="font-size:48px;margin-bottom:20px;">&#x270F;&#xFE0F;</div>
    <div style="font-size:18px;color:#D4AF6A;font-weight:700;margin-bottom:16px;letter-spacing:0.05em;">Post Updated!</div>
    <div style="font-size:12px;color:#94A3B8;line-height:1.8;">
      Your edits have been saved.<br>A new approval email is on its way — check your inbox.
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
// GET /api/agents/gmb/edit?token=...  — Show the edit form
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token') ?? ''

  // 1. Verify token
  const payload = verifyToken(token)
  if (!payload) {
    return errorPage(
      'This edit link has expired. Please check tomorrow\'s email for a new post.'
    )
  }

  const { postId } = payload

  try {
    // 2. Fetch current post content from gmb_post_log
    const { data, error } = await supabaseAdmin
      .schema('bloom_engine')
      .from('gmb_post_log')
      .select('content, post_type')
      .eq('id', postId)
      .single()

    if (error || !data) {
      console.error('[gmb/edit GET] Supabase fetch error:', error)
      return errorPage('Could not load the post. Please contact jocelyn@frenchbloomsoc.com.')
    }

    // content is stored as the full post JSON string
    let postContent: GMBPostContent
    try {
      const parsed = typeof data.content === 'string' ? JSON.parse(data.content) : data.content
      postContent = {
        type: parsed.type ?? data.post_type ?? 'UPDATE',
        headline: parsed.headline ?? '',
        body: parsed.body ?? '',
        cta: parsed.cta ?? '',
      }
    } catch {
      return errorPage('Could not parse post content. Please contact jocelyn@frenchbloomsoc.com.')
    }

    // 3. Return the edit form
    return editFormPage(token, postContent)
  } catch (err) {
    console.error('[gmb/edit GET] Unexpected error:', err)
    return errorPage('An unexpected error occurred. Please contact jocelyn@frenchbloomsoc.com.')
  }
}

// ---------------------------------------------------------------------------
// POST /api/agents/gmb/edit?token=...  — Process the edit
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token') ?? ''

  // 1. Verify token
  const payload = verifyToken(token)
  if (!payload) {
    return errorPage(
      'This edit link has expired. Please check tomorrow\'s email for a new post.'
    )
  }

  const { clientId, postId } = payload

  try {
    // 2. Parse form body
    const formData = await request.formData()
    const headline = String(formData.get('headline') ?? '').trim()
    const body = String(formData.get('body') ?? '').trim()
    const cta = String(formData.get('cta') ?? '').trim()

    if (!headline || !body || !cta) {
      return errorPage('All fields are required. Please go back and complete the form.')
    }

    // 3. Load current post to merge with new fields
    const { data: existing, error: fetchError } = await supabaseAdmin
      .schema('bloom_engine')
      .from('gmb_post_log')
      .select('content, post_type')
      .eq('id', postId)
      .single()

    if (fetchError || !existing) {
      console.error('[gmb/edit POST] Fetch error:', fetchError)
      return errorPage('Could not load the post. Please contact jocelyn@frenchbloomsoc.com.')
    }

    let existingParsed: Record<string, unknown> = {}
    try {
      existingParsed =
        typeof existing.content === 'string'
          ? JSON.parse(existing.content)
          : (existing.content as Record<string, unknown>) ?? {}
    } catch {
      // fall through with empty object
    }

    const updatedContent: GMBPostContent = {
      type: (existingParsed.type as string) ?? existing.post_type ?? 'UPDATE',
      headline,
      body,
      cta,
    }

    // 4. Persist updated content back to gmb_post_log
    const { error: updateError } = await supabaseAdmin
      .schema('bloom_engine')
      .from('gmb_post_log')
      .update({
        content: JSON.stringify({ ...existingParsed, ...updatedContent }),
        status: 'pending_approval',
      })
      .eq('id', postId)

    if (updateError) {
      console.error('[gmb/edit POST] Update error:', updateError)
      return errorPage('Failed to save your edits. Please contact jocelyn@frenchbloomsoc.com.')
    }

    // 5. Re-send approval email with updated content
    const config = await loadClientConfig(clientId)
    await sendApprovalEmail(clientId, postId, updatedContent, config)

    // 6. Return success page
    return updatedPage()
  } catch (err) {
    console.error('[gmb/edit POST] Unexpected error:', err)
    return errorPage('An unexpected error occurred. Please contact jocelyn@frenchbloomsoc.com.')
  }
}
