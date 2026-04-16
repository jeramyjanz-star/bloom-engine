'use client'

import { useState } from 'react'

interface ChecklistItem {
  key: string
  label: string
  description: string
}

const ITEMS: ChecklistItem[] = [
  { key: 'gmb_profile',         label: 'GMB Profile',        description: 'Google Business Profile created & verified' },
  { key: 'schema_installation', label: 'Schema Installation', description: 'JSON-LD schema bundle installed on website' },
  { key: 'instagram',           label: 'Instagram',           description: 'Instagram account set up & connected' },
  { key: 'pinterest',           label: 'Pinterest',           description: 'Pinterest account set up & connected' },
  { key: 'blog_first_post',     label: 'Blog — First Post',   description: 'First blog post published to website' },
  { key: 'gmb_posts',           label: 'GMB Posts',           description: 'First Google Business post published' },
  { key: 'review_system',       label: 'Review System',       description: 'Review request system configured & tested' },
]

interface ChecklistState {
  [key: string]: boolean
}

interface Props {
  clientId: string
  initialState: ChecklistState
}

export default function LaunchChecklistPanel({ clientId, initialState }: Props) {
  const [state, setState] = useState<ChecklistState>(initialState)
  const [saving, setSaving] = useState<string | null>(null)

  const completedCount = ITEMS.filter((item) => state[item.key]).length
  const totalCount = ITEMS.length
  const pct = Math.round((completedCount / totalCount) * 100)

  async function toggle(key: string) {
    const next = !state[key]
    setSaving(key)
    setState((prev) => ({ ...prev, [key]: next }))

    try {
      await fetch(`/api/${clientId}/checklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemKey: key, completed: next }),
      })
    } catch {
      // Revert on network error
      setState((prev) => ({ ...prev, [key]: !next }))
    } finally {
      setSaving(null)
    }
  }

  const barColor = pct === 100 ? '#00D4B4' : pct >= 50 ? '#D4AF6A' : '#94A3B8'

  return (
    <div style={{ background: '#161616', border: '1px solid #262626', borderRadius: '2px' }}>
      {/* Header */}
      <div style={{
        padding: '20px 28px',
        borderBottom: '1px solid #262626',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div style={{
          fontFamily: 'var(--font-ibm-plex-mono, monospace)',
          fontSize: '10px',
          color: '#D4AF6A',
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
        }}>
          Panel 05 — Launch Checklist
        </div>
        <div style={{
          fontFamily: 'var(--font-ibm-plex-mono, monospace)',
          fontSize: '10px',
          color: pct === 100 ? '#00D4B4' : '#94A3B8',
          letterSpacing: '0.1em',
        }}>
          {completedCount}/{totalCount} complete
        </div>
      </div>

      <div style={{ padding: '28px' }}>
        {/* Progress bar */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
            <div style={{
              fontFamily: 'var(--font-ibm-plex-mono, monospace)',
              fontSize: '9px',
              color: '#94A3B8',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}>
              Launch Progress
            </div>
            <div style={{
              fontFamily: 'var(--font-playfair, "Playfair Display", serif)',
              fontSize: '28px',
              fontWeight: 700,
              color: barColor,
              lineHeight: 1,
            }}>
              {pct}%
            </div>
          </div>
          <div style={{ height: '4px', background: '#262626', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              background: barColor,
              width: `${pct}%`,
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>

        {/* Checklist */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {ITEMS.map((item) => {
            const done = !!state[item.key]
            const isSaving = saving === item.key
            return (
              <button
                key={item.key}
                onClick={() => toggle(item.key)}
                disabled={isSaving}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '14px 16px',
                  background: done ? 'rgba(0,212,180,0.04)' : 'transparent',
                  border: `1px solid ${done ? 'rgba(0,212,180,0.15)' : '#262626'}`,
                  borderRadius: '2px',
                  cursor: isSaving ? 'wait' : 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
              >
                {/* Checkbox */}
                <div style={{
                  width: '18px',
                  height: '18px',
                  border: `1px solid ${done ? '#00D4B4' : '#3F3F3F'}`,
                  borderRadius: '2px',
                  background: done ? '#00D4B4' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'background 0.15s, border-color 0.15s',
                }}>
                  {done && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="#0D0D0D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>

                {/* Label + description */}
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: done ? '#94A3B8' : '#EDEDED',
                    letterSpacing: '0.05em',
                    textDecoration: done ? 'line-through' : 'none',
                    marginBottom: '2px',
                  }}>
                    {item.label}
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-inter, sans-serif)',
                    fontSize: '11px',
                    color: '#94A3B8',
                    opacity: done ? 0.6 : 1,
                  }}>
                    {item.description}
                  </div>
                </div>

                {/* Status tag */}
                <div style={{
                  fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                  fontSize: '8px',
                  color: done ? '#00D4B4' : '#3F3F3F',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  flexShrink: 0,
                }}>
                  {isSaving ? '...' : done ? 'DONE' : 'PENDING'}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
