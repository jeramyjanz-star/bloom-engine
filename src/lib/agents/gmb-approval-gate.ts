import crypto from 'crypto'
import { Resend } from 'resend'
import type { ClientConfig } from '@/src/lib/client-loader'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GMBPostContent {
  type: string
  headline: string
  body: string
  cta: string
}

export interface WeeklyMetrics {
  weekStart: string
  profileViews: number
  websiteClicks: number
  directionRequests: number
  calls: number
  photoViews: number
  topPostContent?: string
  topPostViews?: number
  aeoCitationRate?: number
  seoHealth?: number
  aiInsight?: string
}

interface TokenPayload {
  clientId: string
  postId: string
  exp: number
}

// ---------------------------------------------------------------------------
// Token helpers (manual HMAC-SHA256 JWT — no external jwt library)
// ---------------------------------------------------------------------------

function base64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf-8') : input
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function signToken(payload: object): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('Missing env var: JWT_SECRET')

  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64url(JSON.stringify(payload))
  const signingInput = `${header}.${body}`
  const signature = base64url(
    crypto.createHmac('sha256', secret).update(signingInput).digest()
  )
  return `${signingInput}.${signature}`
}

export function verifyToken(token: string): TokenPayload | null {
  const secret = process.env.JWT_SECRET
  if (!secret) return null

  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [header, body, providedSig] = parts
  const signingInput = `${header}.${body}`
  const expectedSig = base64url(
    crypto.createHmac('sha256', secret).update(signingInput).digest()
  )

  // Constant-time comparison to avoid timing attacks
  if (!crypto.timingSafeEqual(Buffer.from(providedSig), Buffer.from(expectedSig))) {
    return null
  }

  let payload: TokenPayload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64').toString('utf-8')) as TokenPayload
  } catch {
    return null
  }

  if (!payload.clientId || !payload.postId || !payload.exp) return null
  if (Date.now() > payload.exp) return null

  return payload
}

// ---------------------------------------------------------------------------
// Resend client (lazy-initialised)
// ---------------------------------------------------------------------------

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('Missing env var: RESEND_API_KEY')
  return new Resend(key)
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '')
}

// ---------------------------------------------------------------------------
// Shared HTML shell
// ---------------------------------------------------------------------------

function htmlShell(bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BLOOM ENGINE</title>
</head>
<body style="margin:0;padding:0;background:#0D0D0D;">
${bodyContent}
</body>
</html>`
}

// ---------------------------------------------------------------------------
// Email: Approval request
// ---------------------------------------------------------------------------

export async function sendApprovalEmail(
  clientId: string,
  postId: string,
  postContent: GMBPostContent,
  config: ClientConfig
): Promise<void> {
  const token = signToken({ clientId, postId, exp: Date.now() + 3_600_000 })
  const base = appUrl()

  const approveUrl = `${base}/api/agents/gmb/approve?token=${token}`
  const skipUrl = `${base}/api/agents/gmb/skip?token=${token}`
  const editUrl = `${base}/api/agents/gmb/edit?token=${token}`

  const ownerFirstName = config.owner.name.split(' ')[0]

  const html = htmlShell(`
<div style="background:#0D0D0D; color:#EDEDED; font-family:'IBM Plex Mono',monospace; max-width:600px; margin:0 auto; padding:40px;">
  <div style="border-bottom:1px solid #262626; padding-bottom:20px; margin-bottom:32px;">
    <div style="font-size:10px; color:#D4AF6A; letter-spacing:0.2em; text-transform:uppercase; margin-bottom:8px;">BLOOM ENGINE</div>
    <div style="font-size:24px; color:#EDEDED;">GMB Post Approval</div>
  </div>

  <div style="font-size:11px; color:#94A3B8; margin-bottom:24px;">Hi ${ownerFirstName},<br><br>Here's today's Google Business post for your approval:</div>

  <div style="background:#161616; border:1px solid #262626; border-radius:2px; padding:24px; margin-bottom:32px;">
    <div style="font-size:9px; color:#D4AF6A; letter-spacing:0.2em; text-transform:uppercase; margin-bottom:12px;">POST TYPE: ${postContent.type}</div>
    <div style="font-size:16px; font-weight:700; color:#EDEDED; margin-bottom:16px;">${postContent.headline}</div>
    <div style="font-size:13px; color:#EDEDED; line-height:1.7; margin-bottom:16px; white-space:pre-wrap;">${postContent.body}</div>
    <div style="font-size:11px; color:#D4AF6A; font-style:italic;">${postContent.cta}</div>
  </div>

  <div style="font-size:10px; color:#94A3B8; letter-spacing:0.08em; margin-bottom:32px; padding:12px; background:#161616; border-left:2px solid #D4AF6A;">
    Scheduled: Today at 10:00 AM Pacific<br>
    Approval window: 2 hours
  </div>

  <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:40px;">
    <a href="${approveUrl}" style="display:block; background:#D4AF6A; color:#0D0D0D; text-align:center; padding:16px 24px; text-decoration:none; font-size:11px; font-weight:700; letter-spacing:0.15em; text-transform:uppercase;">&#x2705; APPROVE AND POST</a>
    <a href="${editUrl}" style="display:block; background:transparent; color:#EDEDED; text-align:center; padding:16px 24px; text-decoration:none; font-size:11px; letter-spacing:0.1em; text-transform:uppercase; border:1px solid #3F3F3F;">&#x270F;&#xFE0F; SUGGEST EDIT</a>
    <a href="${skipUrl}" style="display:block; background:transparent; color:#94A3B8; text-align:center; padding:12px 24px; text-decoration:none; font-size:10px; letter-spacing:0.1em; text-transform:uppercase;">&#x274C; SKIP TODAY</a>
  </div>

  <div style="font-size:9px; color:#3F3F3F; letter-spacing:0.1em; border-top:1px solid #1A1A1A; padding-top:20px;">
    POWERED BY BLOOM ENGINE &times; ANCHOR<br>
    If this email was unexpected, contact alex@xlumenx.com
  </div>
</div>`)

  const resend = getResend()
  await resend.emails.send({
    from: 'BLOOM ENGINE <alex@xlumenx.com>',
    to: config.owner.email,
    cc: 'alex@xlumenx.com',
    subject: `🌿 ${config.name} — Approve Today's Google Post`,
    html,
  })
}

