'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CoordinatorHubRegisterPage() {
  const router = useRouter()
  const [name, setName]     = useState('')
  const [region, setRegion] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg]       = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setMsg(null)
    const res = await fetch('/api/coordinator/hub', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, region }),
    })
    const data = await res.json()
    if (!res.ok) {
      setMsg({ type: 'err', text: data.error || 'Something went wrong' })
      setSaving(false)
      return
    }
    if (data.requiresPayment) {
      setMsg({ type: 'ok', text: `Hub "${name}" registered. Payment of $${((data.fee_cents || 0) / 100).toFixed(2)} required to activate. Stripe checkout coming soon.` })
    } else {
      setMsg({ type: 'ok', text: `Hub "${name}" is now active! Growers can start joining.` })
      setTimeout(() => router.push('/dashboard'), 2000)
    }
    setSaving(false)
  }

  return (
    <div className="page-pad" style={{ padding: '2.5rem', maxWidth: '36rem' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--forest)', marginBottom: '0.25rem' }}>Register a Hub</h1>
      <p style={{ fontSize: '0.875rem', color: 'var(--moss)', marginBottom: '2rem' }}>
        Register your growing group or collective. Once approved, growers can join your hub.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div>
            <label className="type-label-sm" style={{ display: 'block', color: 'var(--moss)', marginBottom: '0.3rem' }}>Hub / Group Name *</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Yarra Valley Growers Collective" style={{ width: '100%' }} />
          </div>
          <div>
            <label className="type-label-sm" style={{ display: 'block', color: 'var(--moss)', marginBottom: '0.3rem' }}>Region</label>
            <input className="input" value={region} onChange={e => setRegion(e.target.value)} placeholder="e.g. Yarra Valley, VIC" style={{ width: '100%' }} />
          </div>
        </div>

        <div style={{ padding: '0.875rem 1rem', background: 'var(--olive)', borderRadius: '0.75rem', fontSize: '0.8rem', color: 'var(--moss)' }}>
          <p>After registration, The Green Guild admin will review and activate your hub. You will be notified by email once approved.</p>
        </div>

        {msg && (
          <div style={{ padding: '0.875rem 1rem', borderRadius: '0.75rem', background: msg.type === 'ok' ? '#D1FAE5' : '#FEE2E2', color: msg.type === 'ok' ? '#065F46' : '#B91C1C', fontSize: '0.85rem', fontWeight: 600 }}>
            {msg.type === 'ok' ? '✓' : '⚠'} {msg.text}
          </div>
        )}

        <button type="submit" disabled={saving || !name.trim()} className="btn btn-forest" style={{ padding: '0.875rem', borderRadius: '0.875rem' }}>
          {saving ? 'Registering…' : 'Register Hub'}
        </button>
      </form>
    </div>
  )
}
