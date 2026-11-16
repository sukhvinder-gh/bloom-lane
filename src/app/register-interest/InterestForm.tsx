'use client'
import { useState } from 'react'
import { sanitizeABNInput, validateABNFormat } from '@/lib/utils/abn'
import { AUSTRALIAN_STATES } from '@/lib/utils/lga'

export default function InterestForm({ role }: { role: 'grower' | 'buyer' }) {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', business_name: '', abn: '', address: '', region: '', state: 'VIC', postcode: '', notes: '', website: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateABNFormat(form.abn)) {
      setError('Please enter a valid 11-digit ABN')
      return
    }
    if (!form.address.trim() || !form.region.trim() || !form.state || !/^\d{4}$/.test(form.postcode)) {
      setError('Please enter a complete address, including a valid 4-digit postcode')
      return
    }
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
        <label className="label" htmlFor="i-abn">ABN *</label>
        <input id="i-abn" className="input" required maxLength={11} placeholder="XX XXX XXX XXX" value={form.abn} onChange={e => set('abn', sanitizeABNInput(e.target.value))} style={{ width: '100%' }} />
      </div>
      <div>
        <label className="label" htmlFor="i-address" style={{ display: 'block', marginBottom: '0.3rem' }}>
          {role === 'grower' ? 'Where do you grow?' : 'Where are you based?'}
        </label>
        <input id="i-address" className="input" required maxLength={200} placeholder="Street address" value={form.address} onChange={e => set('address', e.target.value)} style={{ width: '100%' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem' }}>
        <div>
          <label className="label" htmlFor="i-suburb">Suburb</label>
          <input id="i-suburb" className="input" required maxLength={200} value={form.region} onChange={e => set('region', e.target.value)} style={{ width: '100%' }} />
        </div>
        <div>
          <label className="label" htmlFor="i-state">State</label>
          <select id="i-state" className="input" value={form.state} onChange={e => set('state', e.target.value)} style={{ width: '100%' }}>
            {AUSTRALIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="i-postcode">Postcode</label>
          <input id="i-postcode" className="input" required maxLength={4} value={form.postcode} onChange={e => set('postcode', e.target.value.replace(/\D/g, '').slice(0, 4))} style={{ width: '100%' }} />
        </div>
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
