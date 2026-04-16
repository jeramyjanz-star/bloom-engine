'use client'

import { useState, useCallback } from 'react'
import type { ClientConfig } from '@/src/lib/client-loader'

interface AEORow {
  id: string
  query: string
  client_cited: boolean
  client_url: string | null
  competitors: string[]
  last_tested: string | null
  recommendations: string[]
}

interface Props {
  clientId: string
  aeoRows: AEORow[]
  clientConfig: ClientConfig
}

type QueryStatus = 'CITED' | 'COMPETITOR' | 'NOT_FOUND' | 'NOT_TESTED'

function getStatus(row: AEORow): QueryStatus {
  if (!row.last_tested) return 'NOT_TESTED'
  if (row.client_cited) return 'CITED'
  if (row.competitors && row.competitors.length > 0) return 'COMPETITOR'
  return 'NOT_FOUND'
}

function StatusBadge({ status, competitor }: { status: QueryStatus; competitor?: string }) {
  const config = {
    CITED: {
      label: '✅ CITED',
      color: '#00D4B4',
      bg: 'rgba(0,212,180,0.1)',
      border: 'rgba(0,212,180,0.3)',
    },
    COMPETITOR: {
      label: `⚠️ COMPETITOR`,
      color: '#D4AF6A',
      bg: 'rgba(212,175,106,0.1)',
      border: 'rgba(212,175,106,0.3)',
    },
    NOT_FOUND: {
      label: '❌ NOT FOUND',
      color: '#DC2626',
      bg: 'rgba(220,38,38,0.1)',
      border: 'rgba(220,38,38,0.3)',
    },
    NOT_TESTED: {
      label: '— NOT TESTED',
      color: '#94A3B8',
      bg: 'rgba(148,163,184,0.08)',
      border: 'rgba(148,163,184,0.2)',
    },
  }

  const c = config[status]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
      <span
        style={{
          fontFamily: 'var(--font-ibm-plex-mono, monospace)',
          fontSize: '9px',
          color: c.color,
          background: c.bg,
          border: `1px solid ${c.border}`,
          borderRadius: '2px',
          padding: '3px 7px',
          letterSpacing: '0.08em',
          whiteSpace: 'nowrap',
          display: 'inline-block',
        }}
      >
        {c.label}
      </span>
      {status === 'COMPETITOR' && competitor && (
        <span
          style={{
            fontFamily: 'var(--font-ibm-plex-mono, monospace)',
            fontSize: '9px',
            color: '#D4AF6A',
            opacity: 0.8,
          }}
        >
          {competitor}
        </span>
      )}
    </div>
  )
}

