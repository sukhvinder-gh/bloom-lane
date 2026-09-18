'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Elements } from '@stripe/react-stripe-js'
import { getStripe } from '@/lib/stripe/client'
import { STRIPE_APPEARANCE } from '@/lib/stripe/appearance'
import StripePaymentForm from '@/components/StripePaymentForm'

// Display label only — the underlying plan value ('wholesale_collection')
// is unchanged in the database/subscriptions.plan enum. This tier is a
// no-fee grower/seller listing, not related to buyer wholesale pricing —
// the old label overloaded "wholesale" to mean two different things.
const FREE_TIER_LABEL = 'Free Grower Listing'

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
    p === 'hub_membership' ? 'Hub Membership' : p === 'wholesale_collection' ? FREE_TIER_LABEL : p
  const billingLabel = (b: string) =>
    b === 'monthly' ? 'Monthly' : b === 'seasonal' ? 'Seasonal (3 mo)' : b === 'annual' ? 'Annual' : b

  const isAmber = scenario === 'plan_change' || scenario === 'billing_change'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div onClick={onCancel} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'relative', background: 'var(--surface)', borderRadius: '16px', width: '100%', maxWidth: '26rem', boxShadow: '0 8px 40px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>
            {scenario === 'new' ? '✅' : '🔄'}
          </div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', color: isAmber ? '#92400E' : 'var(--forest)', fontWeight: 700, marginBottom: '0.5rem' }}>
            {scenario === 'new'            && 'Confirm Membership'}
            {scenario === 'plan_change'    && 'Switch Membership Plan?'}
            {scenario === 'billing_change' && 'Change Billing Period?'}
          </h2>

          {scenario === 'new' && (
            <>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-1)', marginBottom: '0.5rem' }}>
                You're signing up for
              </p>
              <p style={{ fontWeight: 700, color: 'var(--forest)', fontSize: '1rem', marginBottom: '0.25rem' }}>
                {planLabel(newPlan)}
                {newPlan === 'hub_membership' && ` — ${billingLabel(newBilling)}`}
              </p>
              {newPlan === 'hub_membership' && priceCents > 0 && (
                <p style={{ fontSize: '0.875rem', color: 'var(--moss)', marginBottom: '1rem' }}>
                  ${(priceCents / 100).toFixed(0)} / {newBilling === 'seasonal' ? 'season' : newBilling === 'annual' ? 'year' : 'month'}
                </p>
              )}
              {newPlan === 'wholesale_collection' && (
                <p style={{ fontSize: '0.875rem', color: 'var(--moss)', marginBottom: '1rem' }}>No membership fee</p>
              )}
            </>
          )}

          {scenario === 'plan_change' && (
            <>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-1)', marginBottom: '1rem', lineHeight: 1.55 }}>
                Switching from <strong>{planLabel(currentPlan)}</strong> to <strong>{planLabel(newPlan)}</strong>
                {newPlan === 'hub_membership' ? ` (${billingLabel(newBilling)})` : ''}.
              </p>
              <div style={{ padding: '0.75rem 1rem', background: '#FEF3C7', borderRadius: '8px', fontSize: '0.8rem', color: '#92400E', lineHeight: 1.5, marginBottom: '1.25rem', textAlign: 'left' }}>
                ⚠ Your current {planLabel(currentPlan)} subscription will be replaced. This cannot be undone.
              </div>
            </>
          )}

          {scenario === 'billing_change' && (
            <>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-1)', marginBottom: '1rem', lineHeight: 1.55 }}>
                Changing Hub Membership billing from <strong>{billingLabel(currentBilling)}</strong> to <strong>{billingLabel(newBilling)}</strong>.
                {priceCents > 0 && ` New amount: $${(priceCents / 100).toFixed(0)}/${newBilling === 'annual' ? 'yr' : newBilling === 'seasonal' ? 'season' : 'mo'}.`}
              </p>
              <div style={{ padding: '0.75rem 1rem', background: '#FEF3C7', borderRadius: '8px', fontSize: '0.8rem', color: '#92400E', lineHeight: 1.5, marginBottom: '1.25rem', textAlign: 'left' }}>
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

// ── Pending Hub Membership payment ────────────────────────────────────────────
// Shown whenever there's a pending Hub Membership subscription, regardless
// of whether that pending state was just created by the form below or the
// farmer is returning later to finish paying — those are the same UI, just
// a different source for the client_secret (the submit response vs. the
// /pay resume endpoint).
function PendingPaymentCard({ amountCents, clientSecret, onResume, resuming, onSuccess }: {
  amountCents: number
  clientSecret: string | null
  onResume: () => void
  resuming: boolean
  onSuccess: () => void
}) {
  if (!clientSecret) {
    return (
      <div className="card-forest" style={{ padding: '1.75rem', marginBottom: '1.75rem' }}>
        <p style={{ color: 'var(--cream)', fontWeight: 700, marginBottom: '0.375rem' }}>Payment required to activate</p>
        <p style={{ color: 'var(--sage)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          Your Hub Membership details are saved — pay ${(amountCents / 100).toFixed(2)} to activate it.
        </p>
        <button onClick={onResume} disabled={resuming} className="btn btn-cream" style={{ width: '100%' }}>
          {resuming ? 'Loading payment form…' : `Pay $${(amountCents / 100).toFixed(2)} now`}
        </button>
      </div>
    )
  }

  return (
    <div className="card-forest" style={{ padding: '1.75rem', marginBottom: '1.75rem' }}>
      <p style={{ color: 'var(--cream)', fontWeight: 700, marginBottom: '1.25rem' }}>Pay ${(amountCents / 100).toFixed(2)} to activate Hub Membership</p>
      <Elements stripe={getStripe()} options={{ clientSecret, appearance: STRIPE_APPEARANCE }}>
        <StripePaymentForm
          amountLabel={`Pay $${(amountCents / 100).toFixed(2)}`}
          returnUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/dashboard/farmer/membership`}
          onSuccess={onSuccess}
        />
      </Elements>
    </div>
  )
}

// ── Current subscription row ──────────────────────────────────────────────────
function CurrentSubscriptionRow({ sub, onCancel, onChangePlan }: { sub: any; onCancel: () => void; onChangePlan: () => void }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos]   = useState({ top: 0, right: 0 })
  const btnRef          = useRef<HTMLButtonElement>(null)

  function toggle() {
    if (!open) {
      const r = btnRef.current?.getBoundingClientRect()
      if (r) setPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
    }
    setOpen(v => !v)
  }

  const planName = sub.plan === 'hub_membership'
    ? `Hub Membership — ${sub.billing_period === 'seasonal' ? 'Seasonal' : sub.billing_period === 'annual' ? 'Annual' : 'Monthly'}`
    : FREE_TIER_LABEL

  const isPending   = sub.status === 'pending'
  const statusBg    = isPending ? '#FEF3C7' : '#D1FAE5'
  const statusColor = isPending ? '#92400E' : '#065F46'
  const borderColor = isPending ? '#FDE68A' : '#6EE7B7'

  return (
    <>
      <div style={{
        padding: '0.875rem 1.25rem',
        background: statusBg,
        border: `1px solid ${borderColor}`,
        borderRadius: '0.875rem',
        marginBottom: '1.75rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.875rem',
      }}>
        <span style={{ fontSize: '1.125rem' }}>{isPending ? '⏳' : '✅'}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: '0.875rem', color: statusColor }}>{planName}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-block', padding: '1px 8px',
              background: isPending ? '#FDE68A' : '#A7F3D0',
              color: statusColor, borderRadius: '99px',
              fontSize: '0.7rem', fontWeight: 700,
            }}>
              {isPending ? 'PENDING PAYMENT' : 'ACTIVE'}
            </span>
            {sub.expires_at && (
              <span style={{ fontSize: '0.75rem', color: statusColor, opacity: 0.75 }}>
                Renews {new Date(sub.expires_at).toLocaleDateString('en-AU')}
              </span>
            )}
            {sub.amount_cents > 0 && sub.billing_period && sub.billing_period !== 'free' && (
              <span style={{ fontSize: '0.75rem', color: statusColor, opacity: 0.75 }}>
                ${(sub.amount_cents / 100).toFixed(0)}/{sub.billing_period === 'annual' ? 'yr' : sub.billing_period === 'seasonal' ? 'season' : 'mo'}
              </span>
            )}
          </div>
        </div>
        <button
          ref={btnRef}
          onClick={toggle}
          style={{
            width: '2rem', height: '2rem', borderRadius: '99px',
            border: `1px solid ${borderColor}`,
            background: 'transparent',
            color: statusColor,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.1rem', fontWeight: 700, flexShrink: 0,
            fontFamily: 'var(--font-body)',
          }}
          aria-label="Subscription actions"
        >
          ⋯
        </button>
      </div>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1998 }} />
          <div style={{
            position: 'fixed',
            top: pos.top,
            right: pos.right,
            zIndex: 1999,
            background: 'var(--surface)',
            border: '1px solid var(--olive)',
            borderRadius: '0.75rem',
            boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
            minWidth: '12rem',
            overflow: 'hidden',
          }}>
            <button
              onClick={() => { setOpen(false); onChangePlan() }}
              style={{ width: '100%', padding: '0.7rem 1rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--forest)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-body)' }}
            >
              ✏️ Change Plan
            </button>
            <div style={{ height: '1px', background: 'var(--olive)' }} />
            <button
              onClick={() => { setOpen(false); onCancel() }}
              style={{ width: '100%', padding: '0.7rem 1rem', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', color: '#B91C1C', display: 'flex', alignItems: 'center', gap: '0.5rem', fontFamily: 'var(--font-body)' }}
            >
              ✕ Cancel Membership
            </button>
          </div>
        </>
      )}
    </>
  )
}

const BILLING_OPTIONS = [
  { value: 'monthly',  label: 'Monthly',         hint: 'Month to month, cancel any time' },
  { value: 'seasonal', label: 'Seasonal (3 mo)',  hint: 'Best value per season' },
  { value: 'annual',   label: 'Annual',           hint: 'Best value overall' },
]

function PriceTag({ cents, selected }: { cents: number; selected?: boolean }) {
  const color = selected ? 'white' : 'var(--forest)'
  if (!cents) return <span style={{ color: selected ? 'rgba(255,255,255,0.6)' : 'var(--moss)', fontSize: '0.8rem' }}>Price TBC</span>
  const dollars = (cents / 100).toFixed(0)
  return <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color, letterSpacing: '-0.03em' }}>${dollars}</span>
}

// ── Membership details (read-only summary shown once a plan is active) ────────
function MembershipDetailsCard({ plan, billing, priceMap, businessName, abn, farmAddress, farmRegion, gstRegistered, hubName, onChangePlan }: {
  plan: 'hub_membership' | 'wholesale_collection'
  billing: string
  priceMap: Record<string, number>
  businessName: string; abn: string; farmAddress: string; farmRegion: string
  gstRegistered: boolean; hubName: string
  onChangePlan: () => void
}) {
  const planLabel = plan === 'hub_membership' ? 'Hub Membership' : FREE_TIER_LABEL
  const billingLabel = billing === 'annual' ? 'Annual' : billing === 'seasonal' ? 'Seasonal' : 'Monthly'
  const price = plan === 'hub_membership'
    ? `$${((priceMap[billing] || 0) / 100).toFixed(0)}/${billing === 'annual' ? 'yr' : billing === 'seasonal' ? 'season' : 'mo'}`
    : 'No membership fee'

  const fields = [
    { label: 'Business Name', value: businessName },
    { label: 'ABN', value: abn },
    { label: 'Farm Address', value: farmAddress },
    { label: 'Region', value: farmRegion },
    ...(plan === 'hub_membership' ? [{ label: 'Hub / Collective', value: hubName }] : []),
    { label: 'GST Registered', value: gstRegistered ? 'Yes' : 'No' },
  ]

  return (
    <div className="card" style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--moss)', marginBottom: '0.375rem' }}>Current Plan</p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--forest)' }}>
            {planLabel}{plan === 'hub_membership' ? ` — ${billingLabel}` : ''}
          </p>
          <p style={{ fontSize: '0.9rem', color: plan === 'hub_membership' ? '#92400E' : '#065F46', fontWeight: 700, marginTop: '0.25rem' }}>{price}</p>
        </div>
        <button onClick={onChangePlan} className="btn btn-forest btn-sm" style={{ flexShrink: 0 }}>✏️ Change Plan</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', paddingTop: '1.5rem', borderTop: '1px solid var(--olive)' }}>
        {fields.map(f => (
          <div key={f.label}>
            <p style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--moss)', marginBottom: '0.25rem' }}>{f.label}</p>
            <p style={{ fontSize: '0.9rem', color: 'var(--forest)' }}>{f.value || '—'}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function GrowerSubscriptionPage() {
  const router = useRouter()
  const [hubs, setHubs]         = useState<any[]>([])
  const [config, setConfig]     = useState<Record<string, number>>({})
  const [current, setCurrent]   = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]       = useState(false)
  const [msg, setMsg]             = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [pendingConfirm, setPendingConfirm] = useState(false)
  const [cancelConfirm, setCancelConfirm]   = useState(false)
  const [cancelling, setCancelling]         = useState(false)
  const [hasFarmerProfile, setHasFarmerProfile] = useState(true)
  const [payClientSecret, setPayClientSecret] = useState<string | null>(null)
  const [resumingPay, setResumingPay]         = useState(false)
  // Once a membership is set up, this page should open on a read-only
  // summary, not the plan picker — "edit" only ever shows again via the
  // explicit "Change Plan" action.
  const [viewMode, setViewMode] = useState<'details' | 'edit'>('edit')

  // Form state
  const [plan, setPlan]               = useState<'hub_membership' | 'wholesale_collection'>('hub_membership')
  const [billing, setBilling]         = useState('monthly')
  const [hubId, setHubId]             = useState('')
  const [abn, setAbn]                 = useState('')
  const [businessName, setBusinessName] = useState('')
  const [gstRegistered, setGstRegistered] = useState(false)
  const [rctiAgreed, setRctiAgreed]   = useState(false)
  const [rctiFullName, setRctiFullName] = useState('')
  const [farmAddress, setFarmAddress] = useState('')
  const [farmRegion, setFarmRegion]   = useState('')

  useEffect(() => {
    const safe = (p: Promise<any>) => p.catch(() => ({}))
    Promise.all([
      safe(fetch('/api/hubs').then(r => r.json())),
      safe(fetch('/api/admin/config').then(r => r.json())),
      safe(fetch('/api/farmer/subscription').then(r => r.json())),
    ]).then(([hubsData, cfgData, subData]) => {
      setHubs(hubsData?.data || [])
      const cfgMap: Record<string, number> = {}
      ;(cfgData?.data || []).forEach((r: any) => { cfgMap[r.key] = parseInt(r.value) || 0 })
      setConfig(cfgMap)
      setHasFarmerProfile(!!subData?.farmer)
      if (subData?.farmer) {
        const f = subData.farmer
        setCurrent(subData.subscription)
        setPlan(f.subscription_type || 'hub_membership')
        setBilling(f.subscription_tier || 'monthly')
        setHubId(f.hub_id || '')
        setAbn(f.abn || '')
        setBusinessName(f.business_name || '')
        setGstRegistered(!!f.gst_registered)
        setRctiAgreed(!!f.rcti_agreed)
        setRctiFullName(f.rcti_full_name || '')
        setFarmAddress(f.farm_address || '')
        setFarmRegion(f.farm_region || '')
        const subActive = subData.subscription?.status === 'active' || subData.subscription?.status === 'pending'
        setViewMode(subActive ? 'details' : 'edit')
      }
    }).finally(() => setLoading(false))
  }, [])

  const priceMap: Record<string, number> = {
    monthly:  config['hub_membership_monthly_cents']  || 6000,
    seasonal: config['hub_membership_seasonal_cents'] || 15000,
    annual:   config['hub_membership_annual_cents']   || 48000,
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (plan === 'hub_membership' && !hubId) { setMsg({ type: 'err', text: 'Please select your Hub / Collective' }); return }
    if (gstRegistered && !rctiAgreed) { setMsg({ type: 'err', text: 'Please agree to the RCTI terms to continue' }); return }
    if (gstRegistered && !rctiFullName.trim()) { setMsg({ type: 'err', text: 'Please enter your full name to sign the RCTI agreement' }); return }
    setPendingConfirm(true)
  }

  async function executeSubmit() {
    setPendingConfirm(false)
    setSaving(true); setMsg(null)
    const res = await fetch('/api/farmer/subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription_type: plan,
        billing_period: plan === 'hub_membership' ? billing : null,
        hub_id: hubId,
        abn,
        business_name: businessName,
        gst_registered: gstRegistered,
        rcti_agreed: rctiAgreed,
        rcti_full_name: rctiFullName,
        farm_address: farmAddress,
        farm_region: farmRegion,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setMsg({ type: 'err', text: data.error || 'Something went wrong' })
      setSaving(false)
      return
    }
    if (data.subscription) setCurrent(data.subscription)
    if (data.requiresPayment) {
      setViewMode('details')
      if (data.client_secret) {
        setPayClientSecret(data.client_secret)
        setMsg(null)
      } else {
        setMsg({ type: 'err', text: 'Subscription saved, but payment setup failed. Use the "Pay now" button below to try again.' })
      }
    } else {
      setMsg({ type: 'ok', text: `${FREE_TIER_LABEL} registration complete! Your listings are now active.` })
      setTimeout(() => router.push('/dashboard/farmer'), 2000)
    }
    setSaving(false)
  }

  async function resumePayment() {
    setResumingPay(true); setMsg(null)
    const res = await fetch('/api/farmer/subscription/pay', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) {
      setMsg({ type: 'err', text: data.error || 'Could not start payment. Please try again.' })
      setResumingPay(false)
      return
    }
    setPayClientSecret(data.client_secret)
    setResumingPay(false)
  }

  async function handlePaymentSuccess() {
    setPayClientSecret(null)
    setMsg({ type: 'ok', text: 'Payment received! Your Hub Membership is now active.' })
    const res = await fetch('/api/farmer/subscription')
    const data = await res.json().catch(() => null)
    if (data?.subscription) setCurrent(data.subscription)
  }

  async function executeCancel() {
    setCancelConfirm(false)
    setCancelling(true); setMsg(null)
    const res  = await fetch('/api/farmer/subscription', { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) {
      setMsg({ type: 'err', text: data.error || 'Failed to cancel membership' })
    } else {
      setCurrent(null)
      setPayClientSecret(null)
      setMsg({ type: 'ok', text: 'Your membership has been cancelled.' })
    }
    setCancelling(false)
  }

  if (loading) return (
    <div className="page-pad" style={{ padding: '2.5rem', color: 'var(--moss)', opacity: 0.5 }}>Loading…</div>
  )

  // Membership details (business name, ABN, farm address) live on the
  // farmers row, which doesn't exist until the storefront profile is
  // created — saving here first would silently update zero rows.
  if (!hasFarmerProfile) return (
    <div className="page-pad" style={{ padding: '2.5rem', maxWidth: '52rem' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--forest)', marginBottom: '0.25rem' }}>
        Grower Membership
      </h1>
      <div className="card" style={{ padding: '2.5rem', textAlign: 'center', marginTop: '1.5rem' }}>
        <p style={{ fontSize: '2rem', marginBottom: '1rem' }}>🌱</p>
        <h2 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--forest)', marginBottom: '0.5rem' }}>Set up your farm profile first</h2>
        <p style={{ color: 'var(--moss)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
          Your business name, ABN, and address are collected there — membership picks up from that.
        </p>
        <Link href="/dashboard/farmer/storefront" className="btn btn-forest">Set Up Farm Profile →</Link>
      </div>
    </div>
  )

  const hasExistingSub = current?.status === 'active' || current?.status === 'pending'

  return (
    <div className="page-pad" style={{ padding: '2.5rem', maxWidth: '52rem' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--forest)', marginBottom: '0.25rem' }}>
        Grower Membership
      </h1>
      <p style={{ fontSize: '0.875rem', color: 'var(--moss)', marginBottom: '2rem' }}>
        Choose how you participate in The Green Guild
      </p>

      {hasExistingSub && (
        <CurrentSubscriptionRow sub={current} onCancel={() => setCancelConfirm(true)} onChangePlan={() => setViewMode('edit')} />
      )}

      {current?.status === 'pending' && current?.plan === 'hub_membership' && (
        <PendingPaymentCard
          amountCents={current.amount_cents || 0}
          clientSecret={payClientSecret}
          onResume={resumePayment}
          resuming={resumingPay}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {hasExistingSub && viewMode === 'details' ? (
        <MembershipDetailsCard
          plan={plan} billing={billing} priceMap={priceMap}
          businessName={businessName} abn={abn} farmAddress={farmAddress} farmRegion={farmRegion}
          gstRegistered={gstRegistered} hubName={hubs.find((h: any) => h.id === hubId)?.name || ''}
          onChangePlan={() => setViewMode('edit')}
        />
      ) : (
      <>
      {/* Plan selector */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
        {[
          {
            value: 'hub_membership' as const,
            label: 'Hub Membership',
            badge: 'Option 1',
            badgeColor: '#92400E',
            badgeBg: '#FEF3C7',
            price: `$${(priceMap[billing] / 100).toFixed(0)}/mo`,
            features: ['Attend Hub Thursdays', 'Sell at your own prices', 'Featured in weekly comms', 'No minimum quantity'],
            best: 'Growers who enjoy direct selling',
          },
          {
            value: 'wholesale_collection' as const,
            label: FREE_TIER_LABEL,
            badge: 'Option 2',
            badgeColor: '#065F46',
            badgeBg: '#D1FAE5',
            price: 'No membership fee',
            features: ['Collection from farm Wed or Fri', 'Paid in full on collection', 'Farm credited in all promotion', 'No attendance required'],
            best: 'Growers who prefer to focus on growing',
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
                cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'var(--font-body)',
              }}
            >
              <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '99px', fontSize: '0.7rem', fontWeight: 700, background: opt.badgeBg, color: opt.badgeColor, marginBottom: '0.625rem' }}>
                {opt.badge}
              </span>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--forest)', marginBottom: '0.25rem' }}>{opt.label}</p>
              <p style={{ fontSize: '0.8rem', color: opt.value === 'hub_membership' ? '#92400E' : '#065F46', fontWeight: 700, marginBottom: '0.875rem' }}>{opt.price}</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 0.875rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {opt.features.map(f => (
                  <li key={f} style={{ fontSize: '0.775rem', color: 'var(--forest)', display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
                    <span style={{ color: opt.value === 'hub_membership' ? '#92400E' : '#065F46', flexShrink: 0 }}>✓</span>{f}
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

      <form id="grower-membership-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Billing period (hub_membership only) */}
        {plan === 'hub_membership' && (
          <div className="card" style={{ padding: '1.5rem' }}>
            <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--forest)', marginBottom: '1rem' }}>Billing Period</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
              {BILLING_OPTIONS.map(b => {
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
                    <p style={{ fontSize: '0.775rem', fontWeight: 700, color: billing === b.value ? 'var(--cream)' : 'var(--forest)', marginBottom: '0.25rem' }}>{b.label}</p>
                    <PriceTag cents={price} selected={billing === b.value} />
                    <p style={{ fontSize: '0.65rem', color: billing === b.value ? 'rgba(255,255,255,0.7)' : 'var(--moss)', marginTop: '0.2rem' }}>{b.hint}</p>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Business details */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--forest)', marginBottom: '1rem' }}>Business Details</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
            <div>
              <label className="type-label-sm" style={{ display: 'block', color: 'var(--moss)', marginBottom: '0.3rem' }}>Business Name</label>
              <input className="input" value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="Your farm or business name" style={{ width: '100%' }} />
            </div>
            <div>
              <label className="type-label-sm" style={{ display: 'block', color: 'var(--moss)', marginBottom: '0.3rem' }}>ABN *</label>
              <input className="input" value={abn} onChange={e => setAbn(e.target.value)} placeholder="XX XXX XXX XXX" required style={{ width: '100%' }} />
            </div>
            <div>
              <label className="type-label-sm" style={{ display: 'block', color: 'var(--moss)', marginBottom: '0.3rem' }}>Farm Address</label>
              <input className="input" value={farmAddress} onChange={e => setFarmAddress(e.target.value)} placeholder="Street address" style={{ width: '100%' }} />
            </div>
            <div>
              <label className="type-label-sm" style={{ display: 'block', color: 'var(--moss)', marginBottom: '0.3rem' }}>Region</label>
              <input className="input" value={farmRegion} onChange={e => setFarmRegion(e.target.value)} placeholder="e.g. Yarra Valley" style={{ width: '100%' }} />
            </div>
          </div>
        </div>

        {/* Hub selection — only required for Hub Membership */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--forest)', marginBottom: '0.25rem' }}>
            Hub / Collective {plan === 'hub_membership' ? '*' : <span style={{ fontWeight: 400, color: 'var(--moss)' }}>(optional)</span>}
          </p>
          <p style={{ fontSize: '0.775rem', color: 'var(--moss)', marginBottom: '0.875rem' }}>Select the hub or collective you belong to</p>
          {hubs.length === 0 ? (
            <div style={{ padding: '1rem', background: '#FEF3C7', borderRadius: '0.75rem', fontSize: '0.8rem', color: '#92400E' }}>
              No hubs or collectives registered yet. Please contact your coordinator or The Green Guild admin.
            </div>
          ) : (
            <select
              className="input"
              value={hubId}
              onChange={e => setHubId(e.target.value)}
              required={plan === 'hub_membership'}
              style={{ width: '100%' }}
            >
              <option value="">— Select your hub / collective —</option>
              {hubs.map((h: any) => (
                <option key={h.id} value={h.id}>{h.name}{h.region ? ` (${h.region})` : ''}</option>
              ))}
            </select>
          )}
          <p style={{ fontSize: '0.7rem', color: 'var(--moss)', marginTop: '0.5rem' }}>
            If your hub or collective is not listed, it may not be registered yet. Contact your coordinator.
          </p>
        </div>

        {/* GST + RCTI */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--forest)', marginBottom: '1rem' }}>GST & Invoicing</p>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', marginBottom: '1rem' }}>
            <input
              type="checkbox"
              checked={gstRegistered}
              onChange={e => { setGstRegistered(e.target.checked); if (!e.target.checked) { setRctiAgreed(false); setRctiFullName('') } }}
              style={{ width: '1.1rem', height: '1.1rem', accentColor: 'var(--forest)' }}
            />
            <span style={{ fontSize: '0.875rem', color: 'var(--forest)' }}>I am registered for GST</span>
          </label>

          {gstRegistered && (
            <div style={{ padding: '1.25rem', background: 'var(--olive)', borderRadius: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--forest)', marginBottom: '0.5rem' }}>RCTI Agreement</p>
                <p style={{ fontSize: '0.775rem', color: 'var(--moss)', lineHeight: 1.6, marginBottom: '0.875rem' }}>
                  I authorise The Green Guild to issue Recipient Created Tax Invoices (RCTIs) on my behalf for all sales made
                  through the platform. I confirm I am registered for GST and will notify The Green Guild immediately if my
                  GST registration status changes. This agreement remains in effect for the duration of my subscription.
                </p>
                <input
                  className="input"
                  placeholder="Your full legal name"
                  value={rctiFullName}
                  onChange={e => setRctiFullName(e.target.value)}
                  style={{ width: '100%', marginBottom: '0.75rem' }}
                />
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={rctiAgreed}
                    onChange={e => setRctiAgreed(e.target.checked)}
                    style={{ width: '1.1rem', height: '1.1rem', accentColor: 'var(--forest)', flexShrink: 0, marginTop: '0.1rem' }}
                  />
                  <span style={{ fontSize: '0.775rem', color: 'var(--forest)', lineHeight: 1.5 }}>
                    I agree to the RCTI arrangement and authorise The Green Guild to raise invoices on my behalf
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>

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
          {saving ? 'Saving…' : plan === 'wholesale_collection' ? `Register for ${FREE_TIER_LABEL}` : `Continue to Payment — $${((priceMap[billing] || 0) / 100).toFixed(0)}`}
        </button>
      </form>

      {hasExistingSub && (
        <button type="button" onClick={() => setViewMode('details')} className="btn btn-ghost btn-sm" style={{ marginTop: '1rem' }}>
          ← Back to membership details
        </button>
      )}
      </>
      )}

      {pendingConfirm && (() => {
        const isChangingPlan    = hasExistingSub && current?.plan !== plan
        const isChangingBilling = hasExistingSub && current?.plan === 'hub_membership' && plan === 'hub_membership' && current?.billing_period !== billing
        const scenario: ConfirmScenario = isChangingPlan ? 'plan_change' : isChangingBilling ? 'billing_change' : 'new'
        return (
          <ConfirmModal
            scenario={scenario}
            currentPlan={current?.plan ?? ''}
            currentBilling={current?.billing_period ?? ''}
            newPlan={plan}
            newBilling={billing}
            priceCents={plan === 'hub_membership' ? (priceMap[billing] || 0) : 0}
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
                You're about to cancel your <strong>{current?.plan === 'hub_membership' ? 'Hub Membership' : FREE_TIER_LABEL}</strong>.
                Your listings may be hidden when the membership ends.
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--moss)' }}>This cannot be undone from this screen. Contact admin to reactivate.</p>
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
