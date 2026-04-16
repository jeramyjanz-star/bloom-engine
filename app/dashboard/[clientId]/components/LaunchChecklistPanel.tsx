'use client'

import { useState } from 'react'
import { LAUNCH_CHECKLIST_ITEMS, CATEGORY_LABELS } from '@/src/lib/templates/launch-checklist'

interface ChecklistEntry {
  completed: boolean
  completed_at: string | null
}

export type ChecklistState = Record<string, ChecklistEntry>

interface Props {
  clientId: string
  initialState: ChecklistState
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
}

export default function LaunchChecklistPanel({ clientId, initialState }: Props) {
  const [state, setState] = useState<ChecklistState>(initialState)
  const [saving, setSaving] = useState<string | null>(null)

  const completedCount = LAUNCH_CHECKLIST_ITEMS.filter((item) => state[item.key]?.completed).length
  const totalCount = LAUNCH_CHECKLIST_ITEMS.length
  const pct = Math.round((completedCount / totalCount) * 100)

  // Day X of Launch — from first ever completed_at
  const allTimestamps = LAUNCH_CHECKLIST_ITEMS
    .map((item) => state[item.key]?.completed_at)
    .filter(Boolean) as string[]
  const launchStartIso = allTimestamps.length > 0
    ? allTimestamps.reduce((a, b) => (new Date(a) < new Date(b) ? a : b))
    : null
  const launchDay = launchStartIso ? daysSince(launchStartIso) + 1 : null

  const barColor = pct === 100 ? '#00D4B4' : pct >= 60 ? '#D4AF6A' : '#94A3B8'

  async function toggle(key: string) {
    const current = state[key]?.completed ?? false
    const next = !current
    const now = new Date().toISOString()
    setSaving(key)
    setState((prev) => ({
      ...prev,
      [key]: { completed: next, completed_at: next ? now : null },
    }))

    try {
      await fetch(`/api/${clientId}/checklist`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemKey: key, completed: next }),
      })
    } catch {
      setState((prev) => ({
        ...prev,
        [key]: { completed: current, completed_at: current ? (prev[key]?.completed_at ?? null) : null },
      }))
    } finally {
      setSaving(null)
    }
  }

  // Group items by category
  const categories = Array.from(new Set(LAUNCH_CHECKLIST_ITEMS.map((i) => i.category)))

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
        <div>
          <div style={{
            fontFamily: 'var(--font-ibm-plex-mono, monospace)',
            fontSize: '10px',
            color: '#D4AF6A',
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            marginBottom: '4px',
          }}>
            Panel 05 — Launch Checklist
          </div>
          {launchDay !== null && (
            <div style={{
              fontFamily: 'var(--font-ibm-plex-mono, monospace)',
              fontSize: '11px',
              color: '#94A3B8',
              letterSpacing: '0.08em',
            }}>
              Day {launchDay} of Launch
              {launchStartIso && (
                <span style={{ opacity: 0.6, marginLeft: '8px' }}>
                  (started {formatDate(launchStartIso)})
                </span>
              )}
            </div>
          )}
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
        {/* Completion % — large number */}
        <div style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', marginBottom: '12px' }}>
            <div style={{
              fontFamily: 'var(--font-playfair, "Playfair Display", serif)',
              fontSize: '72px',
              fontWeight: 700,
              color: barColor,
              lineHeight: 1,
            }}>
              {pct}%
            </div>
            <div style={{ paddingBottom: '10px' }}>
              <div style={{
                fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                fontSize: '9px',
                color: '#94A3B8',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
              }}>
                Launch Complete
              </div>
              {pct === 100 && (
                <div style={{
                  fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                  fontSize: '10px',
                  color: '#00D4B4',
                  marginTop: '4px',
                }}>
                  ✓ All systems go
                </div>
              )}
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

        {/* Checklist grouped by category */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {categories.map((cat) => {
            const items = LAUNCH_CHECKLIST_ITEMS.filter((i) => i.category === cat)
            const catDone = items.filter((i) => state[i.key]?.completed).length
            return (
              <div key={cat}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px',
                }}>
                  <div style={{
                    fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                    fontSize: '8px',
                    color: '#94A3B8',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                  }}>
                    {CATEGORY_LABELS[cat]}
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                    fontSize: '8px',
                    color: catDone === items.length ? '#00D4B4' : '#3F3F3F',
                    letterSpacing: '0.1em',
                  }}>
                    {catDone}/{items.length}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {items.map((item) => {
                    const entry = state[item.key] ?? { completed: false, completed_at: null }
                    const done = entry.completed
                    const isSaving = saving === item.key
                    const ds = entry.completed_at ? daysSince(entry.completed_at) : null

                    return (
                      <button
                        key={item.key}
                        onClick={() => toggle(item.key)}
                        disabled={isSaving}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '12px',
                          padding: '12px 14px',
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
                          width: '16px',
                          height: '16px',
                          border: `1px solid ${done ? '#00D4B4' : '#3F3F3F'}`,
                          borderRadius: '2px',
                          background: done ? '#00D4B4' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: '1px',
                          transition: 'background 0.15s, border-color 0.15s',
                        }}>
                          {done && (
                            <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                              <path d="M1 3.5L3 5.5L8 1" stroke="#0D0D0D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: done ? '#94A3B8' : '#EDEDED',
                            letterSpacing: '0.04em',
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
                          {done && entry.completed_at && (
                            <div style={{
                              fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                              fontSize: '9px',
                              color: '#00D4B4',
                              opacity: 0.7,
                              marginTop: '4px',
                              letterSpacing: '0.05em',
                            }}>
                              ✓ {formatDate(entry.completed_at)}
                              {ds !== null && ds > 0 && ` · ${ds}d ago`}
                              {ds === 0 && ' · today'}
                            </div>
                          )}
                        </div>

                        {/* Status */}
                        <div style={{
                          fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                          fontSize: '8px',
                          color: done ? '#00D4B4' : '#3F3F3F',
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          flexShrink: 0,
                          marginTop: '1px',
                        }}>
                          {isSaving ? '...' : done ? 'DONE' : 'PENDING'}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