function QueryRow({
  row,
  clientId,
  onUpdate,
}: {
  row: AEORow
  clientId: string
  onUpdate: (updated: AEORow) => void
}) {
  const [testing, setTesting] = useState(false)
  const [recsOpen, setRecsOpen] = useState(false)

  const status = getStatus(row)

  async function testQuery() {
    setTesting(true)
    try {
      const res = await fetch(`/api/${clientId}/aeo/test-query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: row.query }),
      })
      if (res.ok) {
        const result = await res.json() as {
          clientCited: boolean
          clientUrl: string | null
          competitors: string[]
          testedAt: string
          recommendations: string[]
        }
        onUpdate({
          ...row,
          client_cited: result.clientCited,
          client_url: result.clientUrl,
          competitors: result.competitors ?? [],
          last_tested: result.testedAt,
          recommendations: result.recommendations ?? [],
        })
      }
    } finally {
      setTesting(false)
    }
  }

  return (
    <>
      <tr
        style={{
          borderBottom: '1px solid #262626',
        }}
      >
        {/* Query */}
        <td
          style={{
            padding: '12px 16px 12px 0',
            fontFamily: 'var(--font-inter, sans-serif)',
            fontSize: '12px',
            color: '#EDEDED',
            maxWidth: '280px',
          }}
        >
          {row.query}
        </td>

        {/* Status */}
        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
          <StatusBadge
            status={status}
            competitor={
              status === 'COMPETITOR' ? row.competitors?.[0] : undefined
            }
          />
        </td>

        {/* Last tested */}
        <td
          style={{
            padding: '12px 16px',
            fontFamily: 'var(--font-ibm-plex-mono, monospace)',
            fontSize: '9px',
            color: '#94A3B8',
            whiteSpace: 'nowrap',
          }}
        >
          {row.last_tested
            ? new Date(row.last_tested).toLocaleDateString('en-AU', {
                day: 'numeric',
                month: 'short',
              })
            : '—'}
        </td>

        {/* Actions */}
        <td style={{ padding: '12px 0' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={testQuery}
              disabled={testing}
              style={{
                background: testing ? '#262626' : 'transparent',
                border: '1px solid #262626',
                borderRadius: '2px',
                padding: '5px 10px',
                color: testing ? '#94A3B8' : '#D4AF6A',
                fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                fontSize: '9px',
                letterSpacing: '0.1em',
                cursor: testing ? 'not-allowed' : 'pointer',
                textTransform: 'uppercase',
              }}
            >
              {testing ? '...' : 'Test'}
            </button>

            {status === 'COMPETITOR' && row.recommendations?.length > 0 && (
              <button
                onClick={() => setRecsOpen((o) => !o)}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(212,175,106,0.3)',
                  borderRadius: '2px',
                  padding: '5px 10px',
                  color: '#D4AF6A',
                  fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                  fontSize: '9px',
                  letterSpacing: '0.08em',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                }}
              >
                {recsOpen ? 'Hide' : 'Recs'}
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Recommendations row */}
      {recsOpen && row.recommendations?.length > 0 && (
        <tr>
          <td
            colSpan={4}
            style={{
              padding: '0 0 16px 0',
              borderBottom: '1px solid #262626',
            }}
          >
            <div
              style={{
                background: 'rgba(212,175,106,0.06)',
                border: '1px solid rgba(212,175,106,0.15)',
                borderRadius: '2px',
                padding: '14px 16px',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                  fontSize: '8px',
                  color: '#D4AF6A',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  marginBottom: '10px',
                }}
              >
                ANCHOR Recommendations
              </div>
              {row.recommendations.slice(0, 3).map((rec, i) => (
                <div
                  key={i}
                  style={{
                    fontFamily: 'var(--font-inter, sans-serif)',
                    fontSize: '12px',
                    color: '#EDEDED',
                    marginBottom: '6px',
                    paddingLeft: '12px',
                    borderLeft: '2px solid rgba(212,175,106,0.4)',
                    paddingTop: '2px',
                    paddingBottom: '2px',
                  }}
                >
                  {rec}
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

export default function AEOPanel({ clientId, aeoRows, clientConfig }: Props) {
  const [rows, setRows] = useState<AEORow[]>(aeoRows)
  const [testingAll, setTestingAll] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const citedCount = rows.filter((r) => r.client_cited && r.last_tested).length
  const testedCount = rows.filter((r) => r.last_tested).length
  const citationRate = testedCount > 0 ? Math.round((citedCount / testedCount) * 100) : null

  const rateColor =
    citationRate === null
      ? '#94A3B8'
      : citationRate > 50
        ? '#00D4B4'
        : citationRate >= 25
          ? '#D4AF6A'
          : '#DC2626'

  const handleRowUpdate = useCallback((updated: AEORow) => {
    setRows((prev) =>
      prev.map((r) => (r.query === updated.query ? updated : r))
    )
  }, [])

  const testAll = useCallback(async () => {
    setTestingAll(true)
    setProgress({ done: 0, total: rows.length })

    const eventSource = new EventSource(`/api/${clientId}/aeo/test-all`)

    eventSource.addEventListener('result', (e) => {
      const data = JSON.parse(e.data) as {
        index: number
        total: number
        query: string
        result: {
          clientCited: boolean
          clientUrl: string | null
          competitors: string[]
          testedAt: string
          recommendations: string[]
        }
      }
      setProgress({ done: data.index + 1, total: data.total })
      setRows((prev) =>
        prev.map((r) =>
          r.query === data.query
            ? {
                ...r,
                client_cited: data.result.clientCited,
                client_url: data.result.clientUrl,
                competitors: data.result.competitors ?? [],
                last_tested: data.result.testedAt,
                recommendations: data.result.recommendations ?? [],
              }
            : r
        )
      )
    })

    eventSource.addEventListener('done', () => {
      eventSource.close()
      setTestingAll(false)
      setProgress(null)
    })

    eventSource.addEventListener('error', () => {
      eventSource.close()
      setTestingAll(false)
    })
  }, [clientId, rows.length])

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
          flexWrap: 'wrap',
          gap: '12px',
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
          Panel 02 — AEO Citation Intelligence
        </div>
        <button
          onClick={testAll}
          disabled={testingAll}
          style={{
            background: testingAll ? '#262626' : 'transparent',
            border: '1px solid #D4AF6A',
            borderRadius: '2px',
            padding: '8px 16px',
            color: testingAll ? '#94A3B8' : '#D4AF6A',
            fontFamily: 'var(--font-ibm-plex-mono, monospace)',
            fontSize: '9px',
            fontWeight: 600,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            cursor: testingAll ? 'not-allowed' : 'pointer',
          }}
        >
          {testingAll ? 'TESTING...' : 'TEST ALL'}
        </button>
      </div>

      <div style={{ padding: '28px' }}>
        {/* Citation rate */}
        <div style={{ marginBottom: '28px' }}>
          <div
            style={{
              fontFamily: 'var(--font-ibm-plex-mono, monospace)',
              fontSize: '9px',
              color: '#94A3B8',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}
          >
            Citation Rate
          </div>
          <div
            style={{
              fontFamily: 'var(--font-playfair, "Playfair Display", serif)',
              fontSize: '64px',
              fontWeight: 700,
              color: rateColor,
              lineHeight: 1,
            }}
          >
            {citationRate !== null ? `${citationRate}%` : '—'}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-ibm-plex-mono, monospace)',
              fontSize: '10px',
              color: '#94A3B8',
              marginTop: '6px',
            }}
          >
            {citedCount} of {testedCount} tested queries cited
          </div>

          {/* Progress bar */}
          {testingAll && progress && (
            <div style={{ marginTop: '16px' }}>
              <div
                style={{
                  fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                  fontSize: '9px',
                  color: '#D4AF6A',
                  marginBottom: '6px',
                  letterSpacing: '0.1em',
                }}
              >
                Testing {progress.done}/{progress.total} queries...
              </div>
              <div
                style={{
                  height: '4px',
                  background: '#262626',
                  borderRadius: '2px',
                  overflow: 'hidden',
                  width: '300px',
                  maxWidth: '100%',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    background: '#D4AF6A',
                    width: `${(progress.done / progress.total) * 100}%`,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Query table */}
        {rows.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Query', 'Status', 'Last Tested', 'Actions'].map((col) => (
                    <th
                      key={col}
                      style={{
                        fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                        fontSize: '8px',
                        color: '#94A3B8',
                        letterSpacing: '0.15em',
                        textTransform: 'uppercase',
                        textAlign: 'left',
                        padding: '0 16px 12px 0',
                        borderBottom: '1px solid #262626',
                        fontWeight: 400,
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <QueryRow
                    key={row.query}
                    row={row}
                    clientId={clientId}
                    onUpdate={handleRowUpdate}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div
            style={{
              textAlign: 'center',
              padding: '32px 0',
              color: '#94A3B8',
              fontFamily: 'var(--font-ibm-plex-mono, monospace)',
              fontSize: '11px',
              letterSpacing: '0.1em',
            }}
          >
            No AEO queries configured. Add queries to client config.
          </div>
        )}
      </div>
    </div>
  )
}
