'use client'
import { useState } from 'react'

export default function InterestForm({ role }: { role: 'grower' | 'buyer' }) {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', business_name: '', region: '', notes: '', website: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSending(true); setError('')
    try {
      const res = await fetch('/api/interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, ...form }),
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
        <p style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.4rem' }}>Thanks — you're on the list.</p>
        <p style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>We'll email {form.email} as soon as we're ready for {role === 'grower' ? 'growers' : 'buyers'} to join.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ padding: '1.25rem 1.5rem', display: 'grid', gap: '0.8rem', background: 'white' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))', gap: '0.75rem' }}>
        <div>
          <label className="label" htmlFor="i-name">Your name *</label>
          <input id="i-name" className="input" required maxLength={120} value={form.full_name} onChange={e => set('full_name', e.target.value)} style={{ width: '100%' }} />
        </div>
        <div>
          <label className="label" htmlFor="i-email">Email *</label>
          <input id="i-email" className="input" type="email" required maxLength={200} value={form.email} onChange={e => set('email', e.target.value)} style={{ width: '100%' }} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))', gap: '0.75rem' }}>
        <div>
          <label className="label" htmlFor="i-phone">Phone</label>
          <input id="i-phone" className="input" maxLength={40} value={form.phone} onChange={e => set('phone', e.target.value)} style={{ width: '100%' }} />
        </div>
        <div>
          <label className="label" htmlFor="i-business">{role === 'grower' ? 'Farm / business name' : 'Business name'}</label>
          <input id="i-business" className="input" maxLength={200} value={form.business_name} onChange={e => set('business_name', e.target.value)} style={{ width: '100%' }} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="i-region">{role === 'grower' ? 'Where do you grow?' : 'Where are you based?'}</label>
        <input id="i-region" className="input" maxLength={200} placeholder="e.g. Yarra Valley, VIC" value={form.region} onChange={e => set('region', e.target.value)} style={{ width: '100%' }} />
      </div>
      <div>
        <label className="label" htmlFor="i-notes">
          {role === 'grower' ? 'What do you grow? (optional)' : 'What are you looking to buy? (optional)'}
        </label>
        <textarea id="i-notes" className="input" maxLength={2000} rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} style={{ width: '100%', resize: 'vertical' }} />
      </div>

      {/* Honeypot */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', height: 0, overflow: 'hidden' }}>
        <label>Leave this empty <input tabIndex={-1} autoComplete="off" value={form.website} onChange={e => set('website', e.target.value)} /></label>
      </div>

      {error && (
        <div className="badge badge-red" style={{ width: '100%', padding: '0.625rem', borderRadius: '0.75rem', justifyContent: 'flex-start', fontSize: '0.75rem' }}>⚠ {error}</div>
      )}

      <button type="submit" disabled={sending} className="btn btn-forest" style={{ width: '100%' }}>
        {sending ? 'Submitting…' : 'Register interest'}
      </button>
    </form>
  )
}
