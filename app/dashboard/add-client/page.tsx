'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const INDUSTRIES = [
  'Florist',
  'Restaurant',
  'Retail',
  'Healthcare',
  'Legal',
  'Real Estate',
  'Home Services',
  'Beauty & Wellness',
  'Fitness',
  'Education',
  'Technology',
  'Finance',
  'Hospitality',
  'Automotive',
  'Other',
]

type ProgressStep = 'idle' | 'creating-config' | 'generating-schemas' | 'done' | 'error'

export default function AddClientPage() {
  const router = useRouter()

  const [clientId, setClientId] = useState('')
  const [businessName, setBusinessName] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [industry, setIndustry] = useState('')
  const [city, setCity] = useState('')

  const [progress, setProgress] = useState<ProgressStep>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // Auto-generate clientId from business name
  function handleBusinessNameChange(val: string) {
    setBusinessName(val)
    const slug = val
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
    setClientId(slug)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErrorMsg('')
    setProgress('creating-config')

    try {
      const res = await fetch('/api/clients/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, businessName, websiteUrl, industry, city }),
      })

      const data = await res.json() as { success?: boolean; error?: string }

      if (!res.ok) {
        setErrorMsg(data.error ?? 'Failed to create client')
        setProgress('error')
        return
      }

      setProgress('generating-schemas')

      // Trigger schema generation
      const schemaRes = await fetch(`/api/${clientId}/schema/generate`, {
        method: 'POST',
      })

      if (!schemaRes.ok) {
        // Non-fatal — schemas can be generated later
        console.warn('Schema generation failed, can be retried from dashboard')
      }

      setProgress('done')

      // Redirect after a brief moment
      setTimeout(() => {
        router.push(`/dashboard/${clientId}`)
      }, 1500)
    } catch (err) {
      setErrorMsg(String(err))
      setProgress('error')
    }
  }

  const isSubmitting = progress === 'creating-config' || progress === 'generating-schemas'
  const isDone = progress === 'done'

  return (
    <div style={{ padding: '40px', maxWidth: '600px' }}>
      {/* Back link */}
      <Link
        href="/dashboard"
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
        ← Back to Overview
      </Link>

      {/* Header */}
      <h1
        style={{
          fontFamily: 'var(--font-playfair, "Playfair Display", serif)',
          fontSize: '32px',
          fontWeight: 700,
          color: '#EDEDED',
          margin: '0 0 8px',
        }}
      >
        New Client
      </h1>
      <div
        style={{
          fontFamily: 'var(--font-ibm-plex-mono, monospace)',
          fontSize: '10px',
          color: '#D4AF6A',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          marginBottom: '40px',
        }}
      >
        ANCHOR Intelligence Platform
      </div>

      {/* Progress indicator */}
      {progress !== 'idle' && (
        <div
          style={{
            background: '#161616',
            border: `1px solid ${progress === 'error' ? 'rgba(220,38,38,0.3)' : progress === 'done' ? 'rgba(0,212,180,0.3)' : '#262626'}`,
            borderRadius: '2px',
            padding: '20px 24px',
            marginBottom: '32px',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-ibm-plex-mono, monospace)',
              fontSize: '10px',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}
          >
            <ProgressLine
              label="Creating config..."
              state={
                progress === 'creating-config'
                  ? 'active'
                  : progress === 'error' || progress === 'generating-schemas' || progress === 'done'
                    ? 'done'
                    : 'pending'
              }
            />
            <ProgressLine
              label="Generating schemas..."
              state={
                progress === 'generating-schemas'
                  ? 'active'
                  : progress === 'done'
                    ? 'done'
                    : 'pending'
              }
            />
            <ProgressLine
              label="Done!"
              state={progress === 'done' ? 'done' : 'pending'}
            />
          </div>
          {progress === 'error' && errorMsg && (
            <div
              style={{
                marginTop: '12px',
                color: '#DC2626',
                fontSize: '11px',
              }}
            >
              {errorMsg}
            </div>
          )}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div
          style={{
            background: '#161616',
            border: '1px solid #262626',
            borderRadius: '2px',
            padding: '32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          <FormField
            label="Business Name"
            value={businessName}
            onChange={handleBusinessNameChange}
            placeholder="e.g. Bloom & Co Florist"
            required
            disabled={isSubmitting || isDone}
          />

          <FormField
            label="Client ID (slug)"
            value={clientId}
            onChange={setClientId}
            placeholder="e.g. bloom-co-florist"
            hint="Lowercase letters, numbers, and hyphens only"
            required
            disabled={isSubmitting || isDone}
            pattern="^[a-z0-9-]+$"
          />

          <FormField
            label="Website URL"
            value={websiteUrl}
            onChange={setWebsiteUrl}
            placeholder="e.g. https://bloomcoflorist.com"
            type="url"
            required
            disabled={isSubmitting || isDone}
          />

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
              Industry *
            </label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              required
              disabled={isSubmitting || isDone}
              style={{
                width: '100%',
                background: '#0D0D0D',
                border: '1px solid #262626',
                borderRadius: '2px',
                padding: '10px 12px',
                color: industry ? '#EDEDED' : '#94A3B8',
                fontFamily: 'var(--font-inter, sans-serif)',
                fontSize: '13px',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="" disabled>
                Select industry
              </option>
              {INDUSTRIES.map((ind) => (
                <option key={ind} value={ind} style={{ background: '#161616' }}>
                  {ind}
                </option>
              ))}
            </select>
          </div>

          <FormField
            label="Primary City"
            value={city}
            onChange={setCity}
            placeholder="e.g. Melbourne"
            required
            disabled={isSubmitting || isDone}
          />

          <div style={{ paddingTop: '8px' }}>
            <button
              type="submit"
              disabled={isSubmitting || isDone}
              style={{
                width: '100%',
                background:
                  isDone
                    ? 'rgba(0,212,180,0.15)'
                    : isSubmitting
                      ? '#262626'
                      : 'linear-gradient(135deg, #D4AF6A 0%, #B8943A 100%)',
                border: isDone ? '1px solid rgba(0,212,180,0.3)' : 'none',
                borderRadius: '2px',
                padding: '13px',
                color: isDone ? '#00D4B4' : isSubmitting ? '#94A3B8' : '#0D0D0D',
                fontFamily: 'var(--font-ibm-plex-mono, monospace)',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                cursor: isSubmitting || isDone ? 'not-allowed' : 'pointer',
              }}
            >
              {isDone
                ? '✓ CLIENT CREATED — REDIRECTING...'
                : isSubmitting
                  ? 'CREATING...'
                  : 'ADD CLIENT'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  required,
  disabled,
  type = 'text',
  pattern,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  hint?: string
  required?: boolean
  disabled?: boolean
  type?: string
  pattern?: string
}) {
  return (
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
        {label} {required && '*'}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        pattern={pattern}
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
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? 'not-allowed' : 'text',
        }}
      />
      {hint && (
        <div
          style={{
            fontFamily: 'var(--font-ibm-plex-mono, monospace)',
            fontSize: '9px',
            color: '#94A3B8',
            marginTop: '5px',
            opacity: 0.7,
          }}
        >
          {hint}
        </div>
      )}
    </div>
  )
}

function ProgressLine({
  label,
  state,
}: {
  label: string
  state: 'pending' | 'active' | 'done'
}) {
  const color =
    state === 'done' ? '#00D4B4' : state === 'active' ? '#D4AF6A' : '#94A3B8'
  const prefix =
    state === 'done' ? '✓ ' : state === 'active' ? '▶ ' : '  '

  return (
    <div
      style={{
        color,
        marginBottom: '6px',
        fontFamily: 'var(--font-ibm-plex-mono, monospace)',
        fontSize: '10px',
        letterSpacing: '0.1em',
      }}
    >
      {prefix}
      {label}
      {state === 'active' && (
        <span style={{ marginLeft: '6px', opacity: 0.7 }}>...</span>
      )}
    </div>
  )
}
