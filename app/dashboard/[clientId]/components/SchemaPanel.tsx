'use client'

import { useState, useCallback } from 'react'

interface SchemaRow {
  id: string
  schema_type: string
  schema_data: object
  generated_at: string
  installed: boolean
}

interface Props {
  clientId: string
  schemaRows: SchemaRow[]
}

type SchemaStatus = 'installed' | 'generated' | 'missing'

function getSchemaStatus(row: SchemaRow): SchemaStatus {
  if (row.installed) return 'installed'
  if (row.schema_data) return 'generated'
  return 'missing'
}

function SchemaStatusBadge({ status }: { status: SchemaStatus }) {
  const config = {
    installed: { label: '✅ Installed', color: '#00D4B4', bg: 'rgba(0,212,180,0.1)', border: 'rgba(0,212,180,0.3)' },
    generated: { label: '⚠️ Generated', color: '#D4AF6A', bg: 'rgba(212,175,106,0.1)', border: 'rgba(212,175,106,0.3)' },
    missing: { label: '❌ Missing', color: '#DC2626', bg: 'rgba(220,38,38,0.1)', border: 'rgba(220,38,38,0.3)' },
  }
  const c = config[status]

  return (
    <span
      style={{
        fontFamily: 'var(--font-ibm-plex-mono, monospace)',
        fontSize: '9px',
        color: c.color,
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: '2px',
        padding: '3px 8px',
        letterSpacing: '0.08em',
        whiteSpace: 'nowrap',
      }}
    >
      {c.label}
    </span>
  )
}

