'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Elements } from '@stripe/react-stripe-js'
import { getStripe } from '@/lib/stripe/client'
import { STRIPE_APPEARANCE } from '@/lib/stripe/appearance'
import StripePaymentForm from '@/components/StripePaymentForm'

const STATUS_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  pending:  { label: '⏳ Awaiting admin approval', bg: '#FEF3C7', color: '#92400E' },
  active:   { label: '✓ Active — growers can join', bg: '#D1FAE5', color: '#065F46' },
  inactive: { label: 'Inactive', bg: '#F1EFE8', color: '#5F5E5A' },
}

type Hub = {
  id: string; name: string; region: string | null; status: string
  stripe_account_id?: string | null; stripe_onboarding_complete?: boolean
}
type Sub = { status: string; amount_cents: number } | null
type Member = {
  id: string
  business_name: string | null
  profiles: { full_name: string | null; email: string | null } | null
  subscriptions: { status: string; plan: string; expires_at: string | null }[]
}

function Banner({ type, text }: { type: 'ok' | 'err'; text: string }) {
  return (
    <div style={{ padding: '0.875rem 1rem', borderRadius: '0.75rem', background: type === 'ok' ? '#D1FAE5' : '#FEE2E2', color: type === 'ok' ? '#065F46' : '#B91C1C', fontSize: '0.85rem', fontWeight: 600 }}>
      {type === 'ok' ? '✓' : '⚠'} {text}
    </div>
  )
}

export default function CoordinatorHubRegisterPage() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [hubs, setHubs]       = useState<Hub[]>([])
  const [sub, setSub]         = useState<Sub>(null)

  const [name, setName]     = useState('')
  const [region, setRegion] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg]       = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  useEffect(() => {
    if (searchParams.get('stripe_error') !== '1') return
    const detail = searchParams.get('stripe_error_msg')
    setMsg({ type: 'err', text: detail ? `Something went wrong setting up Stripe: ${detail}` : 'Something went wrong setting up Stripe. Please try again, or contact support if it keeps happening.' })
  }, [searchParams])
  const [payment, setPayment] = useState<{ clientSecret: string; feeCents: number } | null>(null)
  const [resuming, setResuming] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [membersLoaded, setMembersLoaded] = useState(false)

  function loadStatus() {
    return fetch('/api/coordinator/hub').then(r => r.json()).then(data => {
      setHubs(data.hubs || [])
      setSub(data.subscription || null)
    }).catch(() => {})
  }

  useEffect(() => { loadStatus().finally(() => setLoading(false)) }, [])

  const hasActiveHub = hubs.some(h => h.status === 'active')
  useEffect(() => {
    if (!hasActiveHub) return
    fetch('/api/coordinator/hub/members').then(r => r.json()).then(data => {
      setMembers(data.data || [])
      setMembersLoaded(true)
    }).catch(() => setMembersLoaded(true))
  }, [hasActiveHub])

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
    <div className="page-pad" style={{ padding: '2.5rem', maxWidth: '44rem', color: 'var(--moss)' }}>Loading…</div>
  )

  return (
    <div className="page-pad" style={{ padding: '2.5rem', maxWidth: '44rem' }}>
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

          {hasActiveHub && (() => {
            const activeHub = hubs.find(h => h.status === 'active')!
            return activeHub.stripe_onboarding_complete ? (
              <div style={{ padding: '0.875rem 1rem', background: '#D1FAE5', borderRadius: '0.75rem', fontSize: '0.85rem', color: '#065F46', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <span>✓ Payout account connected — growers in this hub are paid out to your hub's account, not directly to them.</span>
                <a href="/api/coordinator/stripe/onboarding"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'white', border: '1px solid #6EE7B7', color: '#065F46', padding: '0.4rem 1rem', borderRadius: '99px', textDecoration: 'none', fontSize: '0.78rem', fontWeight: 700, flexShrink: 0 }}>
                  Update bank details →
                </a>
              </div>
            ) : (
              <div className="card" style={{ padding: '1.5rem' }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', color: 'var(--forest)', marginBottom: '0.375rem' }}>Connect a payout account</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--moss)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
                  Growers in your hub are paid directly by default. Connect your hub's own Stripe account and their payouts come to your hub instead, so you can distribute them yourselves.
                </p>
                <a href="/api/coordinator/stripe/onboarding" className="btn btn-forest" style={{ width: '100%', display: 'inline-flex', justifyContent: 'center' }}>
                  {activeHub.stripe_account_id ? 'Continue Setup' : 'Connect Payout Account'}
                </a>
              </div>
            )
          })()}

          {hasActiveHub && (
            <div className="card" style={{ padding: '1.5rem' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', color: 'var(--forest)', marginBottom: '0.25rem' }}>Growers in your hub</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--moss)', marginBottom: '1.25rem' }}>
                Growers join by selecting Hub Membership and picking your hub on their Membership page — there's nothing for you to approve.
              </p>
              {!membersLoaded ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--moss)' }}>Loading…</p>
              ) : members.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--moss)' }}>No growers have joined yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {members.map(m => {
                    const activeSub = m.subscriptions?.find(s => s.status === 'active')
                    return (
                      <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 1rem', background: 'var(--olive)', borderRadius: '0.75rem' }}>
                        <div>
                          <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--forest)' }}>{m.business_name || m.profiles?.full_name || 'Grower'}</p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--moss)' }}>{m.profiles?.email}</p>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--moss)', whiteSpace: 'nowrap' }}>
                          {activeSub ? `Active · renews ${activeSub.expires_at ? new Date(activeSub.expires_at).toLocaleDateString('en-AU') : '—'}` : 'No active membership'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
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

          {msg && <Banner type={msg.type} text={msg.text} />}

          <button type="submit" disabled={saving || !name.trim()} className="btn btn-forest" style={{ padding: '0.875rem', borderRadius: '0.875rem' }}>
            {saving ? 'Registering…' : 'Register Hub'}
          </button>
        </form>
      )}
    </div>
  )
}
