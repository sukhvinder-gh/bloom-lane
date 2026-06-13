'use client'
import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils/pricing'
import { formatAEST, canDispute, timeUntilDeadline } from '@/lib/utils/timezone'

const CATEGORY_EMOJI: Record<string, string> = {
  flowers_cut: '🌸', flowers_dried: '🌾', foliage: '🍃', vegetables: '🥦',
  herbs: '🌿', fruit: '🍓', eggs: '🥚', honey: '🍯', other: '📦',
}

// Buyer-facing status labels — simplified to 4 stages (raw DB statuses are internal)
const BUYER_STATUS: Record<string, [string, string]> = {
  pending_payment:   ['badge-cream',   'Submitted'],
  payment_confirmed: ['badge-olive',   'Processing'],
  preparing:         ['badge-olive',   'Processing'],
  ready_for_pickup:  ['badge-sage',    'Ready for delivery'],
  out_for_delivery:  ['badge-sage',    'Ready for delivery'],
  delivered:         ['badge-forest',  'Completed'],
  disputed:          ['badge-red',     'Disputed'],
  cancelled:         ['badge-cream',   'Cancelled'],
  refunded:          ['badge-cream',   'Refunded'],
}

function StatusBadge({ status }: { status: string }) {
  const [cls, label] = BUYER_STATUS[status] || ['badge-cream', status.replace(/_/g, ' ')]
  return <span className={`badge ${cls}`}>{label}</span>
}

const TIMELINE_STEPS = [
  { statuses: ['pending_payment', 'payment_confirmed'], label: 'Submitted' },
  { statuses: ['preparing'],                            label: 'Processing' },
  { statuses: ['ready_for_pickup', 'out_for_delivery'], label: 'Ready for delivery' },
  { statuses: ['delivered'],                            label: 'Completed' },
]

