'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils/pricing'
import { formatAEST } from '@/lib/utils/timezone'

const ORDER_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  payment_confirmed: { label: 'Paid',       bg: '#EAF3DE', color: '#3B6D11' },
  preparing:         { label: 'Preparing',  bg: '#E6F1FB', color: '#185FA5' },
  ready_for_pickup:  { label: 'Ready',      bg: '#E1F5EE', color: '#0F6E56' },
  out_for_delivery:  { label: 'Delivering', bg: '#E1F5EE', color: '#0F6E56' },
  delivered:         { label: 'Delivered',  bg: '#C0DD97', color: '#27500A' },
  disputed:          { label: 'Disputed',   bg: '#FCEBEB', color: '#A32D2D' },
  cancelled:         { label: 'Cancelled',  bg: '#F1EFE8', color: '#5F5E5A' },
}

const PO_STATUS: Record<string, { label: string; bg: string; color: string }> = {
  pending:          { label: 'Action needed', bg: '#FEF3C7', color: '#92400E' },
  ready:            { label: 'Items ready',   bg: '#D1FAE5', color: '#065F46' },
  delivered_to_hub: { label: 'At hub',        bg: '#DBEAFE', color: '#1E40AF' },
  rejected:         { label: 'Rejected',      bg: '#FEE2E2', color: '#B91C1C' },
}

