'use client'

import { useState, useCallback } from 'react'
import { addDays, startOfWeek, format, isSameWeek } from 'date-fns'
import type { ClientConfig } from '@/src/lib/client-loader'

interface ContentRow {
  id: string
  channel: string
  title: string
  body: string
  status: string
  scheduled_for: string | null
  published_at: string | null
  created_at: string
  meta_title?: string
  meta_description?: string
}

interface Props {
  clientId: string
  contentRows: ContentRow[]
  clientConfig: ClientConfig
}

const CHANNELS = ['blog', 'gmb', 'instagram', 'pinterest'] as const
type Channel = (typeof CHANNELS)[number]

const CHANNEL_ICONS: Record<Channel, string> = {
  blog: '✍',
  gmb: '📍',
  instagram: '📸',
  pinterest: '📌',
}

const CHANNEL_LABELS: Record<Channel, string> = {
  blog: 'Blog',
  gmb: 'GMB',
  instagram: 'Instagram',
  pinterest: 'Pinterest',
}

function StatusChip({ status }: { status: string }) {
  const config: Record<string, { color: string; bg: string; border: string }> = {
    draft: { color: '#94A3B8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)' },
    scheduled: { color: '#D4AF6A', bg: 'rgba(212,175,106,0.1)', border: 'rgba(212,175,106,0.3)' },
    published: { color: '#00D4B4', bg: 'rgba(0,212,180,0.1)', border: 'rgba(0,212,180,0.3)' },
  }
  const c = config[status.toLowerCase()] ?? config.draft

  return (
    <span
      style={{
        fontFamily: 'var(--font-ibm-plex-mono, monospace)',
        fontSize: '8px',
        color: c.color,
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: '2px',
        padding: '2px 6px',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
      }}
    >
      {status}
    </span>
  )
}

