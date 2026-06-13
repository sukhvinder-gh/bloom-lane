'use client'
import { useState, useEffect } from 'react'

// ── Confirmation modal ────────────────────────────────────────────────────────
type ConfirmScenario = 'new' | 'plan_change' | 'billing_change'

function ConfirmModal({ scenario, currentPlan, currentBilling, newPlan, newBilling, priceCents, onConfirm, onCancel }: {
  scenario: ConfirmScenario
  currentPlan: string
  currentBilling: string
  newPlan: string
  newBilling: string
  priceCents: number
  onConfirm: () => void
  onCancel: () => void
}) {
  const planLabel = (p: string) =>
    p === 'mailing_list' ? 'Florist Mailing List' : p === 'personal_shopper' ? 'Personal Shopper' : p
  const billingLabel = (b: string) =>
    b === 'weekly' ? 'weekly' : b === 'monthly' ? 'monthly' : b === 'annual' ? 'annual' : b

  const isAmber = scenario === 'plan_change' || scenario === 'billing_change'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'relative', background: 'var(--surface)', borderRadius: '16px', width: '100%', maxWidth: '27rem', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem 1.5rem 1rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>
            {scenario === 'new' ? '✅' : '🔄'}
          </div>

          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', color: isAmber ? '#92400E' : 'var(--forest)', fontWeight: 700, marginBottom: '0.5rem' }}>
            {scenario === 'new'          && 'Confirm Membership'}
            {scenario === 'plan_change'  && 'Switch Membership Plan?'}
            {scenario === 'billing_change' && 'Change Billing Period?'}
          </h2>

          {scenario === 'new' && (
            <>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-1)', marginBottom: '0.4rem' }}>You're signing up for</p>
              <p style={{ fontWeight: 700, color: 'var(--forest)', fontSize: '1rem', marginBottom: '0.25rem' }}>
                {planLabel(newPlan)}{newPlan === 'personal_shopper' ? ` — ${billingLabel(newBilling)}` : ''}
              </p>
              {newPlan === 'personal_shopper' && priceCents > 0 && (
                <p style={{ fontSize: '0.875rem', color: 'var(--moss)', marginBottom: '1rem' }}>
                  ${(priceCents / 100).toFixed(0)} / {newBilling === 'annual' ? 'year' : newBilling === 'weekly' ? 'week' : 'month'}
                </p>
              )}
              {newPlan === 'mailing_list' && (
                <p style={{ fontSize: '0.875rem', color: 'var(--moss)', marginBottom: '1rem' }}>Free, always</p>
              )}
            </>
          )}

          {scenario === 'plan_change' && (
            <>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-1)', marginBottom: '1rem', lineHeight: 1.55 }}>
                Switching from <strong>{planLabel(currentPlan)}</strong> to <strong>{planLabel(newPlan)}</strong>
                {newPlan === 'personal_shopper' ? ` (${billingLabel(newBilling)})` : ''}.
              </p>
              <div style={{ padding: '0.75rem 1rem', background: '#FEF3C7', borderRadius: '8px', fontSize: '0.8rem', color: '#92400E', lineHeight: 1.5, marginBottom: '1rem', textAlign: 'left' }}>
                ⚠ Your current {planLabel(currentPlan)} subscription will be replaced. This cannot be undone.
              </div>
            </>
          )}

          {scenario === 'billing_change' && (
            <>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-1)', marginBottom: '1rem', lineHeight: 1.55 }}>
                Changing Personal Shopper billing from <strong>{billingLabel(currentBilling)}</strong> to <strong>{billingLabel(newBilling)}</strong>.
                {priceCents > 0 && ` New amount: $${(priceCents / 100).toFixed(0)}/${newBilling === 'annual' ? 'yr' : newBilling === 'weekly' ? 'wk' : 'mo'}.`}
              </p>
              <div style={{ padding: '0.75rem 1rem', background: '#FEF3C7', borderRadius: '8px', fontSize: '0.8rem', color: '#92400E', lineHeight: 1.5, marginBottom: '1rem', textAlign: 'left' }}>
                ⚠ Your billing period will change from your next payment cycle.
              </div>
            </>
          )}
        </div>

        <div style={{ padding: '0 1.5rem 1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button onClick={onCancel} className="btn btn-ghost btn-sm" style={{ minWidth: '7rem' }}>Go Back</button>
          <button
            onClick={onConfirm}
            style={{
              minWidth: '9rem', padding: '0.55rem 1.5rem',
              background: isAmber ? '#92400E' : 'var(--forest)',
              color: 'white', border: 'none', borderRadius: '99px',
              fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer',
            }}
          >
            {scenario === 'new' ? 'Confirm & Continue' : scenario === 'plan_change' ? 'Yes, Switch Plan' : 'Yes, Change Billing'}
          </button>
        </div>
      </div>
    </div>
  )
}