export default function FarmerOrdersPage() {
  const [orders, setOrders]           = useState<any[]>([])
  const [poStatuses, setPoStatuses]   = useState<Record<string, string>>({})
  const [loading, setLoading]         = useState(true)
  const [expanded, setExpanded]       = useState<Set<string>>(new Set())
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectLoading, setRejectLoading] = useState(false)
  const fileRef   = useRef<HTMLInputElement>(null)
  const activeRef = useRef<string | null>(null)

  useEffect(() => {
    fetch('/api/orders?farmer=true')
      .then(r => r.json())
      .then(d => {
        const fetched: any[] = d.data || []
        setOrders(fetched)
        setLoading(false)
        // Fetch PO statuses for all orders
        if (fetched.length > 0) {
          fetch('/api/farmer/po-statuses?ids=' + fetched.map((o: any) => o.id).join(','))
            .then(r => r.json())
            .then(ps => setPoStatuses(ps.data || {}))
            .catch(() => {})
        }
      })
  }, [])

  const toggle = (id: string) =>
    setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  async function handlePPOD(orderItemId: string, orderId: string, file: File) {
    setUploadingId(orderItemId)
    let gpsLat = '', gpsLng = ''
    if (navigator.geolocation) {
      await new Promise<void>(res =>
        navigator.geolocation.getCurrentPosition(
          p => { gpsLat = String(p.coords.latitude); gpsLng = String(p.coords.longitude); res() },
          () => res(),
          { timeout: 5000 }
        )
      )
    }
    const fd = new FormData()
    fd.append('photo', file); fd.append('order_item_id', orderItemId)
    fd.append('gps_lat', gpsLat); fd.append('gps_lng', gpsLng)
    const res  = await fetch(`/api/orders/${orderId}/ppod`, { method: 'POST', body: fd })
    const data = await res.json()
    if (res.ok) {
      setOrders(os => os.map(o => ({
        ...o,
        order_items: o.order_items?.map((i: any) =>
          i.id === orderItemId ? { ...i, ppod_url: data.data.ppod_url } : i
        ),
      })))
    }
    setUploadingId(null)
  }

  async function submitReject(orderId: string) {
    if (!rejectReason.trim()) return
    setRejectLoading(true)
    const res = await fetch(`/api/orders/${orderId}/po/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: rejectReason }),
    })
    if (res.ok) {
      setPoStatuses(s => ({ ...s, [orderId]: 'rejected' }))
    } else {
      alert('Could not submit rejection. Please try again.')
    }
    setRejectLoading(false)
    setRejectingId(null)
    setRejectReason('')
  }

  const th: React.CSSProperties = {
    padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700,
    letterSpacing: '0.07em', textTransform: 'uppercase' as const,
    color: 'var(--forest)', opacity: 0.5,
    borderBottom: '1px solid var(--olive)', whiteSpace: 'nowrap' as const,
  }
  const td: React.CSSProperties = {
    padding: '11px 12px', borderBottom: '1px solid var(--olive)',
    fontSize: '0.875rem', color: 'var(--forest)', verticalAlign: 'middle' as const,
  }

  if (loading) return (
    <div className="page-pad" style={{ padding: '2.5rem', color: 'var(--forest)', opacity: 0.4 }}>Loading…</div>
  )

  return (
    <div className="page-pad" style={{ padding: '2.5rem', fontFamily: 'var(--font-body)' }}>

      {/* Header */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--forest)', marginBottom: '0.2rem' }}>
          My Orders
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--forest)', opacity: 0.5 }}>
          {orders.length} order{orders.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0]
          if (file && activeRef.current) {
            const order = orders.find(o => o.order_items?.some((i: any) => i.id === activeRef.current))
            if (order) handlePPOD(activeRef.current, order.id, file)
          }
          e.target.value = ''
        }}
      />

      {orders.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 'var(--r-card)', padding: '5rem', textAlign: 'center', border: '1px solid var(--olive)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📦</div>
          <p style={{ fontFamily: 'var(--font-display)', color: 'var(--forest)', fontSize: '1.25rem', marginBottom: '0.5rem' }}>No orders yet</p>
          <p style={{ color: 'var(--forest)', opacity: 0.5, fontSize: '0.875rem' }}>Orders appear here once buyers purchase your products</p>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: 'var(--r-card)', border: '1px solid var(--olive)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--olive)' }}>
                <th style={{ ...th, width: '2rem' }} />
                <th style={th}>Order</th>
                <th style={th}>Date</th>
                <th style={{ ...th, width: '32%' }}>Items</th>
                <th style={{ ...th, textAlign: 'right' as const }}>Total</th>
                <th style={{ ...th, textAlign: 'center' as const }}>Order status</th>
                <th style={{ ...th, textAlign: 'center' as const }}>PO status</th>
                <th style={{ ...th, textAlign: 'right' as const }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(order => {
                const os  = ORDER_STATUS[order.status] || { label: order.status?.replace(/_/g, ' ') || '', bg: '#F1EFE8', color: '#5F5E5A' }
                const poS = poStatuses[order.id]
                const ps  = poS ? PO_STATUS[poS] : null
                const isOpen     = expanded.has(order.id)
                const itemCount  = order.order_items?.length || 0
                const summary    = (order.order_items?.slice(0, 2) || [])
                  .map((i: any) => `${i.quantity}× ${i.products?.name}`).join(', ')
                  + (itemCount > 2 ? ` +${itemCount - 2} more` : '')
                const canUpload  = ['payment_confirmed', 'preparing', 'out_for_delivery', 'ready_for_pickup'].includes(order.status)
                const canReject  = poS && ['pending', 'ready'].includes(poS)

                return (
                  <>
                    {/* Main row */}
                    <tr
                      key={order.id}
                      onClick={() => toggle(order.id)}
                      style={{ cursor: 'pointer', background: isOpen ? '#fafaf7' : 'white', transition: 'background 0.1s' }}
                    >
                      {/* Chevron */}
                      <td style={{ ...td, textAlign: 'center' as const, width: '2rem' }}>
                        <span style={{ display: 'inline-block', transition: 'transform 0.18s', transform: isOpen ? 'rotate(90deg)' : 'none', fontSize: '0.6rem', color: 'var(--moss)' }}>▶</span>
                      </td>

                      {/* Order # + fulfillment type */}
                      <td style={{ ...td, fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '-0.01em', fontSize: '0.875rem' }}>
                        {order.order_number}
                        <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-body)', fontWeight: 400, color: 'var(--moss)', marginTop: '1px' }}>
                          {order.fulfillment_type === 'hub_pickup' ? '🏭 Hub' : '🚚 Delivery'}
                        </div>
                      </td>

                      {/* Date */}
                      <td style={{ ...td, opacity: 0.6, whiteSpace: 'nowrap' as const }}>
                        {formatAEST(order.created_at, 'dd MMM yyyy')}
                      </td>

                      {/* Items summary */}
                      <td style={{ ...td, opacity: 0.8, fontSize: '0.8rem' }}>{summary}</td>

                      {/* Total */}
                      <td style={{ ...td, textAlign: 'right' as const, fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', fontSize: '1rem', fontWeight: 700, whiteSpace: 'nowrap' as const }}>
                        {formatPrice(order.subtotal_cents)}
                      </td>

                      {/* Order status badge */}
                      <td style={{ ...td, textAlign: 'center' as const }}>
                        <span style={{ padding: '3px 10px', borderRadius: '99px', fontSize: '0.7rem', fontWeight: 700, background: os.bg, color: os.color, whiteSpace: 'nowrap' as const }}>
                          {os.label}
                        </span>
                      </td>

                      {/* PO status badge */}
                      <td style={{ ...td, textAlign: 'center' as const }}>
                        {ps ? (
                          <span style={{ padding: '3px 10px', borderRadius: '99px', fontSize: '0.7rem', fontWeight: 700, background: ps.bg, color: ps.color, whiteSpace: 'nowrap' as const }}>
                            {ps.label}
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.7rem', color: 'var(--moss)', opacity: 0.4 }}>—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ ...td, textAlign: 'right' as const }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                          <Link
                            href={`/dashboard/farmer/orders/${order.id}/po`}
                            prefetch={false}
                            style={{ padding: '0.3rem 0.75rem', background: 'var(--forest)', color: 'var(--cream)', borderRadius: '0.4rem', fontSize: '0.7rem', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' as const }}
                          >
                            View PO
                          </Link>
                          {canReject && rejectingId !== order.id && (
                            <button
                              onClick={() => { setRejectingId(order.id); setRejectReason('') }}
                              style={{ padding: '0.3rem 0.75rem', background: '#FEE2E2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: '0.4rem', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' as const }}
                            >
                              Reject PO
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Reject PO inline form */}
                    {rejectingId === order.id && (
                      <tr key={order.id + '-reject'}>
                        <td colSpan={8} style={{ padding: 0, background: '#FFF5F5', borderBottom: '1px solid #FECACA' }}>
                          <div style={{ padding: '0.875rem 1.25rem 0.875rem 2.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.875rem', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: '16rem' }}>
                              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#B91C1C', marginBottom: '0.4rem' }}>
                                Reason for rejecting {order.order_number}
                              </p>
                              <textarea
                                className="input"
                                style={{ width: '100%', height: '3.5rem', resize: 'none', fontSize: '0.8rem', boxSizing: 'border-box' }}
                                placeholder="e.g. out of stock, cannot fulfil this week…"
                                value={rejectReason}
                                onChange={e => setRejectReason(e.target.value)}
                              />
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '1.4rem' }}>
                              <button
                                onClick={() => { setRejectingId(null); setRejectReason('') }}
                                className="btn btn-ghost btn-sm"
                              >Cancel</button>
                              <button
                                onClick={() => submitReject(order.id)}
                                disabled={rejectLoading || !rejectReason.trim()}
                                style={{ padding: '0.3rem 0.875rem', background: '#B91C1C', color: 'white', border: 'none', borderRadius: '0.4rem', fontSize: '0.75rem', fontWeight: 700, cursor: rejectLoading || !rejectReason.trim() ? 'default' : 'pointer', fontFamily: 'var(--font-body)', opacity: rejectLoading || !rejectReason.trim() ? 0.5 : 1 }}
                              >
                                {rejectLoading ? 'Submitting…' : 'Confirm rejection'}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Expanded items */}
                    {isOpen && (
                      <tr key={order.id + '-detail'}>
                        <td colSpan={8} style={{ padding: 0, background: '#fafaf7', borderBottom: '1px solid var(--olive)' }}>
                          <div style={{ padding: '1rem 1.25rem 1.25rem 2.75rem' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid var(--sage)' }}>
                                  {['Product', 'Qty', 'Unit', 'Unit price', 'Subtotal', 'Delivery photo'].map((h, i) => (
                                    <th key={h} style={{
                                      padding: '6px 8px',
                                      textAlign: i >= 3 ? 'right' as const : 'left' as const,
                                      fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em',
                                      textTransform: 'uppercase' as const, color: 'var(--forest)', opacity: 0.5,
                                    }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {(order.order_items || []).map((item: any) => (
                                  <tr key={item.id} style={{ borderBottom: '1px solid var(--olive)' }}>
                                    <td style={{ padding: '8px', fontWeight: 600, color: 'var(--forest)' }}>
                                      {item.products?.name}
                                      {item.is_b2b && (
                                        <span style={{ marginLeft: '0.375rem', fontSize: '0.6rem', background: 'var(--olive)', color: 'var(--moss)', padding: '1px 5px', borderRadius: '4px' }}>B2B</span>
                                      )}
                                    </td>
                                    <td style={{ padding: '8px', color: 'var(--forest)' }}>{item.quantity}</td>
                                    <td style={{ padding: '8px', color: 'var(--moss)' }}>{item.products?.unit}</td>
                                    <td style={{ padding: '8px', textAlign: 'right' as const, color: 'var(--forest)' }}>{formatPrice(item.unit_price_cents)}</td>
                                    <td style={{ padding: '8px', textAlign: 'right' as const, fontWeight: 700, color: 'var(--forest)' }}>{formatPrice(item.subtotal_cents)}</td>
                                    <td style={{ padding: '8px', textAlign: 'right' as const }}>
                                      {item.ppod_url ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                          <img src={item.ppod_url} alt="Delivery photo" style={{ width: '2rem', height: '2rem', borderRadius: '0.375rem', objectFit: 'cover' }} />
                                          <span style={{ fontSize: '0.7rem', color: '#065F46', fontWeight: 600 }}>✓ Uploaded</span>
                                          {item.ppod_gps_lat && (
                                            <a href={`https://maps.google.com/?q=${item.ppod_gps_lat},${item.ppod_gps_lng}`} target="_blank" rel="noopener noreferrer"
                                              style={{ fontSize: '0.65rem', color: 'var(--moss)', textDecoration: 'underline' }}>📍</a>
                                          )}
                                        </div>
                                      ) : canUpload ? (
                                        <button
                                          onClick={() => { activeRef.current = item.id; fileRef.current?.click() }}
                                          disabled={uploadingId === item.id}
                                          style={{
                                            padding: '0.25rem 0.625rem', background: uploadingId === item.id ? 'var(--olive)' : 'var(--sage)',
                                            border: 'none', borderRadius: '0.375rem', cursor: uploadingId === item.id ? 'default' : 'pointer',
                                            fontSize: '0.7rem', fontWeight: 700, color: 'var(--forest)', fontFamily: 'var(--font-body)',
                                          }}
                                        >
                                          {uploadingId === item.id ? '⏳ Uploading…' : '📷 Upload'}
                                        </button>
                                      ) : (
                                        <span style={{ fontSize: '0.7rem', color: 'var(--moss)', opacity: 0.4 }}>—</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