function ContentModal({
  item,
  onClose,
  onMarkPublished,
}: {
  item: ContentRow
  onClose: () => void
  onMarkPublished: (id: string) => void
}) {
  const [copying, setCopying] = useState(false)
  const [marking, setMarking] = useState(false)

  async function copyToClipboard() {
    setCopying(true)
    try {
      await navigator.clipboard.writeText(item.body)
    } finally {
      setTimeout(() => setCopying(false), 1200)
    }
  }

  async function markPublished() {
    setMarking(true)
    try {
      onMarkPublished(item.id)
    } finally {
      setMarking(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.8)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#161616',
          border: '1px solid #262626',
          borderRadius: '2px',
          maxWidth: '700px',
          width: '100%',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #262626',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div>
            <div
              style={{
                fontFamily: 'var(--font-inter, sans-serif)',
                fontSize: '15px',
                fontWeight: 600,
                color: '#EDEDED',
                marginBottom: '4px',
              }}
            >
              {item.title}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <StatusChip status={item.status} />
              <span
                style={{
                  fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                  fontSize: '9px',
                  color: '#94A3B8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                {CHANNEL_ICONS[item.channel as Channel] ?? '📄'}{' '}
                {item.channel.toUpperCase()}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94A3B8',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '4px',
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-inter, sans-serif)',
              fontSize: '13px',
              color: '#EDEDED',
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
            }}
          >
            {item.body}
          </div>

          {(item.meta_title || item.meta_description) && (
            <div
              style={{
                marginTop: '24px',
                padding: '16px',
                background: '#0D0D0D',
                border: '1px solid #262626',
                borderRadius: '2px',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                  fontSize: '8px',
                  color: '#94A3B8',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  marginBottom: '10px',
                }}
              >
                SEO Meta
              </div>
              {item.meta_title && (
                <div style={{ marginBottom: '6px' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                      fontSize: '9px',
                      color: '#D4AF6A',
                    }}
                  >
                    Title:{' '}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-inter, sans-serif)',
                      fontSize: '12px',
                      color: '#EDEDED',
                    }}
                  >
                    {item.meta_title}
                  </span>
                </div>
              )}
              {item.meta_description && (
                <div>
                  <span
                    style={{
                      fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                      fontSize: '9px',
                      color: '#D4AF6A',
                    }}
                  >
                    Desc:{' '}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-inter, sans-serif)',
                      fontSize: '12px',
                      color: '#94A3B8',
                    }}
                  >
                    {item.meta_description}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #262626',
            display: 'flex',
            gap: '10px',
          }}
        >
          <button
            onClick={copyToClipboard}
            style={{
              background: copying ? 'rgba(0,212,180,0.15)' : 'transparent',
              border: `1px solid ${copying ? 'rgba(0,212,180,0.4)' : '#262626'}`,
              borderRadius: '2px',
              padding: '8px 14px',
              color: copying ? '#00D4B4' : '#94A3B8',
              fontFamily: 'var(--font-ibm-plex-mono, monospace)',
              fontSize: '9px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            {copying ? '✓ COPIED' : 'COPY'}
          </button>

          {item.status !== 'published' && (
            <button
              onClick={markPublished}
              disabled={marking}
              style={{
                background: marking
                  ? '#262626'
                  : 'linear-gradient(135deg, #00D4B4 0%, #009980 100%)',
                border: 'none',
                borderRadius: '2px',
                padding: '8px 14px',
                color: marking ? '#94A3B8' : '#0D0D0D',
                fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                fontSize: '9px',
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: marking ? 'not-allowed' : 'pointer',
              }}
            >
              {marking ? '...' : 'MARK PUBLISHED'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ContentPanel({ clientId, contentRows, clientConfig }: Props) {
  const [rows, setRows] = useState<ContentRow[]>(contentRows)
  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedItem, setSelectedItem] = useState<ContentRow | null>(null)

  const baseDate = addDays(new Date(), weekOffset * 7)
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 })
  const weekEnd = addDays(weekStart, 6)

  const weekLabel = `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`

  const weekRows = rows.filter((r) => {
    const d = r.scheduled_for
      ? new Date(r.scheduled_for)
      : r.published_at
        ? new Date(r.published_at)
        : new Date(r.created_at)
    return isSameWeek(d, baseDate, { weekStartsOn: 1 })
  })

  function getChannelItems(channel: string) {
    return weekRows.filter((r) => r.channel.toLowerCase() === channel.toLowerCase())
  }

  const handleMarkPublished = useCallback(
    async (id: string) => {
      // Optimistic update
      setRows((prev) =>
        prev.map((r) =>
          r.id === id
            ? { ...r, status: 'published', published_at: new Date().toISOString() }
            : r
        )
      )
      setSelectedItem((prev) =>
        prev?.id === id
          ? { ...prev, status: 'published', published_at: new Date().toISOString() }
          : prev
      )
    },
    []
  )

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
          Panel 03 — Content Command Center
        </div>

        {/* Week selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setWeekOffset((o) => o - 1)}
            style={{
              background: 'none',
              border: '1px solid #262626',
              borderRadius: '2px',
              padding: '5px 10px',
              color: '#94A3B8',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            ←
          </button>
          <span
            style={{
              fontFamily: 'var(--font-ibm-plex-mono, monospace)',
              fontSize: '10px',
              color: '#EDEDED',
              letterSpacing: '0.05em',
              minWidth: '160px',
              textAlign: 'center',
            }}
          >
            {weekOffset === 0 ? 'This Week' : weekOffset === 1 ? 'Next Week' : weekOffset === -1 ? 'Last Week' : weekLabel}
          </span>
          <button
            onClick={() => setWeekOffset((o) => o + 1)}
            style={{
              background: 'none',
              border: '1px solid #262626',
              borderRadius: '2px',
              padding: '5px 10px',
              color: '#94A3B8',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            →
          </button>
        </div>
      </div>

      <div style={{ padding: '28px' }}>
        {/* Channel grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '16px',
          }}
        >
          {CHANNELS.map((channel) => {
            const items = getChannelItems(channel)
            return (
              <div key={channel}>
                {/* Channel header */}
                <div
                  style={{
                    fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                    fontSize: '9px',
                    color: '#94A3B8',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    marginBottom: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderBottom: '1px solid #262626',
                    paddingBottom: '8px',
                  }}
                >
                  <span>{CHANNEL_ICONS[channel]}</span>
                  <span>{CHANNEL_LABELS[channel]}</span>
                  {items.length > 0 && (
                    <span
                      style={{
                        marginLeft: 'auto',
                        background: 'rgba(212,175,106,0.15)',
                        color: '#D4AF6A',
                        borderRadius: '10px',
                        padding: '1px 6px',
                        fontSize: '8px',
                      }}
                    >
                      {items.length}
                    </span>
                  )}
                </div>

                {/* Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {items.length > 0 ? (
                    items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setSelectedItem(item)}
                        style={{
                          background: '#0D0D0D',
                          border: '1px solid #262626',
                          borderRadius: '2px',
                          padding: '10px 12px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          width: '100%',
                        }}
                      >
                        <div
                          style={{
                            fontFamily: 'var(--font-inter, sans-serif)',
                            fontSize: '11px',
                            color: '#EDEDED',
                            marginBottom: '6px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.title}
                        </div>
                        <StatusChip status={item.status} />
                      </button>
                    ))
                  ) : (
                    <div
                      style={{
                        fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                        fontSize: '9px',
                        color: '#94A3B8',
                        opacity: 0.5,
                        textAlign: 'center',
                        padding: '16px 0',
                      }}
                    >
                      No content
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Generate FAB */}
      <div
        style={{
          padding: '0 28px 24px',
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <a
          href={`/dashboard/${clientId}/generate`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'linear-gradient(135deg, #D4AF6A 0%, #B8943A 100%)',
            border: 'none',
            borderRadius: '2px',
            padding: '10px 20px',
            color: '#0D0D0D',
            fontFamily: 'var(--font-ibm-plex-mono, monospace)',
            fontSize: '10px',
            fontWeight: 600,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: '16px', fontWeight: 300 }}>+</span>
          Generate Content
        </a>
      </div>

      {/* Content modal */}
      {selectedItem && (
        <ContentModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onMarkPublished={handleMarkPublished}
        />
      )}
    </div>
  )
}