// ---------------------------------------------------------------------------
// Email: Post confirmed live
// ---------------------------------------------------------------------------

export async function sendConfirmationEmail(
  clientId: string,
  postId: string,
  config: ClientConfig,
  gmbPostUrl?: string
): Promise<void> {
  const now = new Date().toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const linkSection = gmbPostUrl
    ? `<a href="${gmbPostUrl}" style="color:#D4AF6A; text-decoration:none;">${gmbPostUrl}</a>`
    : ''

  const html = htmlShell(`
<div style="background:#0D0D0D; color:#EDEDED; font-family:'IBM Plex Mono',monospace; max-width:600px; margin:0 auto; padding:40px;">
  <div style="border-bottom:1px solid #262626; padding-bottom:20px; margin-bottom:32px;">
    <div style="font-size:10px; color:#D4AF6A; letter-spacing:0.2em; text-transform:uppercase; margin-bottom:8px;">BLOOM ENGINE</div>
    <div style="font-size:24px; color:#EDEDED;">Post Live &#x2705;</div>
  </div>
  <div style="font-size:12px; color:#94A3B8; line-height:1.8;">
    Your post for <strong style="color:#EDEDED;">${config.name}</strong> went live on Google at <strong style="color:#D4AF6A;">${now} PT</strong>.
    ${linkSection ? `<br><br>View it here: ${linkSection}` : ''}
  </div>
  <div style="font-size:9px; color:#3F3F3F; letter-spacing:0.1em; border-top:1px solid #1A1A1A; padding-top:20px; margin-top:40px;">
    POWERED BY BLOOM ENGINE &times; ANCHOR
  </div>
</div>`)

  const resend = getResend()
  await resend.emails.send({
    from: 'BLOOM ENGINE <alex@xlumenx.com>',
    to: config.owner.email,
    cc: 'alex@xlumenx.com',
    subject: `✅ Posted to Google — ${config.name}`,
    html,
  })
}

// ---------------------------------------------------------------------------
// Email: Skip confirmation
// ---------------------------------------------------------------------------

export async function sendSkipConfirmationEmail(
  clientId: string,
  config: ClientConfig
): Promise<void> {
  const html = htmlShell(`
<div style="background:#0D0D0D; color:#EDEDED; font-family:'IBM Plex Mono',monospace; max-width:600px; margin:0 auto; padding:40px;">
  <div style="border-bottom:1px solid #262626; padding-bottom:20px; margin-bottom:32px;">
    <div style="font-size:10px; color:#D4AF6A; letter-spacing:0.2em; text-transform:uppercase; margin-bottom:8px;">BLOOM ENGINE</div>
    <div style="font-size:24px; color:#EDEDED;">Post Skipped &#x23ED;&#xFE0F;</div>
  </div>
  <div style="font-size:12px; color:#94A3B8; line-height:1.8;">
    Today's post for <strong style="color:#EDEDED;">${config.name}</strong> has been skipped. No content will be published today.<br><br>
    We'll send tomorrow's post for approval as usual.
  </div>
  <div style="font-size:9px; color:#3F3F3F; letter-spacing:0.1em; border-top:1px solid #1A1A1A; padding-top:20px; margin-top:40px;">
    POWERED BY BLOOM ENGINE &times; ANCHOR
  </div>
</div>`)

  const resend = getResend()
  await resend.emails.send({
    from: 'BLOOM ENGINE <alex@xlumenx.com>',
    to: config.owner.email,
    cc: 'alex@xlumenx.com',
    subject: `⏭️ Today's post skipped — ${config.name}`,
    html,
  })
}

