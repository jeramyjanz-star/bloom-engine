'use client'

import { useState, useCallback } from 'react'

interface AuditIssue {
  type: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  description: string
  recommendation: string
  fixContent?: string
}

interface LatestAudit {
  id: string
  health_score: number
  critical_issues: number
  high_issues: number
  pages_crawled: number
  crawled_at: string
  issues: AuditIssue[]
  site_checks: Record<string, boolean>
}

interface HistoryEntry {
  id: string
  crawled_at: string
  health_score: number
  critical_issues: number
  high_issues: number
  pages_crawled: number
}

interface Props {
  clientId: string
  latestAudit: LatestAudit | null
  auditHistory: HistoryEntry[]
}

function healthColor(score: number): string {
  if (score >= 80) return '#00D4B4'
  if (score >= 60) return '#D4AF6A'
  return '#DC2626'
}

function SparklineChart({ history }: { history: HistoryEntry[] }) {
  const scores = [...history].reverse().map((h) => h.health_score)
  if (scores.length < 2) return null

  const W = 160
  const H = 48
  const max = 100
  const min = 0

  const points = scores.map((s, i) => {
    const x = (i / (scores.length - 1)) * W
    const y = H - ((s - min) / (max - min)) * H
    return `${x},${y}`
  })
  const polyline = points.join(' ')

  const lastScore = scores[scores.length - 1]
  const color = healthColor(lastScore)

  return (
    <svg width={W} height={H} style={{ overflow: 'visible' }}>
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.8"
      />
      {scores.map((s, i) => {
        const x = (i / (scores.length - 1)) * W
        const y = H - ((s - min) / (max - min)) * H
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={i === scores.length - 1 ? 3 : 2}
            fill={color}
            opacity={i === scores.length - 1 ? 1 : 0.5}
          />
        )
      })}
    </svg>
  )
}

