'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type ContentType = 'blog' | 'gmb' | 'location' | 'qa'
type GmbType = 'update' | 'offer' | 'event' | 'product'

const CONTENT_TYPES: { value: ContentType; label: string; icon: string }[] = [
  { value: 'blog', label: 'Blog Post', icon: '✍' },
  { value: 'gmb', label: 'GMB Post', icon: '📍' },
  { value: 'location', label: 'Location Page', icon: '🗺' },
  { value: 'qa', label: 'Q&A Blocks', icon: '💬' },
]

const GMB_TYPES: { value: GmbType; label: string }[] = [
  { value: 'update', label: 'Update' },
  { value: 'offer', label: 'Offer' },
  { value: 'event', label: 'Event' },
  { value: 'product', label: 'Product' },
]

interface GeneratedContent {
  title?: string
  slug?: string
  body: string
  metaTitle?: string
  metaDescription?: string
  headline?: string
  cta?: string
}

export default function GeneratePage() {
  const params = useParams()
  const clientId = params.clientId as string

  const [contentType, setContentType] = useState<ContentType>('blog')
  const [topic, setTopic] = useState('')
  const [targetKeyword, setTargetKeyword] = useState('')
  const [city, setCity] = useState('')
  const [gmbType, setGmbType] = useState<GmbType>('update')

  const [generating, setGenerating] = useState(false)
  const [streamedText, setStreamedText] = useState('')
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  const outputRef = useRef<HTMLDivElement>(null)

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current && streamedText) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [streamedText])

  const handleGenerate = useCallback(async () => {
    if (!topic && contentType !== 'qa') {
      setError('Please enter a topic')
      return
    }
    if (contentType === 'location' && !city) {
      setError('Please enter a city for location pages')
      return
    }

    setError('')
    setGenerating(true)
    setStreamedText('')
    setGeneratedContent(null)
    setSaved(false)

    const body: Record<string, string> = { type: contentType }
    if (topic) body.topic = topic
    if (contentType === 'blog' && targetKeyword) body.targetKeyword = targetKeyword
    if (contentType === 'location' && city) body.city = city
    if (contentType === 'gmb') body.gmbType = gmbType

    try {
      const res = await fetch(`/api/${clientId}/content/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json() as { error?: string }
        setError(data.error ?? 'Generation failed')
        setGenerating(false)
        return
      }

      const data = await res.json() as {
        id?: string
        ids?: string[]
        type: string
        content: GeneratedContent | GeneratedContent[]
      }

      // Normalise content
      const content: GeneratedContent = Array.isArray(data.content)
        ? {
            body: (data.content as unknown as Array<{ question: string; answer: string }>)
              .map((b, i) => `Q${i + 1}: ${b.question}\nA: ${b.answer}`)
              .join('\n\n'),
          }
        : (data.content as GeneratedContent)

      // Simulate streaming by revealing text progressively
      const fullText = content.body ?? ''
      let i = 0
      const interval = setInterval(() => {
        i += 12
        if (i >= fullText.length) {
          setStreamedText(fullText)
          setGeneratedContent(content)
          setGenerating(false)
          clearInterval(interval)
        } else {
          setStreamedText(fullText.slice(0, i))
        }
      }, 16)
    } catch (err) {
      setError(String(err))
      setGenerating(false)
    }
  }, [clientId, contentType, topic, targetKeyword, city, gmbType])

  async function handleCopy() {
    if (!generatedContent) return
    await navigator.clipboard.writeText(generatedContent.body)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  async function handleSaveDraft() {
    setSaved(true)
  }

  return (
    <div style={{ padding: '40px', minHeight: '100vh' }}>
      {/* Back link */}
      <Link
        href={`/dashboard/${clientId}`}
        style={{
          fontFamily: 'var(--font-ibm-plex-mono, monospace)',
          fontSize: '10px',
          color: '#94A3B8',
          letterSpacing: '0.12em',
          textDecoration: 'none',
          textTransform: 'uppercase',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '32px',
        }}
      >
        ← Back to Dashboard
      </Link>

      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1
          style={{
            fontFamily: 'var(--font-playfair, "Playfair Display", serif)',
            fontSize: '30px',
            fontWeight: 700,
            color: '#EDEDED',
            margin: '0 0 6px',
          }}
        >
          Content Studio
        </h1>
        <div
          style={{
            fontFamily: 'var(--font-ibm-plex-mono, monospace)',
            fontSize: '10px',
            color: '#D4AF6A',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}
        >
          ANCHOR Intelligence — Content Generation
        </div>
      </div>

      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
        {/* LEFT PANEL: Controls */}
        <div
          style={{
            width: '350px',
            minWidth: '350px',
            background: '#161616',
            border: '1px solid #262626',
            borderRadius: '2px',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          {/* Content type selector */}
          <div>
            <div
              style={{
                fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                fontSize: '9px',
                color: '#94A3B8',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                marginBottom: '10px',
              }}
            >
              Content Type
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {CONTENT_TYPES.map((ct) => (
                <button
                  key={ct.value}
                  onClick={() => {
                    setContentType(ct.value)
                    setError('')
                    setStreamedText('')
                    setGeneratedContent(null)
                  }}
                  style={{
                    background:
                      contentType === ct.value
                        ? 'rgba(212,175,106,0.12)'
                        : 'transparent',
                    border: `1px solid ${contentType === ct.value ? 'rgba(212,175,106,0.4)' : '#262626'}`,
                    borderRadius: '2px',
                    padding: '10px 14px',
                    color: contentType === ct.value ? '#D4AF6A' : '#94A3B8',
                    fontFamily: 'var(--font-inter, sans-serif)',
                    fontSize: '13px',
                    fontWeight: contentType === ct.value ? 600 : 400,
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    transition: 'all 0.15s',
                  }}
                >
                  <span>{ct.icon}</span>
                  {ct.label}
                </button>
              ))}
            </div>
          </div>

          {/* Topic input */}
          {contentType !== 'qa' && (
            <div>
              <label
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                  fontSize: '9px',
                  color: '#94A3B8',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  marginBottom: '8px',
                }}
              >
                {contentType === 'location'
                  ? 'Topic / Angle'
                  : contentType === 'gmb'
                    ? 'Post Topic'
                    : 'Blog Topic'}
              </label>
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={
                  contentType === 'blog'
                    ? 'e.g. How to care for orchids at home'
                    : contentType === 'gmb'
                      ? 'e.g. Valentine\'s Day special arrangement'
                      : 'e.g. Best florist in the area'
                }
                rows={3}
                style={{
                  width: '100%',
                  background: '#0D0D0D',
                  border: '1px solid #262626',
                  borderRadius: '2px',
                  padding: '10px 12px',
                  color: '#EDEDED',
                  fontFamily: 'var(--font-inter, sans-serif)',
                  fontSize: '13px',
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* Target keyword (blog only) */}
          {contentType === 'blog' && (
            <div>
              <label
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                  fontSize: '9px',
                  color: '#94A3B8',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  marginBottom: '8px',
                }}
              >
                Target Keyword
              </label>
              <input
                type="text"
                value={targetKeyword}
                onChange={(e) => setTargetKeyword(e.target.value)}
                placeholder="e.g. orchid care tips"
                style={{
                  width: '100%',
                  background: '#0D0D0D',
                  border: '1px solid #262626',
                  borderRadius: '2px',
                  padding: '10px 12px',
                  color: '#EDEDED',
                  fontFamily: 'var(--font-inter, sans-serif)',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* City selector (location only) */}
          {contentType === 'location' && (
            <div>
              <label
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                  fontSize: '9px',
                  color: '#94A3B8',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  marginBottom: '8px',
                }}
              >
                City
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Melbourne"
                style={{
                  width: '100%',
                  background: '#0D0D0D',
                  border: '1px solid #262626',
                  borderRadius: '2px',
                  padding: '10px 12px',
                  color: '#EDEDED',
                  fontFamily: 'var(--font-inter, sans-serif)',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}

          {/* GMB type selector */}
          {contentType === 'gmb' && (
            <div>
              <label
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                  fontSize: '9px',
                  color: '#94A3B8',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  marginBottom: '8px',
                }}
              >
                Post Type
              </label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {GMB_TYPES.map((gt) => (
                  <button
                    key={gt.value}
                    onClick={() => setGmbType(gt.value)}
                    style={{
                      background:
                        gmbType === gt.value
                          ? 'rgba(212,175,106,0.15)'
                          : 'transparent',
                      border: `1px solid ${gmbType === gt.value ? 'rgba(212,175,106,0.4)' : '#262626'}`,
                      borderRadius: '2px',
                      padding: '6px 12px',
                      color: gmbType === gt.value ? '#D4AF6A' : '#94A3B8',
                      fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                      fontSize: '9px',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                    }}
                  >
                    {gt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* QA info */}
          {contentType === 'qa' && (
            <div
              style={{
                background: 'rgba(0,212,180,0.06)',
                border: '1px solid rgba(0,212,180,0.15)',
                borderRadius: '2px',
                padding: '12px 14px',
                fontFamily: 'var(--font-inter, sans-serif)',
                fontSize: '12px',
                color: '#94A3B8',
                lineHeight: 1.6,
              }}
            >
              Q&A blocks are generated from your client&apos;s AEO query list. No
              topic input required.
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              style={{
                background: 'rgba(220,38,38,0.1)',
                border: '1px solid rgba(220,38,38,0.3)',
                borderRadius: '2px',
                padding: '10px 12px',
                fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                fontSize: '10px',
                color: '#DC2626',
                letterSpacing: '0.05em',
              }}
            >
              {error}
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              background: generating
                ? '#262626'
                : 'linear-gradient(135deg, #D4AF6A 0%, #B8943A 100%)',
              border: 'none',
              borderRadius: '2px',
              padding: '13px',
              color: generating ? '#94A3B8' : '#0D0D0D',
              fontFamily: 'var(--font-ibm-plex-mono, monospace)',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              cursor: generating ? 'not-allowed' : 'pointer',
              marginTop: '4px',
            }}
          >
            {generating ? 'GENERATING...' : 'GENERATE'}
          </button>
        </div>

        {/* RIGHT PANEL: Output */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              background: '#161616',
              border: '1px solid #262626',
              borderRadius: '2px',
              minHeight: '500px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Output header */}
            <div
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid #262626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                  fontSize: '9px',
                  color: '#94A3B8',
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                Output
                {generating && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#D4AF6A',
                      animation: 'pulse 1s infinite',
                    }}
                  />
                )}
              </div>

              {/* Actions */}
              {generatedContent && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleCopy}
                    style={{
                      background: copied ? 'rgba(0,212,180,0.12)' : 'transparent',
                      border: `1px solid ${copied ? 'rgba(0,212,180,0.4)' : '#262626'}`,
                      borderRadius: '2px',
                      padding: '6px 12px',
                      color: copied ? '#00D4B4' : '#94A3B8',
                      fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                      fontSize: '9px',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                    }}
                  >
                    {copied ? '✓ COPIED' : 'COPY'}
                  </button>
                  <button
                    onClick={handleSaveDraft}
                    style={{
                      background: saved
                        ? 'rgba(0,212,180,0.12)'
                        : 'linear-gradient(135deg, #D4AF6A 0%, #B8943A 100%)',
                      border: saved ? '1px solid rgba(0,212,180,0.4)' : 'none',
                      borderRadius: '2px',
                      padding: '6px 12px',
                      color: saved ? '#00D4B4' : '#0D0D0D',
                      fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                      fontSize: '9px',
                      fontWeight: 600,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      cursor: saved ? 'default' : 'pointer',
                    }}
                  >
                    {saved ? '✓ SAVED' : 'SAVE DRAFT'}
                  </button>
                </div>
              )}
            </div>

            {/* Streamed content */}
            <div
              ref={outputRef}
              style={{
                flex: 1,
                padding: '24px',
                overflowY: 'auto',
                maxHeight: '600px',
              }}
            >
              {streamedText ? (
                <div
                  style={{
                    fontFamily: 'var(--font-inter, sans-serif)',
                    fontSize: '13px',
                    color: '#EDEDED',
                    lineHeight: 1.8,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {streamedText}
                  {generating && (
                    <span
                      style={{
                        display: 'inline-block',
                        width: '2px',
                        height: '14px',
                        background: '#D4AF6A',
                        marginLeft: '2px',
                        verticalAlign: 'text-bottom',
                        animation: 'blink 0.7s step-end infinite',
                      }}
                    />
                  )}
                </div>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '400px',
                    gap: '16px',
                    opacity: 0.4,
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-playfair, serif)',
                      fontSize: '48px',
                      color: '#D4AF6A',
                      lineHeight: 1,
                    }}
                  >
                    ✦
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                      fontSize: '10px',
                      color: '#94A3B8',
                      letterSpacing: '0.15em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Select type and generate
                  </div>
                </div>
              )}
            </div>

            {/* Meta section */}
            {generatedContent && (generatedContent.metaTitle || generatedContent.metaDescription) && (
              <div
                style={{
                  borderTop: '1px solid #262626',
                  padding: '20px 24px',
                  background: '#0D0D0D',
                }}
              >
                <div
                  style={{
                    fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                    fontSize: '8px',
                    color: '#94A3B8',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    marginBottom: '12px',
                  }}
                >
                  SEO Meta
                </div>
                {generatedContent.metaTitle && (
                  <div style={{ marginBottom: '8px' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                        fontSize: '9px',
                        color: '#D4AF6A',
                        marginRight: '8px',
                      }}
                    >
                      Title:
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-inter, sans-serif)',
                        fontSize: '12px',
                        color: '#EDEDED',
                      }}
                    >
                      {generatedContent.metaTitle}
                    </span>
                  </div>
                )}
                {generatedContent.metaDescription && (
                  <div>
                    <span
                      style={{
                        fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                        fontSize: '9px',
                        color: '#D4AF6A',
                        marginRight: '8px',
                      }}
                    >
                      Desc:
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-inter, sans-serif)',
                        fontSize: '12px',
                        color: '#94A3B8',
                      }}
                    >
                      {generatedContent.metaDescription}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
