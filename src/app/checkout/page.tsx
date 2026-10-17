'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Elements } from '@stripe/react-stripe-js'
import { useCart } from '@/hooks/useCart'
import { formatPrice, getUnitGstCents } from '@/lib/utils/pricing'
import { getStripe } from '@/lib/stripe/client'
import { STRIPE_APPEARANCE } from '@/lib/stripe/appearance'
import StripePaymentForm from '@/components/StripePaymentForm'

const DELIVERY_FEE = 2000

export default function CheckoutPage() {
  const router = useRouter()
  const { items, fulfillment_type, setFulfillmentType, clearCart, subtotalCents, isB2B } = useCart()
  const [loading, setLoading] = useState(false)
  const [address, setAddress] = useState({ line1: '', suburb: '', state: 'VIC', postcode: '' })
  const [notes, setNotes]     = useState('')
  const [error, setError]     = useState('')

  // Set once the order is created and Stripe has issued a PaymentIntent —
  // switches the right-hand panel from "place order" into "enter card
  // details." Stays null in NEXT_PUBLIC_TEST_MODE, since the server
  // finalizes the order immediately in that mode and there's no payment to
  // collect.
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null)

  const [farmPickupIds, setFarmPickupIds] = useState<Set<string>>(new Set())
  // farmer_id -> chosen farmer_fulfillment_options.id, for growers who
  // configured more than one pickup or delivery slot (different day/time,
  // and for delivery, cost). A farmer only ever appears as either a pickup
  // or a pooled-delivery entry per order, so one map safely covers both.
  const [fulfillmentOptionIds, setFulfillmentOptionIds] = useState<Record<string, string>>({})

  // Growers in this cart who offer farm pickup — pulled from whatever the
  // marketplace fetch attached to each product, so no extra request needed.
  // A grower can configure more than one pickup slot (e.g. Monday morning
  // vs Wednesday afternoon) — expose all of them so the buyer can pick.
  const pickupEligibleFarmers = (() => {
    const seen = new Map<string, any>()
    for (const item of items) {
      const f = (item.product as any).farmers
      if (f?.offers_farm_pickup && !seen.has(item.product.farmer_id)) {
        const options = (f?.farmer_fulfillment_options || []).filter((o: any) => o.type === 'pickup')
        seen.set(item.product.farmer_id, { ...f, farmer_id: item.product.farmer_id, options })
      }
    }
    return [...seen.values()]
  })()

  function toggleFarmPickup(farmerId: string) {
    setFarmPickupIds(s => {
      const next = new Set(s)
      next.has(farmerId) ? next.delete(farmerId) : next.add(farmerId)
      return next
    })
  }

  // Nothing left to pool through hub/delivery once every item's grower is farm-pickup.
  const pooledItems = items.filter(i => !farmPickupIds.has(i.product.farmer_id))

  // Each pooled grower may have their own configured delivery cost/day/time
  // (set on their storefront) — sum those per-grower instead of one flat fee,
  // so the total actually reflects what each grower charges, falling back to
  // the platform default only for growers who haven't configured delivery.
  // A grower can configure more than one delivery slot (e.g. Monday $10 vs
  // Thursday $8) — expose all of them so the buyer can pick.
  const pooledDeliveryInfo = (() => {
    const seen = new Map<string, { farmer_id: string; business_name: string; options: any[] }>()
    for (const item of pooledItems) {
      const f = (item.product as any).farmers
      if (!seen.has(item.product.farmer_id)) {
        const options = (f?.farmer_fulfillment_options || []).filter((o: any) => o.type === 'delivery')
        seen.set(item.product.farmer_id, { farmer_id: item.product.farmer_id, business_name: f?.business_name || 'Grower', options })
      }
    }
    return [...seen.values()]
  })()

  // The buyer's pick if they chose one, else the first configured slot —
  // matches the old single-option behaviour when there's nothing to choose.
  function selectedOption(farmerId: string, options: any[]) {
    const chosenId = fulfillmentOptionIds[farmerId]
    return (chosenId && options.find(o => o.id === chosenId)) || options[0] || null
  }

  const realDeliveryFeeCents = pooledDeliveryInfo.reduce((sum, f) => {
    const opt = f.options.length > 0 ? selectedOption(f.farmer_id, f.options) : null
    return sum + (opt?.cost_cents ?? DELIVERY_FEE)
  }, 0)

  // No real hub exists today, so pooled items are always delivery — self-heal
  // any cart persisted from before Hub Pickup was removed as an option.
  useEffect(() => {
    if (fulfillment_type !== 'direct_delivery') setFulfillmentType('direct_delivery')
  }, [fulfillment_type, setFulfillmentType])

  const deliveryFee = pooledItems.length > 0 ? realDeliveryFeeCents : 0

  // B2B totals — GST per line mirrors the same gstAppliesToItem() rule used
  // everywhere else (product not GST-free AND the grower is GST-registered),
  // subtracted from the already GST-inclusive unit_price_cents so these totals
  // can't drift from what's actually charged at order creation.
  const subtotalExGst = isB2B
    ? items.reduce((s, i) => s + (i.unit_price_cents - getUnitGstCents(i.product, true, !!i.product.farmers?.gst_registered)) * i.quantity, 0)
    : 0
  const gstAmount = isB2B
    ? items.reduce((s, i) => s + getUnitGstCents(i.product, true, !!i.product.farmers?.gst_registered) * i.quantity, 0)
    : 0
  const total = subtotalCents() + deliveryFee

  async function placeOrder() {
    setLoading(true); setError('')

    // Final stock re-validation before placing
    const ids = items.map(i => i.product_id).join(',')
    const res  = await fetch(`/api/cart/validate?ids=${ids}&b2b=${isB2B}`)
    const data = await res.json()
    const map: Record<string, any> = {}
    ;(data.items || []).forEach((s: any) => { map[s.product_id] = s })
    const hasStockIssue = items.some(item => {
      const stock = map[item.product_id]
      return !stock || !stock.still_listed || item.quantity > stock.available
    })
    if (hasStockIssue) {
      setError('Some items in your cart are no longer available. Please go back and update your cart.')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(i => ({ product_id: i.product_id, quantity: i.quantity, notes: i.notes || undefined })),
          fulfillment_type,
          delivery_address: address.line1,
          delivery_suburb: address.suburb,
          delivery_state: address.state,
          delivery_postcode: address.postcode,
          notes,
          farm_pickup_farmer_ids: [...farmPickupIds],
          fulfillment_option_selections: {
            // Which specific pickup slot, for growers opted into farm pickup
            // who configured more than one.
            ...Object.fromEntries(
              pickupEligibleFarmers
                .filter(f => farmPickupIds.has(f.farmer_id) && f.options.length > 0)
                .map(f => [f.farmer_id, selectedOption(f.farmer_id, f.options)?.id])
                .filter(([, id]) => id)
            ),
            // Which specific delivery slot, for pooled growers with more than
            // one — only meaningful when Delivery is the chosen method.
            ...(fulfillment_type === 'direct_delivery'
              ? Object.fromEntries(
                  pooledDeliveryInfo
                    .filter(f => f.options.length > 0)
                    .map(f => [f.farmer_id, selectedOption(f.farmer_id, f.options)?.id])
                    .filter(([, id]) => id)
                )
              : {}),
          },
        }),
      })
      const orderData = await res.json()
      if (!res.ok) { setError(orderData.error || 'Something went wrong'); setLoading(false); return }

      if (orderData.data.client_secret) {
        // Real payment required — order exists as pending_payment, stock is
        // already reserved. Switch to the card-entry step; the order only
        // finalizes once Stripe confirms payment (webhook -> finalizeOrderPayment).
        setPendingOrderId(orderData.data.order_id)
        setClientSecret(orderData.data.client_secret)
        setLoading(false)
      } else {
        // NEXT_PUBLIC_TEST_MODE bypass — order was finalized server-side immediately.
        clearCart()
        router.push(`/dashboard/buyer/orders/${orderData.data.order_id}?new=true`)
      }
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  if (items.length === 0 && !loading) return (
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
        <Link href="/cart" className="btn btn-ghost btn-sm">← Edit cart</Link>
        <h1 className="type-subheading" style={{ color: 'var(--forest)', fontSize: '1.75rem' }}>Checkout</h1>
      </nav>

      <div className="checkout-layout" style={{ maxWidth: '60rem', margin: '0 auto', padding: '2.5rem 1.5rem', display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '2rem', alignItems: 'start' }}>

        {/* ── Right: Read-only order summary ── */}
        <div className="checkout-summary" style={{ gridColumn: '2', gridRow: '1 / 3' }}>
          <div className="card reveal" style={{ padding: '2rem', position: 'sticky', top: '2rem', background: 'var(--forest)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <h2 className="type-label-lg" style={{ color: 'var(--sage)' }}>Order summary</h2>
              <Link href="/cart" style={{ fontSize: '0.75rem', color: 'var(--moss)', textDecoration: 'underline', fontFamily: 'var(--font-body)' }}>Edit cart</Link>
            </div>

            {/* Read-only line items */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', marginBottom: '1.5rem' }}>
              {items.map(item => {
                const growerGstRegistered = !!item.product.farmers?.gst_registered
                const isGstFree  = item.product.is_gst_free && growerGstRegistered
                const unitGst    = getUnitGstCents(item.product, isB2B, growerGstRegistered)
                const exGstUnit  = item.unit_price_cents - unitGst
                const displayUnit = isB2B ? exGstUnit : item.unit_price_cents
                const lineTotal   = displayUnit * item.quantity

                // Each item shows exactly what its own grower's chosen fulfillment
                // is — different growers in the same order can be pickup vs
                // delivery, or different slots of the same type, and the buyer
                // should see that against the specific item, not just once
                // buried in a single collection-method section below.
                const isPickup = farmPickupIds.has(item.product.farmer_id)
                let fulfillmentTag: string | null = null
                if (isPickup) {
                  fulfillmentTag = '🚜 farm pickup'
                } else {
                  const deliveryEntry = pooledDeliveryInfo.find(f => f.farmer_id === item.product.farmer_id)
                  const chosen = deliveryEntry && deliveryEntry.options.length > 0 ? selectedOption(deliveryEntry.farmer_id, deliveryEntry.options) : null
                  const day = chosen?.day_of_week ? `${chosen.day_of_week.charAt(0).toUpperCase()}${chosen.day_of_week.slice(1)}` : ''
                  const time = chosen?.start_time && chosen?.end_time ? ` ${chosen.start_time}–${chosen.end_time}` : ''
                  fulfillmentTag = chosen ? `🚚 delivery${day ? ` · ${day}${time}` : ''}` : '🚚 delivery'
                }

                return (
                  <div key={item.product_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--cream)', marginBottom: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.product.name}
                      </p>
                      {fulfillmentTag && (
                        <p style={{ fontSize: '0.65rem', color: 'var(--sage)', fontWeight: 600, marginBottom: '0.15rem' }}>{fulfillmentTag}</p>
                      )}
                      <p className="type-label-sm" style={{ color: 'var(--moss)' }}>
                        {item.quantity} × {formatPrice(displayUnit)} / {item.product.unit}
                        {isB2B && !isGstFree && <span style={{ opacity: 0.6 }}> ex-GST</span>}
                        {!isB2B && <span style={{ opacity: 0.6 }}> inc-GST</span>}
                      </p>
                      {item.notes && (
                        <p style={{ fontSize: '0.7rem', color: 'var(--sage)', fontStyle: 'italic', marginTop: '0.2rem' }}>
                          📝 {item.notes}
                        </p>
                      )}
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
              {isB2B ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="type-label-sm" style={{ color: 'var(--moss)' }}>Subtotal (ex-GST)</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--cream)', fontWeight: 700 }}>{formatPrice(subtotalExGst)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="type-label-sm" style={{ color: 'var(--moss)' }}>GST (10%)</span>
                    <span style={{ fontSize: '0.85rem', color: 'var(--cream)', fontWeight: 700 }}>{formatPrice(gstAmount)}</span>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="type-label-sm" style={{ color: 'var(--moss)' }}>Subtotal (inc-GST)</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--cream)', fontWeight: 700 }}>{formatPrice(subtotalCents())}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="type-label-sm" style={{ color: 'var(--moss)' }}>
                  Delivery
                </span>
                <span style={{ fontSize: '0.85rem', color: 'var(--cream)', fontWeight: 700 }}>
                  {deliveryFee === 0 ? 'Free' : formatPrice(deliveryFee)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(204,213,174,0.2)', paddingTop: '0.875rem' }}>
                <span className="type-label-lg" style={{ color: 'var(--sage)' }}>Total {isB2B ? '(inc-GST)' : ''}</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', color: 'var(--cream)', letterSpacing: '-0.03em' }}>{formatPrice(total)}</span>
              </div>
            </div>

            {error && (
              <div className="badge badge-red" style={{ width: '100%', padding: '0.875rem', borderRadius: '0.75rem', justifyContent: 'flex-start', fontSize: '0.7rem', marginTop: '1.25rem' }}>
                ⚠ {error}
              </div>
            )}

            {clientSecret && pendingOrderId ? (
              <div style={{ marginTop: '1.5rem' }}>
                <Elements
                  stripe={getStripe()}
                  options={{ clientSecret, appearance: STRIPE_APPEARANCE }}
                >
                  <StripePaymentForm
                    amountLabel={`Pay ${formatPrice(total)}`}
                    returnUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/checkout/complete?order_id=${pendingOrderId}`}
                    onSuccess={() => { clearCart(); router.push(`/dashboard/buyer/orders/${pendingOrderId}?new=true`) }}
                  />
                </Elements>
              </div>
            ) : (
              <button
                onClick={placeOrder}
                disabled={loading}
                className="btn btn-cream"
                style={{ width: '100%', marginTop: '1.5rem' }}
              >
                {loading ? 'Placing order…' : 'Continue to Payment'}
              </button>
            )}
            <p className="type-label-sm" style={{ color: 'var(--moss)', textAlign: 'center', marginTop: '0.875rem' }}>
              {isB2B ? 'Secure via Stripe · GST itemised above' : 'Secure via Stripe · GST included'}
            </p>
          </div>
        </div>

        {/* ── Left: Delivery form ── */}
        {/* Locked once the order is created and we're collecting payment —
            these choices are already snapshotted onto the order; editing
            them here now would do nothing but could read as if it still did. */}
        <div className="checkout-form" style={{ gridColumn: '1', display: 'flex', flexDirection: 'column', gap: '1.5rem', opacity: clientSecret ? 0.5 : 1, pointerEvents: clientSecret ? 'none' : 'auto' }}>

          {/* Farm pickup — per grower, on top of the pooled hub/delivery choice below */}
          {pickupEligibleFarmers.length > 0 && (
            <div className="card reveal" style={{ padding: '2rem' }}>
              <h2 className="type-label-lg" style={{ color: 'var(--forest)', marginBottom: '0.375rem' }}>🚜 Farm pickup available</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--moss)', marginBottom: '1.25rem' }}>
                These growers let you collect directly from the farm instead of the hub or delivery.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {pickupEligibleFarmers.map(f => {
                  const checked = farmPickupIds.has(f.farmer_id)
                  const optionLabel = (o: any) => [
                    o.day_of_week ? `${o.day_of_week.charAt(0).toUpperCase()}${o.day_of_week.slice(1)}` : '',
                    o.start_time && o.end_time ? `${o.start_time}–${o.end_time}` : '',
                  ].filter(Boolean).join(' · ')
                  const chosen = checked && f.options.length > 0 ? selectedOption(f.farmer_id, f.options) : null

                  return (
                    <div key={f.farmer_id}>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', padding: '1rem', background: checked ? 'var(--forest)' : 'var(--olive)', borderRadius: '1rem', cursor: 'pointer', transition: 'background 0.2s' }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleFarmPickup(f.farmer_id)}
                          style={{ width: '1.1rem', height: '1.1rem', accentColor: 'var(--forest)', flexShrink: 0, marginTop: '0.1rem' }} />
                        <div>
                          <p style={{ fontWeight: 700, fontSize: '0.875rem', color: checked ? 'var(--cream)' : 'var(--forest)' }}>{f.business_name}</p>
                          <p style={{ fontSize: '0.78rem', color: checked ? 'var(--sage)' : 'var(--moss)', marginTop: '0.15rem' }}>
                            {[f.address, f.suburb, f.state].filter(Boolean).join(', ')}
                          </p>
                          {checked && f.options.length === 1 && optionLabel(f.options[0]) && (
                            <p style={{ fontSize: '0.75rem', color: 'var(--sage)', marginTop: '0.3rem' }}>{optionLabel(f.options[0])}</p>
                          )}
                        </div>
                      </label>

                      {/* More than one pickup slot configured — let the buyer choose which */}
                      {checked && f.options.length > 1 && (
                        <div style={{ marginTop: '0.5rem', marginLeft: '1rem', padding: '0.875rem 1rem', background: 'var(--olive)', borderRadius: '0.75rem' }}>
                          <p style={{ fontSize: '0.78rem', color: 'var(--forest)', fontWeight: 700, marginBottom: '0.4rem' }}>Choose a pickup slot</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            {f.options.map((o: any) => (
                              <label key={o.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input type="radio" name={`pickup-opt-${f.farmer_id}`} checked={chosen?.id === o.id}
                                  onChange={() => setFulfillmentOptionIds(s => ({ ...s, [f.farmer_id]: o.id }))}
                                  style={{ accentColor: 'var(--forest)' }} />
                                <span style={{ fontSize: '0.8rem', color: 'var(--forest)' }}>{optionLabel(o) || 'Pickup'}</span>
                                {o.notes && <span style={{ fontSize: '0.72rem', color: 'var(--moss)' }}>· {o.notes}</span>}
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Fulfillment type */}
          <div className="card reveal" style={{ padding: '2rem' }}>
            <h2 className="type-label-lg" style={{ color: 'var(--forest)', marginBottom: '0.5rem' }}>Collection method</h2>
            {pooledItems.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--moss)' }}>Not needed — every item in your cart is set to farm pickup above.</p>
            ) : (
            <>
            {pickupEligibleFarmers.length > 0 && (
              <p style={{ fontSize: '0.8rem', color: 'var(--moss)', marginBottom: '1rem' }}>For everything else in your cart.</p>
            )}
            {/* Delivery is the only pooled option — there's no real hub to
                collect from yet, so Hub Pickup isn't offered here at all. */}
            <div style={{ padding: '1.25rem', borderRadius: '1.5rem', background: 'var(--forest)' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>🚚</div>
              <div className="type-label" style={{ color: 'var(--cream)', marginBottom: '0.3rem' }}>Delivery</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--sage)', lineHeight: 1.5 }}>To your door · {formatPrice(realDeliveryFeeCents)}</div>
            </div>

            {/* Per-grower delivery cost breakdown — the total above is the sum of these.
                A grower with more than one configured delivery slot gets a picker;
                one slot (or none) just displays, same as before. */}
            {fulfillment_type === 'direct_delivery' && pooledDeliveryInfo.length > 0 && (
              <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label className="label">Delivery breakdown</label>
                {pooledDeliveryInfo.map(f => {
                  const optionLabel = (o: any) => [
                    o.day_of_week ? `${o.day_of_week.charAt(0).toUpperCase()}${o.day_of_week.slice(1)}` : '',
                    o.start_time && o.end_time ? `${o.start_time}–${o.end_time}` : '',
                    o.max_distance_km ? `within ${o.max_distance_km}km` : '',
                  ].filter(Boolean).join(' · ')

                  if (f.options.length > 1) {
                    const chosen = selectedOption(f.farmer_id, f.options)
                    return (
                      <div key={f.farmer_id} style={{ padding: '0.75rem 1rem', background: 'var(--olive)', borderRadius: '0.75rem' }}>
                        <p style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--forest)', marginBottom: '0.5rem' }}>{f.business_name} — choose a delivery slot</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {f.options.map((o: any) => (
                            <label key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <input type="radio" name={`delivery-opt-${f.farmer_id}`} checked={chosen?.id === o.id}
                                  onChange={() => setFulfillmentOptionIds(s => ({ ...s, [f.farmer_id]: o.id }))}
                                  style={{ accentColor: 'var(--forest)' }} />
                                <span style={{ fontSize: '0.8rem', color: 'var(--forest)' }}>{optionLabel(o) || 'Delivery'}</span>
                              </span>
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--forest)' }}>{formatPrice(o.cost_cents)}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  }

                  const only = f.options[0]
                  return (
                    <div key={f.farmer_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.75rem 1rem', background: 'var(--olive)', borderRadius: '0.75rem' }}>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--forest)' }}>{f.business_name}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--moss)', marginTop: '0.15rem' }}>{only ? (optionLabel(only) || 'Delivery') : 'Standard delivery'}</p>
                      </div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--forest)' }}>{formatPrice(only?.cost_cents ?? DELIVERY_FEE)}</span>
                    </div>
                  )
                })}
              </div>
            )}
            </>
            )}
          </div>

          {/* Delivery address */}
          {fulfillment_type === 'direct_delivery' && pooledItems.length > 0 && (
            <div className="card reveal" style={{ padding: '2rem' }}>
              <h2 className="type-label-lg" style={{ color: 'var(--forest)', marginBottom: '1.25rem' }}>Delivery address</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label className="label">Street address</label>
                  <input className="input" placeholder="123 Collins St" value={address.line1} onChange={e => setAddress(a => ({ ...a, line1: e.target.value }))} />
                </div>
                <div className="mg-stack" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem' }}>
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
            <h2 className="type-label-lg" style={{ color: 'var(--forest)', marginBottom: '1.25rem' }}>
              Order notes <span style={{ color: 'var(--moss)', fontWeight: 400 }}>(optional)</span>
            </h2>
            <textarea
              className="input"
              style={{ height: '6rem', resize: 'none' }}
              placeholder="Any special instructions…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
        </div>

      </div>
    </div>
  )
}