function IssueAccordion({ issue }: { issue: AuditIssue }) {
  const [open, setOpen] = useState(false)

  const badgeColor =
    issue.severity === 'critical'
      ? '#DC2626'
      : issue.severity === 'high'
        ? '#D4AF6A'
        : '#94A3B8'

  return (
    <div
      style={{
        borderBottom: '1px solid #262626',
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          padding: '12px 0',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-ibm-plex-mono, monospace)',
            fontSize: '8px',
            color: badgeColor,
            background: `${badgeColor}18`,
            border: `1px solid ${badgeColor}40`,
            borderRadius: '2px',
            padding: '2px 6px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            flexShrink: 0,
          }}
        >
          {issue.severity}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-ibm-plex-mono, monospace)',
            fontSize: '11px',
            color: '#EDEDED',
            flex: 1,
          }}
        >
          {issue.type}
        </span>
        <span style={{ color: '#94A3B8', fontSize: '10px' }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div style={{ paddingBottom: '16px', paddingLeft: '4px' }}>
          <p
            style={{
              fontFamily: 'var(--font-inter, sans-serif)',
              fontSize: '12px',
              color: '#94A3B8',
              margin: '0 0 8px',
            }}
          >
            {issue.description}
          </p>
          <p
            style={{
              fontFamily: 'var(--font-inter, sans-serif)',
              fontSize: '12px',
              color: '#EDEDED',
              margin: '0 0 10px',
            }}
          >
            <strong style={{ color: '#D4AF6A' }}>Fix:</strong>{' '}
            {issue.recommendation}
          </p>
          {issue.fixContent && (
            <pre
              style={{
                fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                fontSize: '11px',
                color: '#00D4B4',
                background: '#0D0D0D',
                border: '1px solid #262626',
                borderRadius: '2px',
                padding: '10px 12px',
                margin: 0,
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {issue.fixContent}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

export default function SEOHealthPanel({ clientId, latestAudit, auditHistory }: Props) {
  const [auditRunning, setAuditRunning] = useState(false)
  const [auditProgress, setAuditProgress] = useState('')
  const [currentAudit, setCurrentAudit] = useState(latestAudit)
  const [currentHistory, setCurrentHistory] = useState(auditHistory)

  const runAudit = useCallback(async () => {
    setAuditRunning(true)
    setAuditProgress('Launching crawler...')

    try {
      setAuditProgress('Crawling pages...')
      const res = await fetch(`/api/${clientId}/audit/run`, { method: 'POST' })
      const data = await res.json() as {
        auditId?: string
        healthScore?: number
        criticalIssues?: number
        highIssues?: number
        error?: string
      }

      if (!res.ok) {
        setAuditProgress(`Error: ${data.error ?? 'Audit failed'}`)
        return
      }

      setAuditProgress(`Done! Health score: ${data.healthScore}/100`)

      // Reload audit data
      const latestRes = await fetch(`/api/${clientId}/audit/latest`)
      if (latestRes.ok) {
        const newAudit = await latestRes.json() as LatestAudit
        setCurrentAudit(newAudit)
      }
      const historyRes = await fetch(`/api/${clientId}/audit/history`)
      if (historyRes.ok) {
        const { history } = await historyRes.json() as { history: HistoryEntry[] }
        setCurrentHistory(history)
      }
    } catch (err) {
      setAuditProgress(`Error: ${String(err)}`)
    } finally {
      setAuditRunning(false)
    }
  }, [clientId])

  const criticalIssues = (currentAudit?.issues ?? []).filter(
    (i) => i.severity === 'critical'
  )
  const highIssues = (currentAudit?.issues ?? []).filter(
    (i) => i.severity === 'high'
  )
  const importantIssues = [...criticalIssues, ...highIssues]

  return (
    <div
      style={{
        background: '#161616',
        border: '1px solid #262626',
        borderRadius: '2px',
      }}
    >
      {/* Panel header */}
      <div
        style={{
          padding: '20px 28px',
          borderBottom: '1px solid #262626',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-ibm-plex-mono, monospace)',
            fontSize: '10px',
            color: '#D4AF6A',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
          }}
        >
          Panel 01 — SEO Health
        </div>
        <button
          onClick={runAudit}
          disabled={auditRunning}
          style={{
            background: auditRunning
              ? '#262626'
              : 'linear-gradient(135deg, #D4AF6A 0%, #B8943A 100%)',
            border: 'none',
            borderRadius: '2px',
            padding: '8px 16px',
            color: auditRunning ? '#94A3B8' : '#0D0D0D',
            fontFamily: 'var(--font-ibm-plex-mono, monospace)',
            fontSize: '9px',
            fontWeight: 600,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            cursor: auditRunning ? 'not-allowed' : 'pointer',
          }}
        >
          {auditRunning ? 'RUNNING...' : 'RUN AUDIT'}
        </button>
      </div>

      <div style={{ padding: '28px' }}>
        {/* Progress message */}
        {auditProgress && (
          <div
            style={{
              fontFamily: 'var(--font-ibm-plex-mono, monospace)',
              fontSize: '10px',
              color: '#00D4B4',
              marginBottom: '20px',
              letterSpacing: '0.1em',
            }}
          >
            ▶ {auditProgress}
          </div>
        )}

        {currentAudit ? (
          <>
            {/* Top row: score + sparkline + badges */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '32px',
                marginBottom: '28px',
                flexWrap: 'wrap',
              }}
            >
              {/* Giant score */}
              <div
                style={{
                  fontFamily: 'var(--font-playfair, "Playfair Display", serif)',
                  fontSize: '120px',
                  fontWeight: 700,
                  color: healthColor(currentAudit.health_score),
                  lineHeight: 1,
                }}
              >
                {currentAudit.health_score}
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  paddingBottom: '8px',
                }}
              >
                {/* Sparkline */}
                {currentHistory.length >= 2 && (
                  <div>
                    <div
                      style={{
                        fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                        fontSize: '8px',
                        color: '#94A3B8',
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        marginBottom: '6px',
                      }}
                    >
                      Score Trend (last {currentHistory.length})
                    </div>
                    <SparklineChart history={currentHistory} />
                  </div>
                )}

                {/* Issue badges */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <div
                    style={{
                      fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                      fontSize: '10px',
                      color: '#DC2626',
                      background: 'rgba(220,38,38,0.1)',
                      border: '1px solid rgba(220,38,38,0.3)',
                      borderRadius: '2px',
                      padding: '5px 10px',
                      letterSpacing: '0.1em',
                    }}
                  >
                    {currentAudit.critical_issues} CRITICAL
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                      fontSize: '10px',
                      color: '#D4AF6A',
                      background: 'rgba(212,175,106,0.1)',
                      border: '1px solid rgba(212,175,106,0.3)',
                      borderRadius: '2px',
                      padding: '5px 10px',
                      letterSpacing: '0.1em',
                    }}
                  >
                    {currentAudit.high_issues} HIGH
                  </div>
                </div>

                {/* Metadata */}
                <div
                  style={{
                    fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                    fontSize: '9px',
                    color: '#94A3B8',
                    letterSpacing: '0.08em',
                  }}
                >
                  {currentAudit.pages_crawled} pages ·{' '}
                  {new Date(currentAudit.crawled_at).toLocaleDateString('en-AU', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </div>
              </div>
            </div>

            {/* Issues accordion */}
            {importantIssues.length > 0 && (
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                    fontSize: '9px',
                    color: '#94A3B8',
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    marginBottom: '12px',
                  }}
                >
                  Critical & High Issues ({importantIssues.length})
                </div>
                <div>
                  {importantIssues.map((issue, i) => (
                    <IssueAccordion key={i} issue={issue} />
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div
            style={{
              textAlign: 'center',
              padding: '48px 0',
              color: '#94A3B8',
              fontFamily: 'var(--font-ibm-plex-mono, monospace)',
              fontSize: '11px',
              letterSpacing: '0.1em',
            }}
          >
            No audit data yet. Run your first audit to see results.
          </div>
        )}
      </div>
    </div>
  )
}
