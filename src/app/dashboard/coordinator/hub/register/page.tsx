'use client'
import { useState } from 'react'
import { Elements } from '@stripe/react-stripe-js'
import { getStripe } from '@/lib/stripe/client'
import { STRIPE_APPEARANCE } from '@/lib/stripe/appearance'
import StripePaymentForm from '@/components/StripePaymentForm'

export default function CoordinatorHubRegisterPage() {
  const [name, setName]     = useState('')
  const [region, setRegion] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg]       = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [registered, setRegistered] = useState<{ name: string; approved: boolean } | null>(null)
  const [payment, setPayment] = useState<{ clientSecret: string; feeCents: number } | null>(null)

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
    setRegistered({ name, approved: !data.pendingApproval })
    if (data.requiresPayment) {
      if (data.client_secret) {
        setPayment({ clientSecret: data.client_secret, feeCents: data.fee_cents || 0 })
      } else {
        setMsg({ type: 'err', text: 'Your hub was registered, but we couldn’t start the payment. Please contact us and we’ll sort it out.' })
      }
    }
    setSaving(false)
  }

  async function handlePaymentSuccess() {
    const piId = payment?.clientSecret.split('_secret_')[0]
    setPayment(null)
    // Confirm directly rather than waiting for the async Stripe webhook.
    if (piId) await fetch('/api/coordinator/hub/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_intent_id: piId }),
    }).catch(() => null)
    setMsg({ type: 'ok', text: 'Payment received. Thank you!' })
  }

  const feeLabel = payment ? `$${(payment.feeCents / 100).toFixed(2)}` : ''

  return (
    <div className="page-pad" style={{ padding: '2.5rem', maxWidth: '36rem' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--forest)', marginBottom: '0.25rem' }}>Register a Hub / Collective</h1>
      <p style={{ fontSize: '0.875rem', color: 'var(--moss)', marginBottom: '2rem' }}>
        Register your growing collective. Once approved, growers can join your hub.
      </p>

      {registered ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ padding: '1rem 1.25rem', borderRadius: '0.75rem', background: '#D1FAE5', color: '#065F46', fontSize: '0.9rem', fontWeight: 600 }}>
            ✓ {registered.approved
              ? `Hub "${registered.name}" is now active! Growers can start joining.`
              : `Hub "${registered.name}" has been submitted for approval. An admin will review it and you'll get an email once it's active.`}
          </div>

          {payment && (
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
          )}

          {msg && (
            <div style={{ padding: '0.875rem 1rem', borderRadius: '0.75rem', background: msg.type === 'ok' ? '#D1FAE5' : '#FEE2E2', color: msg.type === 'ok' ? '#065F46' : '#B91C1C', fontSize: '0.85rem', fontWeight: 600 }}>
              {msg.type === 'ok' ? '✓' : '⚠'} {msg.text}
            </div>
          )}
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

          {msg && (
            <div style={{ padding: '0.875rem 1rem', borderRadius: '0.75rem', background: msg.type === 'ok' ? '#D1FAE5' : '#FEE2E2', color: msg.type === 'ok' ? '#065F46' : '#B91C1C', fontSize: '0.85rem', fontWeight: 600 }}>
              {msg.type === 'ok' ? '✓' : '⚠'} {msg.text}
            </div>
          )}

          <button type="submit" disabled={saving || !name.trim()} className="btn btn-forest" style={{ padding: '0.875rem', borderRadius: '0.875rem' }}>
            {saving ? 'Registering…' : 'Register Hub'}
          </button>
        </form>
      )}
    </div>
  )
}
