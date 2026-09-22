'use client'
import { useState, useEffect } from 'react'
import { Elements } from '@stripe/react-stripe-js'
import { getStripe } from '@/lib/stripe/client'
import { STRIPE_APPEARANCE } from '@/lib/stripe/appearance'
import StripePaymentForm from '@/components/StripePaymentForm'

const STATUS_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  pending:  { label: '⏳ Awaiting admin approval', bg: '#FEF3C7', color: '#92400E' },
  active:   { label: '✓ Active — growers can join', bg: '#D1FAE5', color: '#065F46' },
  inactive: { label: 'Inactive', bg: '#F1EFE8', color: '#5F5E5A' },
}

type Hub = { id: string; name: string; region: string | null; status: string }
type Sub = { status: string; amount_cents: number } | null

function Banner({ type, text }: { type: 'ok' | 'err'; text: string }) {
  return (
    <div style={{ padding: '0.875rem 1rem', borderRadius: '0.75rem', background: type === 'ok' ? '#D1FAE5' : '#FEE2E2', color: type === 'ok' ? '#065F46' : '#B91C1C', fontSize: '0.85rem', fontWeight: 600 }}>
      {type === 'ok' ? '✓' : '⚠'} {text}
    </div>
  )
}

export default function CoordinatorHubRegisterPage() {
  const [loading, setLoading] = useState(true)
  const [hubs, setHubs]       = useState<Hub[]>([])
  const [sub, setSub]         = useState<Sub>(null)

  const [name, setName]     = useState('')
  const [region, setRegion] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg]       = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [payment, setPayment] = useState<{ clientSecret: string; feeCents: number } | null>(null)
  const [resuming, setResuming] = useState(false)

  function loadStatus() {
    return fetch('/api/coordinator/hub').then(r => r.json()).then(data => {
      setHubs(data.hubs || [])
      setSub(data.subscription || null)
    }).catch(() => {})
  }

  useEffect(() => { loadStatus().finally(() => setLoading(false)) }, [])

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
    await loadStatus()
    if (data.requiresPayment) {
      if (data.client_secret) {
        setPayment({ clientSecret: data.client_secret, feeCents: data.fee_cents || 0 })
      } else {
        setMsg({ type: 'err', text: 'Your hub was registered, but we couldn’t start the payment. Please contact us and we’ll sort it out.' })
      }
    } else {
      setMsg({ type: 'ok', text: `Hub "${name}" has been submitted for approval. An admin will review it and you'll get an email once it's active.` })
    }
    setSaving(false)
  }

  async function resumePayment() {
    setResuming(true); setMsg(null)
    const res = await fetch('/api/coordinator/hub/pay', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setMsg({ type: 'err', text: data.error || 'Could not start payment. Please try again.' })
      setResuming(false)
      return
    }
    setPayment({ clientSecret: data.client_secret, feeCents: data.amount_cents || 0 })
    setResuming(false)
  }

  async function handlePaymentSuccess() {
    const piId = payment?.clientSecret.split('_secret_')[0]
    setPayment(null)
    if (piId) await fetch('/api/coordinator/hub/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_intent_id: piId }),
    }).catch(() => null)
    await loadStatus()
    setMsg({ type: 'ok', text: 'Payment received. Thank you!' })
  }

  const feeLabel = payment ? `$${(payment.feeCents / 100).toFixed(2)}` : ''
  const pendingPayment = sub?.status === 'pending' && (sub.amount_cents || 0) > 0

  if (loading) return (
    <div className="page-pad" style={{ padding: '2.5rem', maxWidth: '36rem', color: 'var(--moss)' }}>Loading…</div>
  )

  return (
    <div className="page-pad" style={{ padding: '2.5rem', maxWidth: '36rem' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--forest)', marginBottom: '0.25rem' }}>Register a Hub / Collective</h1>
      <p style={{ fontSize: '0.875rem', color: 'var(--moss)', marginBottom: '2rem' }}>
        Register your growing collective. Once approved, growers can join your hub.
      </p>

      {hubs.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {hubs.map(hub => {
            const s = STATUS_LABEL[hub.status] || STATUS_LABEL.inactive
            return (
              <div key={hub.id} className="card" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                <div>
                  <p style={{ fontWeight: 700, color: 'var(--forest)' }}>{hub.name}</p>
                  {hub.region && <p style={{ fontSize: '0.8rem', color: 'var(--moss)' }}>{hub.region}</p>}
                </div>
                <span style={{ padding: '0.3rem 0.75rem', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 700, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>{s.label}</span>
              </div>
            )
          })}

          {pendingPayment && (
            payment ? (
              <div className="card-forest" style={{ padding: '1.75rem' }}>
                <p style={{ color: 'var(--cream)', fontWeight: 700, marginBottom: '1.25rem' }}>Pay the {feeLabel} registration fee</p>
                <Elements stripe={getStripe()} options={{ clientSecret: payment.clientSecret, appearance: STRIPE_APPEARANCE }}>
                  <StripePaymentForm
                    amountLabel={`Pay ${feeLabel}`}
                    returnUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/dashboard/coordinator/hub/register`}
                    onSuccess={handlePaymentSuccess}
                  />
                </Elements>
              </div>
            ) : (
              <div className="card-forest" style={{ padding: '1.75rem' }}>
                <p style={{ color: 'var(--cream)', fontWeight: 700, marginBottom: '0.375rem' }}>Payment required to activate</p>
                <p style={{ color: 'var(--sage)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                  Pay ${((sub!.amount_cents || 0) / 100).toFixed(2)} to finish registering your hub.
                </p>
                <button onClick={resumePayment} disabled={resuming} className="btn btn-cream" style={{ width: '100%' }}>
                  {resuming ? 'Loading payment form…' : `Pay $${((sub!.amount_cents || 0) / 100).toFixed(2)} now`}
                </button>
              </div>
            )
          )}

          {msg && <Banner type={msg.type} text={msg.text} />}
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div>
              <label className="type-label-sm" style={{ display: 'block', color: 'var(--moss)', marginBottom: '0.3rem' }}>Hub / Collective Name *</label>
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

          {msg && <Banner type={msg.type} text={msg.text} />}

          <button type="submit" disabled={saving || !name.trim()} className="btn btn-forest" style={{ padding: '0.875rem', borderRadius: '0.875rem' }}>
            {saving ? 'Registering…' : 'Register Hub'}
          </button>
        </form>
      )}
    </div>
  )
}