const FLORIST_BILLING = [
  { value: 'weekly',  label: 'Weekly',  hint: 'Flexible, week by week' },
  { value: 'monthly', label: 'Monthly', hint: 'Save vs weekly' },
  { value: 'annual',  label: 'Annual',  hint: 'Best value overall' },
]

export default function FloristSubscriptionPage() {
  const [config, setConfig]   = useState<Record<string, number>>({})
  const [current, setCurrent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]       = useState(false)
  const [msg, setMsg]             = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [plan, setPlan]           = useState<'mailing_list' | 'personal_shopper'>('mailing_list')
  const [billing, setBilling]     = useState('monthly')
  const [cancelConfirm, setCancelConfirm]   = useState(false)
  const [cancelling, setCancelling]         = useState(false)
  const [pendingConfirm, setPendingConfirm] = useState(false)

  useEffect(() => {
    fetch('/api/buyer/subscription')
      .then(r => r.json())
      .then(d => {
        setConfig(d.config || {})
        if (d.subscription) {
          setCurrent(d.subscription)
          setPlan(d.subscription.plan)
          setBilling(d.subscription.billing_period || 'monthly')
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const priceMap: Record<string, number> = {
    weekly:  config['personal_shopper_weekly_cents']  || 0,
    monthly: config['personal_shopper_monthly_cents'] || 0,
    annual:  config['personal_shopper_annual_cents']  || 0,
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPendingConfirm(true)
  }

  async function executeSubmit() {
    setPendingConfirm(false)
    setSaving(true); setMsg(null)
    const res = await fetch('/api/buyer/subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, billing_period: plan === 'personal_shopper' ? billing : 'free' }),
    })
    const data = await res.json()
    if (!res.ok) {
      setMsg({ type: 'err', text: data.error || 'Something went wrong' })
    } else if (data.requiresPayment) {
      const price = priceMap[billing]
      setMsg({ type: 'ok', text: `Subscription saved. Payment of $${(price / 100).toFixed(2)} required to activate. Stripe checkout coming soon.` })
    } else {
      setMsg({ type: 'ok', text: "You're on the Mailing List! Expect your first availability email next Tuesday." })
      setCurrent(data.subscription)
    }
    setSaving(false)
  }

  async function executeCancel() {
    setCancelConfirm(false)
    setCancelling(true); setMsg(null)
    const res  = await fetch('/api/buyer/subscription', { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) {
      setMsg({ type: 'err', text: data.error || 'Failed to cancel membership' })
    } else {
      setCurrent(null)
      setMsg({ type: 'ok', text: 'Your membership has been cancelled.' })
    }
    setCancelling(false)
  }

  if (loading) return <div className="page-pad" style={{ padding: '2.5rem', color: 'var(--moss)', opacity: 0.5 }}>Loading…</div>

  const isActive = current?.status === 'active'

  return (
    <div className="page-pad" style={{ padding: '2.5rem', maxWidth: '52rem' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--forest)', marginBottom: '0.25rem' }}>
        Florist Membership
      </h1>
      <p style={{ fontSize: '0.875rem', color: 'var(--moss)', marginBottom: '2rem' }}>
        Choose how you want to source from local growers
      </p>

      {isActive && (
        <div style={{ padding: '1rem 1.25rem', background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: '0.875rem', marginBottom: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.25rem' }}>✅</span>
          <p style={{ flex: 1, fontWeight: 700, fontSize: '0.875rem', color: '#065F46' }}>
            Active — {current.plan === 'mailing_list' ? 'Florist Mailing List' : `Personal Shopper (${current.billing_period})`}
          </p>
          <button
            onClick={() => setCancelConfirm(true)}
            disabled={cancelling}
            style={{ padding: '0.35rem 0.875rem', background: 'none', border: '1.5px solid #B91C1C', borderRadius: '99px', color: '#B91C1C', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer', flexShrink: 0, fontFamily: 'var(--font-body)' }}
          >
            {cancelling ? 'Cancelling…' : 'Cancel Membership'}
          </button>
        </div>
      )}

      {/* Plan cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
        {[
          {
            value: 'mailing_list' as const,
            label: 'Florist Mailing List',
            badge: 'Option 1',
            price: 'Free, always',
            priceColor: '#065F46',
            features: ['Weekly availability email every Tuesday', 'Collect at Hub Thursday 9am–12pm', 'No minimum order, no commitment'],
            best: 'Florists who enjoy building direct relationships',
          },
          {
            value: 'personal_shopper' as const,
            label: 'Personal Shopper & Delivery',
            badge: 'Option 2',
            price: priceMap[billing] ? `$${(priceMap[billing] / 100).toFixed(0)}/${billing === 'weekly' ? 'wk' : billing === 'monthly' ? 'mo' : 'yr'}` : 'Price TBC',
            priceColor: '#1E40AF',
            features: ['Weekly brief & wishlist service', 'Refrigerated delivery Wed & Fri', 'Same-day collection and delivery', 'One consolidated invoice per delivery'],
            best: 'Busy florists and wedding specialists',
          },
        ].map(opt => {
          const active = plan === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPlan(opt.value)}
              style={{
                background: active ? 'var(--olive)' : 'white',
                border: `2px solid ${active ? 'var(--forest)' : 'var(--olive)'}`,
                borderRadius: '1rem', padding: '1.5rem', textAlign: 'left',
                cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.15s',
              }}
            >
              <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '99px', fontSize: '0.7rem', fontWeight: 700, background: active ? 'var(--forest)' : 'var(--cream)', color: active ? 'var(--cream)' : 'var(--moss)', marginBottom: '0.625rem' }}>
                {opt.badge}
              </span>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--forest)', marginBottom: '0.25rem' }}>{opt.label}</p>
              <p style={{ fontSize: '0.8rem', color: opt.priceColor, fontWeight: 700, marginBottom: '0.875rem' }}>{opt.price}</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 0.875rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {opt.features.map(f => (
                  <li key={f} style={{ fontSize: '0.775rem', color: 'var(--forest)', display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                    <span style={{ color: opt.priceColor, flexShrink: 0 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <p style={{ fontSize: '0.7rem', color: 'var(--moss)', borderTop: '1px solid var(--sage)', paddingTop: '0.625rem' }}>
                <strong>Best for</strong> {opt.best}
              </p>
            </button>
          )
        })}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Billing period (personal_shopper only) */}
        {plan === 'personal_shopper' && (
          <div className="card" style={{ padding: '1.5rem' }}>
            <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--forest)', marginBottom: '1rem' }}>Billing Period</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
              {FLORIST_BILLING.map(b => {
                const price = priceMap[b.value]
                return (
                  <button
                    key={b.value}
                    type="button"
                    onClick={() => setBilling(b.value)}
                    style={{
                      background: billing === b.value ? 'var(--forest)' : 'white',
                      border: `1.5px solid ${billing === b.value ? 'var(--forest)' : 'var(--olive)'}`,
                      borderRadius: '0.75rem', padding: '1rem 0.75rem', textAlign: 'center',
                      cursor: 'pointer', fontFamily: 'var(--font-body)', transition: 'all 0.15s',
                    }}
                  >
                    <p style={{ fontSize: '0.775rem', fontWeight: 700, color: billing === b.value ? 'var(--cream)' : 'var(--forest)', marginBottom: '0.2rem' }}>{b.label}</p>
                    {price ? (
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: billing === b.value ? 'var(--cream)' : 'var(--forest)', letterSpacing: '-0.03em' }}>${(price / 100).toFixed(0)}</span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: billing === b.value ? 'rgba(255,255,255,0.6)' : 'var(--moss)' }}>TBC</span>
                    )}
                    <p style={{ fontSize: '0.65rem', color: billing === b.value ? 'rgba(255,255,255,0.6)' : 'var(--moss)', marginTop: '0.2rem' }}>{b.hint}</p>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {msg && (
          <div style={{ padding: '0.875rem 1rem', borderRadius: '0.75rem', background: msg.type === 'ok' ? '#D1FAE5' : '#FEE2E2', color: msg.type === 'ok' ? '#065F46' : '#B91C1C', fontSize: '0.85rem', fontWeight: 600 }}>
            {msg.type === 'ok' ? '✓' : '⚠'} {msg.text}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="btn btn-forest"
          style={{ padding: '0.875rem', fontSize: '1rem', borderRadius: '0.875rem' }}
        >
          {saving ? 'Saving…' : plan === 'mailing_list' ? 'Join Mailing List — Free' : `Continue to Payment — $${((priceMap[billing] || 0) / 100).toFixed(0)}`}
        </button>
      </form>

      {pendingConfirm && (() => {
        const isChangingPlan    = isActive && current?.plan !== plan
        const isChangingBilling = isActive && current?.plan === 'personal_shopper' && plan === 'personal_shopper' && current?.billing_period !== billing
        const scenario: ConfirmScenario = isChangingPlan ? 'plan_change' : isChangingBilling ? 'billing_change' : 'new'
        return (
          <ConfirmModal
            scenario={scenario}
            currentPlan={current?.plan ?? ''}
            currentBilling={current?.billing_period ?? ''}
            newPlan={plan}
            newBilling={billing}
            priceCents={plan === 'personal_shopper' ? (priceMap[billing] || 0) : 0}
            onConfirm={executeSubmit}
            onCancel={() => setPendingConfirm(false)}
          />
        )
      })()}

      {cancelConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={() => setCancelConfirm(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }} />
          <div style={{ position: 'relative', background: 'var(--surface)', borderRadius: '16px', width: '100%', maxWidth: '26rem', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
            <div style={{ padding: '1.75rem 1.5rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⛔</div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', color: '#B91C1C', fontWeight: 700, marginBottom: '0.5rem' }}>Cancel Membership?</h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-1)', marginBottom: '1rem', lineHeight: 1.55 }}>
                You're about to cancel your <strong>{current?.plan === 'mailing_list' ? 'Florist Mailing List' : 'Personal Shopper'}</strong> membership.
                You'll stop receiving weekly availability emails and lose access to delivery services.
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--moss)' }}>You can rejoin at any time from this page.</p>
            </div>
            <div style={{ padding: '0 1.5rem 1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button onClick={() => setCancelConfirm(false)} className="btn btn-ghost btn-sm" style={{ minWidth: '7rem' }}>Go Back</button>
              <button
                onClick={executeCancel}
                style={{ minWidth: '9rem', padding: '0.55rem 1.5rem', background: '#B91C1C', color: 'white', border: 'none', borderRadius: '99px', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}
              >
                Yes, Cancel It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