function JsonModal({
  schemaType,
  schemaData,
  onClose,
}: {
  schemaType: string
  schemaData: object
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const formatted = JSON.stringify(schemaData, null, 2)

  // Simple syntax highlighting by regex replacement
  function highlightJson(json: string): React.ReactNode[] {
    const lines = json.split('\n')
    return lines.map((line, i) => {
      // Keys
      const keyMatch = line.match(/^(\s*)("[\w@]+")\s*:/)
      const valueMatch = line.match(/:\s*(".*?"|true|false|null|-?\d+\.?\d*)/)

      let content: React.ReactNode = line

      if (keyMatch) {
        const key = keyMatch[2]
        const rest = line.slice(keyMatch[0].length - 1)
        content = (
          <>
            {keyMatch[1]}
            <span style={{ color: '#94A3B8' }}>{key}</span>
            {rest.startsWith(':') && <span style={{ color: '#94A3B8' }}>:</span>}
            {valueMatch ? (
              <span style={{ color: valueMatch[1].startsWith('"') ? '#00D4B4' : '#D4AF6A' }}>
                {rest.slice(1)}
              </span>
            ) : (
              rest.slice(1)
            )}
          </>
        )
      }

      return (
        <div key={i} style={{ minHeight: '1.4em' }}>
          {content}
        </div>
      )
    })
  }

  async function copy() {
    await navigator.clipboard.writeText(formatted)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
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
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
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
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}
          >
            {schemaType} Schema
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={copy}
              style={{
                background: copied ? 'rgba(0,212,180,0.15)' : 'transparent',
                border: `1px solid ${copied ? 'rgba(0,212,180,0.4)' : '#262626'}`,
                borderRadius: '2px',
                padding: '5px 10px',
                color: copied ? '#00D4B4' : '#94A3B8',
                fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                fontSize: '9px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#94A3B8',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '0 4px',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* JSON body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          <pre
            style={{
              fontFamily: 'var(--font-ibm-plex-mono, monospace)',
              fontSize: '11px',
              color: '#EDEDED',
              margin: 0,
              lineHeight: 1.6,
              background: '#0D0D0D',
              border: '1px solid #262626',
              borderRadius: '2px',
              padding: '16px',
              overflowX: 'auto',
            }}
          >
            {highlightJson(formatted)}
          </pre>
        </div>
      </div>
    </div>
  )
}

export default function SchemaPanel({ clientId, schemaRows }: Props) {
  const [rows, setRows] = useState<SchemaRow[]>(schemaRows)
  const [generating, setGenerating] = useState(false)
  const [genMessage, setGenMessage] = useState('')
  const [jsonModal, setJsonModal] = useState<SchemaRow | null>(null)

  const generateSchemas = useCallback(async () => {
    setGenerating(true)
    setGenMessage('Generating schemas...')

    try {
      const res = await fetch(`/api/${clientId}/schema/generate`, {
        method: 'POST',
      })
      const data = await res.json() as {
        success?: boolean
        bundle?: Record<string, object>
        error?: string
      }

      if (!res.ok) {
        setGenMessage(`Error: ${data.error ?? 'Schema generation failed'}`)
        return
      }

      setGenMessage(`✓ ${Object.keys(data.bundle ?? {}).length} schemas generated`)

      // Reload schema data
      const validateRes = await fetch(`/api/${clientId}/schema/validate`)
      if (validateRes.ok) {
        const { results } = await validateRes.json() as {
          results: Array<{
            schemaType: string
            valid: boolean
            generatedAt: string
          }>
        }
        // Merge with existing rows or create new ones
        setRows((prev) => {
          const updated = [...prev]
          for (const r of results) {
            const existing = updated.find((u) => u.schema_type === r.schemaType)
            if (!existing) {
              updated.push({
                id: r.schemaType,
                schema_type: r.schemaType,
                schema_data: {},
                generated_at: r.generatedAt,
                installed: false,
              })
            }
          }
          return updated
        })
      }
    } catch (err) {
      setGenMessage(`Error: ${String(err)}`)
    } finally {
      setGenerating(false)
    }
  }, [clientId])

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
          Panel 04 — Schema Status
        </div>
        <button
          onClick={generateSchemas}
          disabled={generating}
          style={{
            background: generating
              ? '#262626'
              : 'linear-gradient(135deg, #D4AF6A 0%, #B8943A 100%)',
            border: 'none',
            borderRadius: '2px',
            padding: '8px 16px',
            color: generating ? '#94A3B8' : '#0D0D0D',
            fontFamily: 'var(--font-ibm-plex-mono, monospace)',
            fontSize: '9px',
            fontWeight: 600,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            cursor: generating ? 'not-allowed' : 'pointer',
          }}
        >
          {generating ? 'GENERATING...' : 'GENERATE SCHEMAS'}
        </button>
      </div>

      <div style={{ padding: '28px' }}>
        {genMessage && (
          <div
            style={{
              fontFamily: 'var(--font-ibm-plex-mono, monospace)',
              fontSize: '10px',
              color: genMessage.startsWith('Error') ? '#DC2626' : '#00D4B4',
              marginBottom: '20px',
              letterSpacing: '0.08em',
            }}
          >
            {genMessage}
          </div>
        )}

        {rows.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Schema Type', 'Status', 'Last Validated', 'Actions'].map((col) => (
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
                {rows.map((row) => {
                  const status = getSchemaStatus(row)
                  return (
                    <tr key={row.id} style={{ borderBottom: '1px solid #262626' }}>
                      <td
                        style={{
                          padding: '12px 16px 12px 0',
                          fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                          fontSize: '11px',
                          color: '#EDEDED',
                        }}
                      >
                        {row.schema_type}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <SchemaStatusBadge status={status} />
                      </td>
                      <td
                        style={{
                          padding: '12px 16px',
                          fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                          fontSize: '9px',
                          color: '#94A3B8',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {row.generated_at
                          ? new Date(row.generated_at).toLocaleDateString('en-AU', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td style={{ padding: '12px 0' }}>
                        {row.schema_data && Object.keys(row.schema_data).length > 0 && (
                          <button
                            onClick={() => setJsonModal(row)}
                            style={{
                              background: 'transparent',
                              border: '1px solid #262626',
                              borderRadius: '2px',
                              padding: '5px 10px',
                              color: '#94A3B8',
                              fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                              fontSize: '9px',
                              letterSpacing: '0.1em',
                              textTransform: 'uppercase',
                              cursor: 'pointer',
                            }}
                          >
                            View JSON
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div
            style={{
              textAlign: 'center',
              padding: '40px 0',
              color: '#94A3B8',
              fontFamily: 'var(--font-ibm-plex-mono, monospace)',
              fontSize: '11px',
              letterSpacing: '0.1em',
            }}
          >
            No schemas generated yet. Click "Generate Schemas" to start.
          </div>
        )}
      </div>

      {/* JSON modal */}
      {jsonModal && (
        <JsonModal
          schemaType={jsonModal.schema_type}
          schemaData={jsonModal.schema_data}
          onClose={() => setJsonModal(null)}
        />
      )}
    </div>
  )
}