// ---------------------------------------------------------------------------
// Email: Weekly report
// ---------------------------------------------------------------------------

export async function sendWeeklyReportEmail(
  clientId: string,
  config: ClientConfig,
  metrics: WeeklyMetrics
): Promise<void> {
  const rows: Array<{ label: string; value: string | number }> = [
    { label: 'Profile Views', value: metrics.profileViews.toLocaleString() },
    { label: 'Website Clicks', value: metrics.websiteClicks.toLocaleString() },
    { label: 'Direction Requests', value: metrics.directionRequests.toLocaleString() },
    { label: 'Calls', value: metrics.calls.toLocaleString() },
    { label: 'Photo Views', value: metrics.photoViews.toLocaleString() },
  ]

  if (metrics.aeoCitationRate !== undefined) {
    rows.push({ label: 'AEO Citation Rate', value: `${metrics.aeoCitationRate}%` })
  }
  if (metrics.seoHealth !== undefined) {
    rows.push({ label: 'SEO Health Score', value: `${metrics.seoHealth}/100` })
  }

  const metricsTable = rows
    .map(
      (r) => `
    <tr>
      <td style="padding:10px 12px; font-size:10px; color:#94A3B8; letter-spacing:0.08em; border-bottom:1px solid #1A1A1A;">${r.label}</td>
      <td style="padding:10px 12px; font-size:13px; color:#D4AF6A; font-weight:700; text-align:right; border-bottom:1px solid #1A1A1A;">${r.value}</td>
    </tr>`
    )
    .join('')

  const topPostSection =
    metrics.topPostContent
      ? `
  <div style="background:#161616; border:1px solid #262626; border-radius:2px; padding:20px; margin-bottom:28px;">
    <div style="font-size:9px; color:#D4AF6A; letter-spacing:0.2em; text-transform:uppercase; margin-bottom:10px;">TOP POST THIS WEEK${metrics.topPostViews !== undefined ? ` — ${metrics.topPostViews.toLocaleString()} VIEWS` : ''}</div>
    <div style="font-size:12px; color:#EDEDED; line-height:1.7; white-space:pre-wrap;">${metrics.topPostContent}</div>
  </div>`
      : ''

  const aiSection =
    metrics.aiInsight
      ? `
  <div style="padding:16px; background:#161616; border-left:2px solid #D4AF6A; margin-bottom:28px;">
    <div style="font-size:9px; color:#D4AF6A; letter-spacing:0.15em; text-transform:uppercase; margin-bottom:8px;">AI INSIGHT</div>
    <div style="font-size:12px; color:#94A3B8; line-height:1.7;">${metrics.aiInsight}</div>
  </div>`
      : ''

  const html = htmlShell(`
<div style="background:#0D0D0D; color:#EDEDED; font-family:'IBM Plex Mono',monospace; max-width:600px; margin:0 auto; padding:40px;">
  <div style="border-bottom:1px solid #262626; padding-bottom:20px; margin-bottom:32px;">
    <div style="font-size:10px; color:#D4AF6A; letter-spacing:0.2em; text-transform:uppercase; margin-bottom:8px;">BLOOM ENGINE</div>
    <div style="font-size:24px; color:#EDEDED;">Weekly Performance</div>
    <div style="font-size:11px; color:#94A3B8; margin-top:6px;">Week of ${metrics.weekStart} — ${config.name}</div>
  </div>

  <table style="width:100%; border-collapse:collapse; background:#161616; border:1px solid #262626; border-radius:2px; margin-bottom:28px;">
    <thead>
      <tr>
        <th style="padding:10px 12px; font-size:9px; color:#3F3F3F; letter-spacing:0.15em; text-align:left; border-bottom:1px solid #262626; text-transform:uppercase;">Metric</th>
        <th style="padding:10px 12px; font-size:9px; color:#3F3F3F; letter-spacing:0.15em; text-align:right; border-bottom:1px solid #262626; text-transform:uppercase;">Value</th>
      </tr>
    </thead>
    <tbody>${metricsTable}</tbody>
  </table>

  ${topPostSection}
  ${aiSection}

  <div style="font-size:9px; color:#3F3F3F; letter-spacing:0.1em; border-top:1px solid #1A1A1A; padding-top:20px;">
    POWERED BY BLOOM ENGINE &times; ANCHOR<br>
    Automated weekly report — contact alex@xlumenx.com with questions
  </div>
</div>`)

  const resend = getResend()
  await resend.emails.send({
    from: 'BLOOM ENGINE <alex@xlumenx.com>',
    to: [config.owner.email, 'alex@xlumenx.com'],
    subject: `📊 ${config.name} — Weekly Google Performance`,
    html,
  })
}