export default function BuyerOrderDetailPage() {
  const params = useParams()
  const isNew = useSearchParams().get('new') === 'true'
  const [order, setOrder] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showDispute, setShowDispute] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [disputing, setDisputing] = useState(false)

  useEffect(() => {
    fetch(`/api/orders/${params.id}`).then(r => r.json()).then(d => { setOrder(d.data); setLoading(false) })
  }, [params.id])

  async function submitDispute() {
    if (!disputeReason.trim()) return
    setDisputing(true)
    await fetch(`/api/orders/${params.id}/dispute`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: disputeReason }) })
    setOrder((o: any) => ({ ...o, status: 'disputed' }))
    setShowDispute(false); setDisputing(false)
  }

  if (loading) return <div className="page-pad" style={{ padding: '2.5rem' }}><div className="card" style={{ height: '20rem', background: 'var(--olive)' }} /></div>
  if (!order) return (
    <div className="page-pad" style={{ padding: '2.5rem', textAlign: 'center' }}>
      <p style={{ color: 'var(--moss)' }}>Order not found.</p>
      <Link href="/dashboard/buyer/orders" className="btn btn-ghost btn-sm" style={{ marginTop: '1rem' }}>← Back</Link>
    </div>
  )

  const currentIdx = TIMELINE_STEPS.findIndex(s => s.statuses.includes(order.status))
  const disputeAllowed = canDispute(order.dispute_deadline) && order.status === 'delivered'

  return (
    <div className="page-pad" style={{ padding: '2.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <Link href="/dashboard/buyer/orders" className="btn btn-ghost btn-sm">← Orders</Link>
        <h1 className="type-subheading reveal" style={{ color: 'var(--forest)', flex: 1 }}>{order.order_number}</h1>
        {!['pending_payment', 'cancelled', 'refunded'].includes(order.status) && (
          <Link href={`/dashboard/buyer/orders/${order.id}/invoice`} className="btn btn-outline btn-sm">🧾 Invoice</Link>
        )}
      </div>

      {/* Success banner */}
      {isNew && (
        <div className="card-sage reveal" style={{ padding: '1.75rem', marginBottom: '1.75rem', display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <span style={{ fontSize: '2.5rem' }}>🎉</span>
          <div>
            <p className="type-label" style={{ color: 'var(--forest)', marginBottom: '0.25rem' }}>Order placed successfully!</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--moss)' }}>Payment confirmed. Your growers are preparing your order.</p>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '1.75rem', alignItems: 'start' }}>

        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Status card */}
          <div className="card reveal" style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem' }}>
              <h2 className="type-label-lg" style={{ color: 'var(--forest)' }}>Order status</h2>
              <StatusBadge status={order.status} />
            </div>

            {/* Timeline */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: '1.5rem' }}>
              {TIMELINE_STEPS.map((step, i) => {
                const done = i <= currentIdx
                return (
                  <div key={step.label} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                      <div style={{ width: '0.875rem', height: '0.875rem', borderRadius: '50%', background: done ? 'var(--forest)' : 'var(--olive)', marginBottom: '0.5rem', transition: 'background 0.3s ease' }} />
                      <span className="type-label-sm" style={{ color: done ? 'var(--forest)' : 'var(--moss)', whiteSpace: 'nowrap' }}>{step.label}</span>
                    </div>
                    {i < TIMELINE_STEPS.length - 1 && (
                      <div style={{ height: '2px', flex: 1, background: i < currentIdx ? 'var(--forest)' : 'var(--olive)', marginBottom: '1.25rem', transition: 'background 0.3s ease' }} />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Dispute window */}
            {order.status === 'delivered' && order.dispute_deadline && (
              <div style={{ padding: '1rem 1.25rem', borderRadius: '1rem', background: disputeAllowed ? 'var(--olive)' : 'var(--cream)', border: `1px solid ${disputeAllowed ? 'var(--sage)' : 'var(--olive)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="type-label-sm" style={{ color: disputeAllowed ? 'var(--forest)' : 'var(--moss)' }}>
                  🛡 Dispute window: {disputeAllowed ? timeUntilDeadline(order.dispute_deadline) : 'Expired'}
                </span>
                {disputeAllowed && !showDispute && <button onClick={() => setShowDispute(true)} className="btn btn-forest btn-sm">Raise dispute</button>}
              </div>
            )}

            {/* Dispute form */}
            {showDispute && (
              <div style={{ marginTop: '1rem', padding: '1.25rem', borderRadius: '1rem', background: 'var(--olive)', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                <p className="type-label-sm" style={{ color: 'var(--forest)' }}>Describe the issue</p>
                <textarea className="input" style={{ height: '5rem', resize: 'none' }} placeholder="e.g. Items were damaged, missing items, wrong product…" value={disputeReason} onChange={e => setDisputeReason(e.target.value)} />
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={() => setShowDispute(false)} className="btn btn-ghost btn-sm" style={{ flex: 1 }}>Cancel</button>
                  <button onClick={submitDispute} disabled={disputing || !disputeReason.trim()} className="btn btn-forest btn-sm" style={{ flex: 1 }}>{disputing ? 'Submitting…' : 'Submit dispute'}</button>
                </div>
              </div>
            )}
          </div>

          {/* Partial rejection notice */}
          {order.has_partial_rejection && (
            <div className="card reveal" style={{ padding: '1.25rem 1.5rem', background: '#FFF7ED', border: '1px solid #FED7AA', display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
              <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>⚠️</span>
              <div>
                <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#C2410C', marginBottom: '0.25rem' }}>Some items need attention</p>
                <p style={{ fontSize: '0.8rem', color: '#9A3412', lineHeight: 1.5 }}>
                  One or more items in your order are currently unavailable. Our team is working on a resolution and will be in touch shortly.
                </p>
              </div>
            </div>
          )}

          {/* Items */}
          <div className="card reveal reveal-d1" style={{ padding: '2rem' }}>
            <h2 className="type-label-lg" style={{ color: 'var(--forest)', marginBottom: '1.5rem' }}>Items</h2>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {order.order_items?.map((item: any) => (
                <div key={item.id} className="table-row" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1rem 0', opacity: item.po_rejected ? 0.5 : 1 }}>
                  <div style={{ width: '3rem', height: '3rem', borderRadius: '1rem', background: item.po_rejected ? '#FEE2E2' : 'var(--olive)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', flexShrink: 0, overflow: 'hidden' }}>
                    {item.po_rejected
                      ? '🚫'
                      : (item.products?.image_url || item.products?.image_urls?.[0])
                        ? <img src={item.products.image_url || item.products.image_urls[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : CATEGORY_EMOJI[item.products?.category] || '🌿'
                    }
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--forest)', marginBottom: '0.2rem' }}>{item.products?.name}</p>
                    {item.po_rejected ? (
                      <p className="type-label-sm" style={{ color: '#B91C1C' }}>Currently unavailable — pending resolution</p>
                    ) : (
                      <>
                        <p className="type-label-sm" style={{ color: 'var(--moss)', marginBottom: item.ppod_url ? '0.625rem' : 0 }}>{item.quantity} × {formatPrice(item.unit_price_cents)} / {item.products?.unit}</p>
                        {item.ppod_url && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                            <img src={item.ppod_url} alt="Proof of delivery" style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.625rem', objectFit: 'cover' }} />
                            <div>
                              <p className="type-label-sm" style={{ color: 'var(--forest)' }}>✓ Delivery photo uploaded</p>
                              {item.ppod_gps_lat && <a href={`https://maps.google.com/?q=${item.ppod_gps_lat},${item.ppod_gps_lng}`} target="_blank" rel="noopener noreferrer" className="type-label-sm" style={{ color: 'var(--moss)', textDecoration: 'underline', textUnderlineOffset: '2px' }}>📍 View on map</a>}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: item.po_rejected ? 'var(--moss)' : 'var(--forest)', letterSpacing: '-0.02em', flexShrink: 0, textDecoration: item.po_rejected ? 'line-through' : 'none' }}>
                    {formatPrice(item.subtotal_cents)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* QR code */}
          {order.fulfillment_type === 'hub_pickup' && order.qr_code_url && (
            <div className="card-forest reveal" style={{ padding: '2rem', textAlign: 'center' }}>
              <h3 className="type-label-lg" style={{ color: 'var(--cream)', marginBottom: '0.5rem' }}>Collection QR</h3>
              <p className="type-label-sm" style={{ color: 'var(--moss)', marginBottom: '1.25rem' }}>Show at the Hub to collect</p>
              <img src={order.qr_code_url} alt="QR code" style={{ width: '10rem', height: '10rem', margin: '0 auto', borderRadius: '1rem' }} />
              <p className="type-label-sm" style={{ color: 'var(--sage)', marginTop: '0.875rem', fontFamily: 'monospace', letterSpacing: '0.2em' }}>{order.order_number}</p>
            </div>
          )}

          {/* Summary */}
          <div className="card reveal reveal-d2" style={{ padding: '2rem' }}>
            <h3 className="type-label-lg" style={{ color: 'var(--forest)', marginBottom: '1.25rem' }}>Summary</h3>
            {[
              { label: 'Subtotal', val: formatPrice(order.subtotal_cents) },
              { label: order.fulfillment_type === 'hub_pickup' ? 'Hub pickup' : 'Delivery', val: order.delivery_fee_cents === 0 ? 'Free' : formatPrice(order.delivery_fee_cents) },
              ...(order.gst_cents > 0 ? [{ label: 'GST (incl)', val: formatPrice(order.gst_cents) }] : []),
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--olive)' }}>
                <span className="type-label-sm" style={{ color: 'var(--moss)' }}>{row.label}</span>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--forest)' }}>{row.val}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '1rem' }}>
              <span className="type-label-lg" style={{ color: 'var(--forest)' }}>Total</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--forest)', letterSpacing: '-0.03em' }}>{formatPrice(order.total_cents)}</span>
            </div>
          </div>

          {/* Delivery */}
          <div className="card reveal reveal-d3" style={{ padding: '2rem' }}>
            <h3 className="type-label-lg" style={{ color: 'var(--forest)', marginBottom: '1rem' }}>Delivery</h3>
            <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--forest)', marginBottom: '0.375rem' }}>{order.fulfillment_type === 'hub_pickup' ? '🏭 Hub pickup' : '🚚 Direct delivery'}</p>
            {order.delivery_address && <p style={{ fontSize: '0.85rem', color: 'var(--moss)' }}>{order.delivery_address}, {order.delivery_suburb} {order.delivery_state} {order.delivery_postcode}</p>}
            <p className="type-label-sm" style={{ color: 'var(--moss)', marginTop: '0.875rem' }}>Placed {formatAEST(order.created_at)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
