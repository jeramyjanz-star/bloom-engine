import { supabaseAdmin } from '@/src/lib/supabase'
import { loadClientConfig } from '@/src/lib/client-loader'
import type { GMBPost } from '@/src/lib/content-engine'

// ---------------------------------------------------------------------------
// Telegram notification
// ---------------------------------------------------------------------------

export async function sendTelegramMessage(message: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID

  if (!token || !chatId) {
    // Optional integration — silently skip if not configured
    return
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.warn('[gmb-posting-engine] Telegram send failed:', res.status, body)
    }
  } catch (err) {
    console.warn('[gmb-posting-engine] Telegram fetch error:', String(err))
  }
}

// ---------------------------------------------------------------------------
// OAuth: exchange refresh token for access token
// ---------------------------------------------------------------------------

export async function getGMBAccessToken(clientId: string): Promise<string> {
  const clientKey = clientId.toUpperCase()

  const clientIdOAuth = process.env.GMB_CLIENT_ID
  const clientSecret = process.env.GMB_CLIENT_SECRET
  const refreshToken = process.env[`GMB_REFRESH_TOKEN_${clientKey}`]

  if (!clientIdOAuth) throw new Error('Missing env var: GMB_CLIENT_ID')
  if (!clientSecret) throw new Error('Missing env var: GMB_CLIENT_SECRET')
  if (!refreshToken) {
    throw new Error(
      `Missing env var: GMB_REFRESH_TOKEN_${clientKey} — run the OAuth flow at /api/auth/gmb/connect?client=${clientId}`
    )
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientIdOAuth,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  })

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(
      `Google token refresh failed (${res.status}): ${body}`
    )
  }

  const json = (await res.json()) as { access_token?: string; error?: string }

  if (!json.access_token) {
    throw new Error(
      `Google token refresh returned no access_token: ${JSON.stringify(json)}`
    )
  }

  return json.access_token
}

// ---------------------------------------------------------------------------
// Post to Google Business Profile
// ---------------------------------------------------------------------------

export async function postToGMB(
  clientId: string,
  post: GMBPost,
  imageUrl?: string
): Promise<string> {
  const clientKey = clientId.toUpperCase()

  const accountId = process.env[`GMB_ACCOUNT_ID_${clientKey}`]
  const locationId = process.env[`GMB_LOCATION_ID_${clientKey}`]

  if (!accountId) {
    throw new Error(`Missing env var: GMB_ACCOUNT_ID_${clientKey}`)
  }
  if (!locationId) {
    throw new Error(`Missing env var: GMB_LOCATION_ID_${clientKey}`)
  }

  // Load client config to get the CTA URL
  const config = await loadClientConfig(clientId)
  const clientUrl = config.url

  const accessToken = await getGMBAccessToken(clientId)

  const payload: Record<string, unknown> = {
    languageCode: 'en-US',
    summary: `${post.headline}\n\n${post.body}\n\n${post.cta}`,
    callToAction: {
      actionType: 'LEARN_MORE',
      url: clientUrl,
    },
    topicType: 'STANDARD',
    ...(imageUrl
      ? {
          media: [
            {
              mediaFormat: 'PHOTO',
              sourceUrl: imageUrl,
            },
          ],
        }
      : {}),
  }

  const endpoint = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/localPosts`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GBP API error (${res.status}): ${body}`)
  }

  const data = (await res.json()) as {
    name?: string
    localPost?: { name?: string }
  }

  const gmbPostId = data.name ?? data.localPost?.name ?? ''

  if (!gmbPostId) {
    throw new Error(`GBP API returned no post ID. Response: ${JSON.stringify(data)}`)
  }

  return gmbPostId
}

// ---------------------------------------------------------------------------
// Main orchestrator — called after approval
// ---------------------------------------------------------------------------

export async function postApproved(
  postId: string,
  clientId: string
): Promise<{ success: boolean; gmbPostId?: string; error?: string }> {
  // 1. Fetch post record from Supabase
  const { data: row, error: fetchError } = await supabaseAdmin
    .schema('bloom_engine')
    .from('gmb_post_log')
    .select('content, client_id')
    .eq('id', postId)
    .single()

  if (fetchError || !row) {
    const msg = fetchError?.message ?? 'Post record not found'
    console.error('[gmb-posting-engine] Failed to fetch post log:', msg)
    return { success: false, error: msg }
  }

  // 2. Parse content column as GMBPost JSON
  let post: GMBPost
  try {
    post =
      typeof row.content === 'string'
        ? (JSON.parse(row.content) as GMBPost)
        : (row.content as GMBPost)
  } catch (err) {
    const msg = `Failed to parse post content: ${String(err)}`
    console.error('[gmb-posting-engine]', msg)
    return { success: false, error: msg }
  }

  // 3. Load client config
  let config
  try {
    config = await loadClientConfig(clientId)
  } catch (err) {
    const msg = `Failed to load client config: ${String(err)}`
    console.error('[gmb-posting-engine]', msg)
    return { success: false, error: msg }
  }

  // 4. Attempt to post to GBP (with one retry on failure)
  let gmbPostId: string

  const attemptPost = async (): Promise<string> => postToGMB(clientId, post)

  try {
    gmbPostId = await attemptPost()
  } catch (firstErr) {
    console.warn('[gmb-posting-engine] First attempt failed, retrying in 5s:', String(firstErr))

    // Wait 5 seconds then retry once
    await new Promise<void>((resolve) => setTimeout(resolve, 5_000))

    try {
      gmbPostId = await attemptPost()
    } catch (secondErr) {
      const msg = String(secondErr)
      console.error('[gmb-posting-engine] Retry also failed:', msg)

      // Mark post as failed in DB
      await supabaseAdmin
        .schema('bloom_engine')
        .from('gmb_post_log')
        .update({ status: 'failed' })
        .eq('id', postId)

      // Alert Jeramy
      await sendTelegramMessage(
        `⚠️ ${config.name} GMB post FAILED — manual action needed\n\nPost ID: ${postId}\nError: ${msg.slice(0, 200)}`
      )

      return { success: false, error: msg }
    }
  }

  // 5. Success — update DB record
  const { error: updateError } = await supabaseAdmin
    .schema('bloom_engine')
    .from('gmb_post_log')
    .update({
      status: 'posted',
      gmb_post_id: gmbPostId,
      posted_at: new Date().toISOString(),
    })
    .eq('id', postId)

  if (updateError) {
    // Non-fatal — post went live, just log the DB error
    console.error('[gmb-posting-engine] Failed to update post log after posting:', updateError.message)
  }

  // 6. Telegram success notification to Jeramy
  await sendTelegramMessage(
    `✅ ${config.name} GMB posted — "${post.headline.substring(0, 50)}..."\n\nPost ID: ${gmbPostId}`
  )

  // 7. Send confirmation email to client
  try {
    const { sendConfirmationEmail } = await import('@/src/lib/agents/gmb-approval-gate')
    await sendConfirmationEmail(clientId, postId, config)
  } catch (emailErr) {
    // Non-fatal — log but don't fail the whole operation
    console.warn('[gmb-posting-engine] Confirmation email failed:', String(emailErr))
  }

  return { success: true, gmbPostId }
}
