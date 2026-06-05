'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCart } from '@/hooks/useCart'
import { formatPrice } from '@/lib/utils/pricing'
import { createClient } from '@/lib/supabase/client'

const DELIVERY_FEE = 2000

export default function CheckoutPage() {
  const router = useRouter()
  const { items, fulfillment_type, setFulfillmentType, clearCart, subtotalCents, isB2B } = useCart()
  const [loading, setLoading] = useState(false)
  const [address, setAddress] = useState({ line1: '', suburb: '', state: 'VIC', postcode: '' })
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const [hubs, setHubs] = useState<any[]>([])
  const [selectedHubId, setSelectedHubId] = useState<string>('')

  useEffect(() => {
    const supabase = createClient()
    supabase.from('delivery_zones').select('id, name, hub_address, hub_suburb, hub_collection_day, hub_collection_time_start, hub_collection_time_end').eq('is_active', true)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setHubs(data)
          setSelectedHubId(data[0].id) // auto-select first hub
        }
      })
  }, [])

  const deliveryFee = fulfillment_type === 'direct_delivery' ? DELIVERY_FEE : 0
  const total = subtotalCents() + deliveryFee

  async function placeOrder() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items.map(i => ({ product_id: i.product_id, quantity: i.quantity })), fulfillment_type, hub_id: fulfillment_type === 'hub_pickup' ? selectedHubId : undefined, delivery_address: address.line1, delivery_suburb: address.suburb, delivery_state: address.state, delivery_postcode: address.postcode, notes })
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong'); setLoading(false); return }
      clearCart()
      // Test mode: no Stripe, order already confirmed — go straight to order page
      if (data.data.test_mode || !data.data.client_secret) {
        router.push(`/dashboard/buyer/orders/${data.data.order_id}?new=true`)
        return
      }
      // Production: redirect to Stripe payment (implement Stripe Elements here)
      router.push(`/dashboard/buyer/orders/${data.data.order_id}?new=true`)
    } catch { setError('Network error. Please try again.'); setLoading(false) }
  }

  if (items.length === 0) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)' }}>
      <div className="card-forest reveal" style={{ padding: '4rem', textAlign: 'center', maxWidth: '26rem' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>🛒</div>
        <h2 className="type-subheading" style={{ color: 'var(--cream)', marginBottom: '1rem' }}>Cart is empty</h2>
        <p className="type-label" style={{ color: 'var(--sage)', marginBottom: '2rem', lineHeight: 1.8 }}>Head to the marketplace to add products</p>
        <Link href="/marketplace" className="btn btn-cream" style={{ width: '100%' }}>Browse marketplace</Link>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>
      {/* Nav */}
      <nav style={{ background: 'white', borderBottom: '1px solid var(--olive)', padding: '1rem 2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Link href="/marketplace" className="btn btn-ghost btn-sm">← Back</Link>
        <h1 className="type-subheading" style={{ color: 'var(--forest)', fontSize: '1.75rem' }}>Checkout</h1>
      </nav>

      <div style={{ maxWidth: '60rem', margin: '0 auto', padding: '2.5rem 1.5rem', display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '2rem', alignItems: 'start' }}>

        {/* ── Right: Order summary (shown first on mobile via order) ── */}
        <div style={{ gridColumn: '2', gridRow: '1 / 3' }}>
          <div className="card reveal" style={{ padding: '2rem', position: 'sticky', top: '2rem', background: 'var(--forest)' }}>
            <h2 className="type-label-lg" style={{ color: 'var(--sage)', marginBottom: '1.5rem' }}>Order summary</h2>

            {/* Line items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
              {items.map(item => {
                // For B2B: show wholesale ex-GST price per unit
                // For B2C: show retail inc-GST price per unit
                const isGstFree = item.product.is_gst_free
                // wholesale_price = ex-GST amount stored in DB
                // Fallback: if not in cart object, derive from inc-GST by removing 10%
                const unitIncGst = item.unit_price_cents
                const unitExGst = item.product.wholesale_price
                  || (isGstFree ? unitIncGst : Math.round(unitIncGst / 1.1))
                const displayUnit = isB2B ? unitExGst : unitIncGst
                const lineTotal = displayUnit * item.quantity
                return (
                  <div key={item.product_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--cream)', marginBottom: '0.2rem' }}>{item.product.name}</p>
                      <p className="type-label-sm" style={{ color: 'var(--moss)' }}>
                        {item.quantity} × {formatPrice(displayUnit)} / {item.product.unit}
                        {isB2B && !isGstFree && <span style={{ opacity: 0.6 }}> ex-GST</span>}
                        {!isB2B && <span style={{ opacity: 0.6 }}> inc-GST</span>}
                      </p>
                    </div>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--cream)', letterSpacing: '-0.02em', flexShrink: 0 }}>
                      {formatPrice(lineTotal)}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Totals */}
            <div style={{ borderTop: '1px solid rgba(204,213,174,0.2)', paddingTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Subtotal ex-GST for B2B, inc-GST for B2C */}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="type-label-sm" style={{ color: 'var(--moss)' }}>
                  Subtotal {isB2B ? '(ex-GST)' : '(inc-GST)'}
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--cream)', fontWeight: 700 }}>
                  {isB2B
                    ? formatPrice(items.reduce((s, i) => s + (i.product.wholesale_price || (i.product.is_gst_free ? i.unit_price_cents : Math.round(i.unit_price_cents / 1.1))) * i.quantity, 0))
                    : formatPrice(subtotalCents())
                  }
                </span>
              </div>

              {/* GST line for B2B */}
              {isB2B && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="type-label-sm" style={{ color: 'var(--moss)' }}>GST (10%)</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--cream)', fontWeight: 700 }}>
                    {formatPrice(items.reduce((s, i) => {
                      if (i.product.is_gst_free) return s
                      const exGst = i.product.wholesale_price || Math.round(i.unit_price_cents / 1.1); return s + Math.round(exGst * 0.1) * i.quantity
                    }, 0))}
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="type-label-sm" style={{ color: 'var(--moss)' }}>{fulfillment_type === 'hub_pickup' ? 'Hub pickup' : 'Delivery'}</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--cream)', fontWeight: 700 }}>{deliveryFee === 0 ? 'Free' : formatPrice(deliveryFee)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(204,213,174,0.2)', paddingTop: '0.875rem' }}>
                <span className="type-label-lg" style={{ color: 'var(--sage)' }}>Total {isB2B ? '(inc-GST)' : ''}</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', color: 'var(--cream)', letterSpacing: '-0.03em' }}>{formatPrice(total)}</span>
              </div>
            </div>

            {error && (
              <div className="badge badge-red" style={{ width: '100%', padding: '0.875rem', borderRadius: '0.75rem', justifyContent: 'flex-start', fontSize: '0.7rem', marginTop: '1.25rem' }}>⚠ {error}</div>
            )}

            <button onClick={placeOrder} disabled={loading} className="btn btn-cream" style={{ width: '100%', marginTop: '1.5rem' }}>
              {loading ? 'Placing order…' : `Pay ${formatPrice(total)}`}
            </button>
            <p className="type-label-sm" style={{ color: 'var(--moss)', textAlign: 'center', marginTop: '0.875rem' }}>{isB2B ? 'Secure via Stripe · GST itemised above' : 'Secure via Stripe · GST included'}</p>
          </div>
        </div>

        {/* ── Left: Form panels ── */}
        <div style={{ gridColumn: '1', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Fulfillment type */}
          <div className="card reveal" style={{ padding: '2rem' }}>
            <h2 className="type-label-lg" style={{ color: 'var(--forest)', marginBottom: '1.25rem' }}>Collection method</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
              {[
                { id: 'hub_pickup', icon: '🏭', label: 'Hub Pickup', sub: 'Collect from our central hub · Free' },
                { id: 'direct_delivery', icon: '🚚', label: 'Delivery', sub: `To your door · ${formatPrice(DELIVERY_FEE)}` },
              ].map(opt => (
                <button key={opt.id} type="button" onClick={() => setFulfillmentType(opt.id as any)}
                  style={{
                    padding: '1.25rem', borderRadius: '1.5rem', textAlign: 'left', cursor: 'pointer', transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)', border: 'none',
                    background: fulfillment_type === opt.id ? 'var(--forest)' : 'var(--olive)',
                    outline: fulfillment_type === opt.id ? '2px solid var(--forest)' : '2px solid transparent',
                  }}>
                  <div style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>{opt.icon}</div>
                  <div className="type-label" style={{ color: fulfillment_type === opt.id ? 'var(--cream)' : 'var(--forest)', marginBottom: '0.3rem' }}>{opt.label}</div>
                  <div style={{ fontSize: '0.7rem', color: fulfillment_type === opt.id ? 'var(--sage)' : 'var(--moss)', lineHeight: 1.5 }}>{opt.sub}</div>
                </button>
              ))}
            </div>

            {/* Hub selector — shown when hub_pickup selected */}
            {fulfillment_type === 'hub_pickup' && (
              <div style={{ marginTop: '1.25rem' }}>
                {hubs.length === 0 ? (
                  <div style={{ background: '#fef9c3', border: '1px solid #fbbf24', borderRadius: '0.75rem', padding: '0.875rem 1rem', fontSize: '0.85rem', color: '#92400e' }}>
                    ⚠ No hubs configured yet. Contact admin to set up pickup locations.
                  </div>
                ) : hubs.length === 1 ? (
                  <div style={{ background: 'var(--olive)', borderRadius: '0.75rem', padding: '0.875rem 1rem' }}>
                    <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--forest)', marginBottom: '0.2rem' }}>📍 {hubs[0].name}</p>
                    {hubs[0].hub_address && <p style={{ fontSize: '0.8rem', color: 'var(--moss)' }}>{hubs[0].hub_address}{hubs[0].hub_suburb ? `, ${hubs[0].hub_suburb}` : ''}</p>}
                    <p style={{ fontSize: '0.75rem', color: 'var(--moss)', marginTop: '0.2rem', opacity: 0.8 }}>
                      Collection: {hubs[0].hub_collection_day} {hubs[0].hub_collection_time_start}–{hubs[0].hub_collection_time_end}
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="label">Select pickup hub</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {hubs.map(hub => (
                        <button key={hub.id} type="button" onClick={() => setSelectedHubId(hub.id)}
                          style={{ padding: '0.875rem 1rem', borderRadius: '0.75rem', textAlign: 'left', cursor: 'pointer', border: '2px solid', transition: 'all 0.15s',
                            borderColor: selectedHubId === hub.id ? 'var(--forest)' : 'var(--olive)',
                            background: selectedHubId === hub.id ? 'var(--olive)' : 'white' }}>
                          <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--forest)' }}>📍 {hub.name}</p>
                          {hub.hub_address && <p style={{ fontSize: '0.8rem', color: 'var(--moss)', marginTop: '0.15rem' }}>{hub.hub_address}{hub.hub_suburb ? `, ${hub.hub_suburb}` : ''}</p>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Delivery address */}
          {fulfillment_type === 'direct_delivery' && (
            <div className="card reveal" style={{ padding: '2rem' }}>
              <h2 className="type-label-lg" style={{ color: 'var(--forest)', marginBottom: '1.25rem' }}>Delivery address</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="label">Street address</label>
                  <input className="input" placeholder="123 Collins St" value={address.line1} onChange={e => setAddress(a => ({ ...a, line1: e.target.value }))} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem' }}>
                  <div><label className="label">Suburb</label><input className="input" placeholder="Melbourne" value={address.suburb} onChange={e => setAddress(a => ({ ...a, suburb: e.target.value }))} /></div>
                  <div><label className="label">State</label>
                    <select className="input" value={address.state} onChange={e => setAddress(a => ({ ...a, state: e.target.value }))}>
                      {['VIC','NSW','QLD','SA','WA','TAS','ACT','NT'].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div><label className="label">Postcode</label><input className="input" placeholder="3000" maxLength={4} value={address.postcode} onChange={e => setAddress(a => ({ ...a, postcode: e.target.value }))} /></div>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="card reveal reveal-d2" style={{ padding: '2rem' }}>
            <h2 className="type-label-lg" style={{ color: 'var(--forest)', marginBottom: '1.25rem' }}>Order notes <span style={{ color: 'var(--moss)', fontWeight: 400 }}>(optional)</span></h2>
            <textarea className="input" style={{ height: '6rem', resize: 'none' }} placeholder="Any special instructions…" value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
      </div>
    </div>
  )
}
