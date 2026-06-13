'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

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

export default function GrowerSubscriptionPage() {
  const router = useRouter()
  const [hubs, setHubs]         = useState<any[]>([])
  const [config, setConfig]     = useState<Record<string, number>>({})
  const [current, setCurrent]   = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

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
      }
    }).finally(() => setLoading(false))
  }, [])

  const priceMap: Record<string, number> = {
    monthly:  config['hub_membership_monthly_cents']  || 6000,
    seasonal: config['hub_membership_seasonal_cents'] || 15000,
    annual:   config['hub_membership_annual_cents']   || 48000,
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (plan === 'hub_membership' && !hubId) { setMsg({ type: 'err', text: 'Please select your Hub / Growing Group' }); return }
    if (gstRegistered && !rctiAgreed) { setMsg({ type: 'err', text: 'Please agree to the RCTI terms to continue' }); return }
    if (gstRegistered && !rctiFullName.trim()) { setMsg({ type: 'err', text: 'Please enter your full name to sign the RCTI agreement' }); return }

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
    if (data.requiresPayment) {
      // TODO: redirect to Stripe checkout
      setMsg({ type: 'ok', text: `Subscription saved. Payment of $${((data.amount_cents || 0) / 100).toFixed(2)} required to activate. Stripe checkout coming soon.` })
    } else {
      setMsg({ type: 'ok', text: 'Wholesale Collection registration complete! Your listings are now active.' })
      setTimeout(() => router.push('/dashboard/farmer'), 2000)
    }
    setSaving(false)
  }

  if (loading) return (
    <div className="page-pad" style={{ padding: '2.5rem', color: 'var(--moss)', opacity: 0.5 }}>Loading…</div>
  )

  const isActive = current?.status === 'active'

  return (
    <div className="page-pad" style={{ padding: '2.5rem', maxWidth: '52rem' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--forest)', marginBottom: '0.25rem' }}>
        Grower Membership
      </h1>
      <p style={{ fontSize: '0.875rem', color: 'var(--moss)', marginBottom: '2rem' }}>
        Choose how you participate in The Green Guild
      </p>

      {isActive && (
        <div style={{ padding: '1rem 1.25rem', background: '#D1FAE5', border: '1px solid #6EE7B7', borderRadius: '0.875rem', marginBottom: '1.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.25rem' }}>✅</span>
          <div>
            <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#065F46' }}>
              Active — {current.plan === 'hub_membership' ? `Hub Membership (${current.billing_period})` : 'Wholesale Collection'}
            </p>
            {current.expires_at && (
              <p style={{ fontSize: '0.8rem', color: '#065F46', opacity: 0.7 }}>
                Renews {new Date(current.expires_at).toLocaleDateString('en-AU')}
              </p>
            )}
          </div>
        </div>
      )}

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
            label: 'Wholesale Collection',
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

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

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
            Hub / Growing Group {plan === 'hub_membership' ? '*' : <span style={{ fontWeight: 400, color: 'var(--moss)' }}>(optional)</span>}
          </p>
          <p style={{ fontSize: '0.775rem', color: 'var(--moss)', marginBottom: '0.875rem' }}>Select the hub or collective you belong to</p>
          {hubs.length === 0 ? (
            <div style={{ padding: '1rem', background: '#FEF3C7', borderRadius: '0.75rem', fontSize: '0.8rem', color: '#92400E' }}>
              No hubs registered yet. Please contact your group coordinator or The Green Guild admin.
            </div>
          ) : (
            <select
              className="input"
              value={hubId}
              onChange={e => setHubId(e.target.value)}
              required={plan === 'hub_membership'}
              style={{ width: '100%' }}
            >
              <option value="">— Select your hub —</option>
              {hubs.map((h: any) => (
                <option key={h.id} value={h.id}>{h.name}{h.region ? ` (${h.region})` : ''}</option>
              ))}
            </select>
          )}
          <p style={{ fontSize: '0.7rem', color: 'var(--moss)', marginTop: '0.5rem' }}>
            If your group is not listed, it may not be registered yet. Contact your coordinator.
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
          {saving ? 'Saving…' : plan === 'wholesale_collection' ? 'Register for Wholesale Collection' : `Continue to Payment — $${((priceMap[billing] || 0) / 100).toFixed(0)}`}
        </button>
      </form>
    </div>
  )
}
