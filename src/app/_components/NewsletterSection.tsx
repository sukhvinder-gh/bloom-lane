'use client'
import { useState } from 'react'

export default function NewsletterSection() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setStatus('loading')
    try {
      const res = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus('ok')
        setMsg(data.message || "You're on the list!")
        setEmail('')
      } else {
        setStatus('error')
        setMsg(data.error || 'Something went wrong. Please try again.')
      }
    } catch {
      setStatus('error')
      setMsg('Something went wrong. Please try again.')
    }
  }

  return (
    <section style={{ padding: '5rem 2rem', background: '#0b1d12' }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
        <p style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--bloom)', marginBottom: '1rem' }}>
          Stay in season
        </p>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
          fontWeight: 700,
          color: 'white',
          letterSpacing: '-0.02em',
          marginBottom: '1rem',
          lineHeight: 1.15,
        }}>
          Get weekly market updates
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.95rem', lineHeight: 1.8, marginBottom: '2.5rem' }}>
          Fresh availability, seasonal highlights, and grower stories — straight to your inbox every week.
        </p>

        {status === 'ok' ? (
          <div style={{
            background: 'rgba(168,213,162,0.12)',
            border: '1px solid rgba(168,213,162,0.3)',
            borderRadius: '12px',
            padding: '1.25rem 2rem',
            color: '#a8d5a2',
            fontWeight: 600,
            fontSize: '0.95rem',
          }}>
            {msg}
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.75rem', maxWidth: '480px', margin: '0 auto', flexWrap: 'wrap', justifyContent: 'center' }}>
            <input
              type="email"
              required
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={status === 'loading'}
              style={{
                flex: 1,
                minWidth: '220px',
                padding: '0.875rem 1.25rem',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.06)',
                color: 'white',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={status === 'loading'}
              style={{
                background: 'var(--bloom)',
                color: 'white',
                border: 'none',
                padding: '0.875rem 1.75rem',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: '0.875rem',
                cursor: status === 'loading' ? 'wait' : 'pointer',
                opacity: status === 'loading' ? 0.7 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {status === 'loading' ? 'Subscribing…' : 'Subscribe'}
            </button>
            {status === 'error' && (
              <p style={{ width: '100%', color: 'rgba(232,93,122,0.9)', fontSize: '0.8rem', marginTop: '0.25rem' }}>{msg}</p>
            )}
          </form>
        )}

        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem', marginTop: '1.5rem' }}>
          No spam. Unsubscribe anytime.
        </p>
      </div>
    </section>
  )
}
