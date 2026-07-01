'use client'
import { useState } from 'react'

const BG = 'radial-gradient(circle at center, rgba(8,115,79,0.25), transparent 50%), linear-gradient(180deg, #0f2d28 0%, #123730 100%)'

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
    <section style={{ padding: '3rem 2rem 2.5rem', background: BG }}>
      <div style={{ maxWidth: '640px', margin: '0 auto', textAlign: 'center' }}>
        <p style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)', marginBottom: '0.75rem' }}>
          Stay in season
        </p>
        <h2 style={{
          fontFamily: 'Georgia, serif',
          fontSize: 'clamp(1.4rem, 3vw, 2rem)',
          fontWeight: 400,
          color: 'white',
          letterSpacing: '-0.01em',
          marginBottom: '0.75rem',
          lineHeight: 1.2,
        }}>
          Get weekly market updates
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '2rem' }}>
          Fresh availability, seasonal highlights, and grower stories — straight to your inbox every week.
        </p>

        {status === 'ok' ? (
          <div style={{
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '10px',
            padding: '1rem 2rem',
            color: 'rgba(255,255,255,0.85)',
            fontFamily: 'Georgia, serif',
            fontSize: '0.95rem',
          }}>
            {msg}
          </div>
        ) : (
          <form suppressHydrationWarning onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.6rem', maxWidth: '460px', margin: '0 auto', flexWrap: 'wrap', justifyContent: 'center' }}>
            <input
              suppressHydrationWarning
              type="email"
              required
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={status === 'loading'}
              style={{
                flex: 1,
                minWidth: '200px',
                padding: '0.75rem 1.1rem',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.18)',
                background: 'rgba(255,255,255,0.06)',
                color: 'white',
                fontSize: '0.88rem',
                outline: 'none',
                fontFamily: 'Georgia, serif',
              }}
            />
            <button
              suppressHydrationWarning
              type="submit"
              disabled={status === 'loading'}
              style={{
                background: '#f0ebe0',
                color: '#173a33',
                border: 'none',
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                fontFamily: 'Georgia, serif',
                fontWeight: 600,
                fontSize: '0.88rem',
                cursor: status === 'loading' ? 'wait' : 'pointer',
                opacity: status === 'loading' ? 0.7 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {status === 'loading' ? 'Subscribing…' : 'Subscribe'}
            </button>
            {status === 'error' && (
              <p style={{ width: '100%', color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', marginTop: '0.25rem' }}>{msg}</p>
            )}
          </form>
        )}

        <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.72rem', marginTop: '1.25rem' }}>
          No spam. Unsubscribe anytime.
        </p>
      </div>
    </section>
  )
}
