'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils/pricing'
import { formatAEST, canDispute, timeUntilDeadline } from '@/lib/utils/timezone'

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = { payment_confirmed: 'badge-olive', preparing: 'badge-olive', out_for_delivery: 'badge-sage', delivered: 'badge-sage', disputed: 'badge-red', cancelled: 'badge-cream' }
  return <span className={`badge ${map[status] || 'badge-cream'}`}>{status?.replace(/_/g, ' ')}</span>
}

export default function FarmerOrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [activeItemId, setActiveItemId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/orders?farmer=true').then(r => r.json()).then(d => { setOrders(d.data || []); setLoading(false) })
  }, [])

  async function handlePPOD(orderItemId: string, orderId: string, file: File) {
    setUploadingId(orderItemId)
    let gpsLat = '', gpsLng = ''
    if (navigator.geolocation) await new Promise<void>(res => navigator.geolocation.getCurrentPosition(p => { gpsLat = String(p.coords.latitude); gpsLng = String(p.coords.longitude); res() }, () => res(), { timeout: 5000 }))
    const fd = new FormData()
    fd.append('photo', file); fd.append('order_item_id', orderItemId); fd.append('gps_lat', gpsLat); fd.append('gps_lng', gpsLng)
    const res = await fetch(`/api/orders/${orderId}/ppod`, { method: 'POST', body: fd })
    const data = await res.json()
    if (res.ok) setOrders(os => os.map(o => ({ ...o, order_items: o.order_items?.map((item: any) => item.id === orderItemId ? { ...item, ppod_url: data.data.ppod_url, ppod_timestamp: data.data.timestamp } : item) })))
    setUploadingId(null)
  }

  return (
    <div className="page-pad" style={{ padding: '2.5rem' }}>
      <h1 className="type-heading reveal" style={{ color: 'var(--forest)', marginBottom: '2rem' }}>My Orders</h1>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0]
          if (file && activeItemId) { const order = orders.find(o => o.order_items?.some((i: any) => i.id === activeItemId)); if (order) handlePPOD(activeItemId, order.id, file) }
          e.target.value = ''
        }} />

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="card" style={{ height: '8rem', background: 'var(--olive)' }} />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="card-forest reveal" style={{ padding: '5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1.25rem' }}>📦</div>
          <h3 className="type-subheading" style={{ color: 'var(--cream)', marginBottom: '0.875rem' }}>No orders yet</h3>
          <p className="type-label" style={{ color: 'var(--moss)', lineHeight: 1.8 }}>Orders appear here once buyers purchase your products</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {orders.map(order => (
            <div key={order.id} className="card reveal" style={{ overflow: 'hidden' }}>
              {/* Order header */}
              <div style={{ padding: '1.25rem 1.75rem', background: 'var(--olive)', borderBottom: '1px solid var(--sage)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                  <div>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--forest)', letterSpacing: '-0.02em', textTransform: 'uppercase' }}>{order.order_number}</p>
                    <p className="type-label-sm" style={{ color: 'var(--moss)' }}>{formatAEST(order.created_at)} · {order.fulfillment_type === 'hub_pickup' ? '🏭 Hub pickup' : '🚚 Delivery'}</p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--forest)', letterSpacing: '-0.03em' }}>{formatPrice(order.subtotal_cents)}</p>
                    {order.dispute_deadline && canDispute(order.dispute_deadline) && (
                      <p className="type-label-sm" style={{ color: 'var(--moss)' }}>🛡 {timeUntilDeadline(order.dispute_deadline)}</p>
                    )}
                  </div>
                  <Link href={`/dashboard/farmer/orders/${order.id}/po`} className="btn btn-outline btn-sm" style={{ flexShrink: 0 }} prefetch={false}>
                    View PO
                  </Link>
                </div>
              </div>

              {/* Items */}
              <div style={{ padding: '0.5rem 0' }}>
                {order.order_items?.map((item: any) => (
                  <div key={item.id} style={{ padding: '1rem 1.75rem', borderBottom: '1px solid var(--olive)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--forest)', marginBottom: '0.2rem' }}>{item.products?.name} × {item.quantity}</p>
                      <p className="type-label-sm" style={{ color: 'var(--moss)' }}>{formatPrice(item.unit_price_cents)} / {item.products?.unit} · {item.is_b2b ? 'B2B' : 'B2C'}</p>
                    </div>

                    {/* PPOD */}
                    {['out_for_delivery', 'preparing', 'payment_confirmed'].includes(order.status) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                        {item.ppod_url ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <img src={item.ppod_url} alt="PPOD" style={{ width: '2.75rem', height: '2.75rem', borderRadius: '0.75rem', objectFit: 'cover' }} />
                            <div>
                              <p className="type-label-sm" style={{ color: 'var(--forest)' }}>✓ Photo uploaded</p>
                              <p className="type-label-sm" style={{ color: 'var(--moss)' }}>{item.ppod_gps_lat ? '📍 GPS tagged' : 'No GPS'}</p>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => { setActiveItemId(item.id); fileRef.current?.click() }} disabled={uploadingId === item.id}
                            className="btn btn-sage btn-sm">
                            {uploadingId === item.id ? '⏳ Uploading…' : '📷 Upload Delivery Photo'}
                          </button>
                        )}
                      </div>
                    )}

                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--forest)', letterSpacing: '-0.02em', flexShrink: 0 }}>{formatPrice(item.subtotal_cents)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
