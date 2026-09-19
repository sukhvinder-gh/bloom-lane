'use client'
import { useState } from 'react'

const TOPICS = [
  'General question',
  'Buying on The Green Guild',
  'Selling as a grower',
  'Setting up a hub or collective',
  'A problem with an order',
  'Something else',
]

export default function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', topic: TOPICS[0], order: '', message: '', website: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true); setError('')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error || 'Something went wrong. Please try again.'); return }
      setSent(true)
    } catch {
      setError('Could not reach the server. Please check your connection and try again.')
    } finally {
      setSending(false)
    }
  }

  if (sent) {
    return (
      <div className="card-forest" style={{ padding: '2rem', textAlign: 'center', color: 'var(--cream)' }}>
        <p style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.4rem' }}>Thanks, your message is on its way.</p>
        <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>We&rsquo;ll reply to {form.email} as soon as we can.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ padding: '1.25rem 1.5rem', display: 'grid', gap: '0.8rem', background: 'white' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))', gap: '0.75rem' }}>
        <div>
          <label className="label" htmlFor="c-name">Your name *</label>
          <input id="c-name" className="input" required maxLength={120} value={form.name} onChange={e => set('name', e.target.value)} style={{ width: '100%' }} />
        </div>
        <div>
          <label className="label" htmlFor="c-email">Email *</label>
          <input id="c-email" className="input" type="email" required maxLength={200} value={form.email} onChange={e => set('email', e.target.value)} style={{ width: '100%' }} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="c-topic">What is this about?</label>
        <select id="c-topic" className="input" value={form.topic} onChange={e => set('topic', e.target.value)} style={{ width: '100%' }}>
          {TOPICS.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>
      {form.topic === 'A problem with an order' && (
        <div>
          <label className="label" htmlFor="c-order">Order number</label>
          <input id="c-order" className="input" maxLength={40} placeholder="e.g. ORD-6D516970" value={form.order} onChange={e => set('order', e.target.value)} style={{ width: '100%' }} />
        </div>
      )}
      <div>
        <label className="label" htmlFor="c-message">Message *</label>
        <textarea id="c-message" className="input" required minLength={10} maxLength={4000} rows={4} value={form.message} onChange={e => set('message', e.target.value)} style={{ width: '100%', resize: 'vertical' }} />
      </div>

      {/* Honeypot: hidden from people, filled in by simple bots. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', height: 0, overflow: 'hidden' }}>
        <label>Leave this empty <input tabIndex={-1} autoComplete="off" value={form.website} onChange={e => set('website', e.target.value)} /></label>
      </div>

      {error && (
        <div className="badge badge-red" style={{ width: '100%', padding: '0.625rem', borderRadius: '0.75rem', justifyContent: 'flex-start', fontSize: '0.75rem' }}>⚠ {error}</div>
      )}

      <button type="submit" disabled={sending} className="btn btn-forest" style={{ width: '100%' }}>
        {sending ? 'Sending…' : 'Send message'}
      </button>
    </form>
  )
}
