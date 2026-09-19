'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils/pricing'
import { formatAEST } from '@/lib/utils/timezone'
import MessageThread from '@/components/MessageThread'

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

type ConfirmAction = { orderId: string; orderNumber: string; newStatus: 'ready' | 'delivered_to_hub'; label: string }

export default function FarmerOrdersPage() {
  const [orders, setOrders]           = useState<any[]>([])
  const [poStatuses, setPoStatuses]   = useState<Record<string, string>>({})
  const [poIds, setPoIds]             = useState<Record<string, string>>({})
  const [poPickupMethods, setPoPickupMethods] = useState<Record<string, string>>({})
  const [loading, setLoading]         = useState(true)
  const [expanded, setExpanded]       = useState<Set<string>>(new Set())
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectLoading, setRejectLoading] = useState(false)
  const [openMenuId, setOpenMenuId]   = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [statusUpdating, setStatusUpdating] = useState<string | null>(null)
  // Set when arriving from a PO email's "View in Dashboard" link
  // (?order=ORD-XXXX) — narrows the list to that one order until cleared.
  const [orderFilter, setOrderFilter]     = useState<string | null>(null)
  useEffect(() => {
    setOrderFilter(new URLSearchParams(window.location.search).get('order'))
  }, [])
  const fileRef   = useRef<HTMLInputElement>(null)
  const activeRef = useRef<string | null>(null)

  // Close dropdown when clicking outside
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({})
  useEffect(() => {
    if (!openMenuId) return
    function onOutside(e: MouseEvent) {
      const ref = menuRefs.current[openMenuId!]
      if (ref && !ref.contains(e.target as Node)) setOpenMenuId(null)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [openMenuId])

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
            .then(ps => { setPoStatuses(ps.data || {}); setPoIds(ps.ids || {}); setPoPickupMethods(ps.pickupMethods || {}) })
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

  async function executeStatusChange(orderId: string, newStatus: 'ready' | 'delivered_to_hub') {
    setStatusUpdating(orderId)
    setConfirmAction(null)
    const res = await fetch(`/api/farmer/orders/${orderId}/po-status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      setPoStatuses(s => ({ ...s, [orderId]: newStatus }))
    } else {
      const data = await res.json()
      alert(data.error || 'Status update failed. Please try again.')
    }
    setStatusUpdating(null)
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

      {/* Confirmation modal for status changes */}
      {confirmAction && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setConfirmAction(null)}
        >
          <div
            style={{ background: 'white', borderRadius: '1.25rem', padding: '2rem', maxWidth: '22rem', width: '90%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}
            onClick={e => e.stopPropagation()}
          >
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--forest)', marginBottom: '0.625rem' }}>Confirm status change</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--moss)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Update order <strong style={{ color: 'var(--forest)' }}>{confirmAction.orderNumber}</strong> to:<br />
              <strong style={{ color: confirmAction.newStatus === 'delivered_to_hub' ? '#1E40AF' : '#065F46', fontSize: '1rem' }}>{confirmAction.label}</strong>
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setConfirmAction(null)}
                style={{ flex: 1, padding: '0.625rem', borderRadius: '99px', border: '1px solid var(--olive)', background: 'white', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: 'var(--moss)', fontFamily: 'var(--font-body)' }}
              >Cancel</button>
              <button
                onClick={() => executeStatusChange(confirmAction.orderId, confirmAction.newStatus)}
                style={{ flex: 1, padding: '0.625rem', borderRadius: '99px', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700, fontFamily: 'var(--font-body)', background: confirmAction.newStatus === 'delivered_to_hub' ? '#1D4ED8' : '#065F46', color: 'white' }}
              >Confirm</button>
            </div>
          </div>
        </div>
      )}

      {orderFilter && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 1rem', marginBottom: '1rem', background: '#EAF3DE', border: '1px solid #C0DD97', borderRadius: '0.75rem', fontSize: '0.85rem', color: '#27500A' }}>
          <span>Showing only order <strong>{orderFilter}</strong></span>
          <button
            onClick={() => { setOrderFilter(null); window.history.replaceState(null, '', window.location.pathname) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', color: '#27500A', fontWeight: 700, fontSize: '0.85rem' }}
          >
            Show all orders
          </button>
        </div>
      )}

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
                <th style={th}>Buyer</th>
                <th style={{ ...th, width: '32%' }}>Items</th>
                <th style={{ ...th, textAlign: 'right' as const }}>Total</th>
                <th style={{ ...th, textAlign: 'center' as const }}>Order status</th>
                <th style={{ ...th, textAlign: 'center' as const }}>PO status</th>
                <th style={{ ...th, textAlign: 'right' as const }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.filter(o => !orderFilter || o.order_number === orderFilter).map(order => {
                const os  = ORDER_STATUS[order.status] || { label: order.status?.replace(/_/g, ' ') || '', bg: '#F1EFE8', color: '#5F5E5A' }
                const poS = poStatuses[order.id]
                const ps  = poS ? PO_STATUS[poS] : null
                const isOpen     = expanded.has(order.id)
                const itemCount  = order.order_items?.length || 0
                const summary    = (order.order_items?.slice(0, 2) || [])
                  .map((i: any) => `${i.quantity}× ${i.products?.name}`).join(', ')
                  + (itemCount > 2 ? ` +${itemCount - 2} more` : '')
                const canUpload   = ['payment_confirmed', 'preparing', 'out_for_delivery', 'ready_for_pickup'].includes(order.status)
                const canReject   = poS && ['pending', 'ready'].includes(poS)
                const canMarkReady = poS === 'pending'
                const canMarkHub   = poS === 'ready'
                const isMenuOpen   = openMenuId === order.id
                const isUpdating   = statusUpdating === order.id

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
                          {poPickupMethods[order.id] === 'farm_pickup' ? '🚜 Farm pickup' : order.fulfillment_type === 'hub_pickup' ? '🏭 Hub' : '🚚 Delivery'}
                        </div>
                      </td>

                      {/* Date */}
                      <td style={{ ...td, opacity: 0.6, whiteSpace: 'nowrap' as const }}>
                        {formatAEST(order.created_at, 'dd MMM yyyy')}
                      </td>

                      {/* Buyer */}
                      <td style={{ ...td, fontSize: '0.8rem' }}>
                        {order.profiles?.business_name || order.profiles?.full_name || '—'}
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

                      {/* Actions — three-dot menu */}
                      <td style={{ ...td, textAlign: 'right' as const }} onClick={e => e.stopPropagation()}>
                        <div
                          ref={el => { menuRefs.current[order.id] = el }}
                          style={{ position: 'relative', display: 'inline-block' }}
                        >
                          <button
                            onClick={() => setOpenMenuId(isMenuOpen ? null : order.id)}
                            disabled={isUpdating}
                            aria-label="Order actions"
                            style={{
                              width: '2rem', height: '2rem', borderRadius: '50%',
                              background: isMenuOpen ? 'var(--forest)' : 'var(--offwhite, #f5f4ef)',
                              border: '1px solid var(--olive)', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '1.1rem', color: isMenuOpen ? 'white' : 'var(--forest)',
                              fontWeight: 700, transition: 'all 0.15s', fontFamily: 'var(--font-body)',
                            }}
                          >
                            {isUpdating ? '…' : '⋯'}
                          </button>

                          {isMenuOpen && (
                            <div style={{
                              position: 'absolute', top: '2.25rem', right: 0, zIndex: 200,
                              background: 'white', borderRadius: '0.75rem',
                              boxShadow: '0 4px 24px rgba(30,37,53,0.14)',
                              border: '1px solid var(--olive)',
                              minWidth: '13rem', overflow: 'hidden',
                            }}>
                              {/* View PO — always */}
                              <Link
                                href={`/dashboard/farmer/orders/${order.id}/po`}
                                prefetch={false}
                                onClick={() => setOpenMenuId(null)}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.7rem 1rem', fontSize: '0.85rem', color: 'var(--forest)', textDecoration: 'none', borderBottom: (canMarkReady || canMarkHub || canReject) ? '1px solid var(--olive)' : 'none' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--olive)')}
                                onMouseLeave={e => (e.currentTarget.style.background = '')}
                              >
                                <span style={{ width: '1.25rem', textAlign: 'center' }}>📋</span>
                                View PO
                              </Link>

                              {/* Mark as Ready */}
                              {canMarkReady && (
                                <button
                                  onClick={() => { setOpenMenuId(null); setConfirmAction({ orderId: order.id, orderNumber: order.order_number, newStatus: 'ready', label: 'Mark items as ready' }) }}
                                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.7rem 1rem', fontSize: '0.85rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: '#065F46', fontFamily: 'var(--font-body)' }}
                                  onMouseEnter={e => (e.currentTarget.style.background = '#D1FAE5')}
                                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                                >
                                  <span style={{ width: '1.25rem', textAlign: 'center' }}>✅</span>
                                  Mark items ready
                                </button>
                              )}

                              {/* Mark as Delivered to Hub */}
                              {canMarkHub && (
                                <button
                                  onClick={() => { setOpenMenuId(null); setConfirmAction({ orderId: order.id, orderNumber: order.order_number, newStatus: 'delivered_to_hub', label: 'Mark as delivered to hub' }) }}
                                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.7rem 1rem', fontSize: '0.85rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', color: '#1E40AF', fontFamily: 'var(--font-body)' }}
                                  onMouseEnter={e => (e.currentTarget.style.background = '#DBEAFE')}
                                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                                >
                                  <span style={{ width: '1.25rem', textAlign: 'center' }}>🏭</span>
                                  Delivered to hub
                                </button>
                              )}

                              {/* Reject PO */}
                              {canReject && rejectingId !== order.id && (
                                <button
                                  onClick={() => { setOpenMenuId(null); setRejectingId(order.id); setRejectReason('') }}
                                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.7rem 1rem', fontSize: '0.85rem', background: 'none', border: 'none', borderTop: '1px solid var(--olive)', cursor: 'pointer', textAlign: 'left', color: '#B91C1C', fontFamily: 'var(--font-body)' }}
                                  onMouseEnter={e => (e.currentTarget.style.background = '#FEE2E2')}
                                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                                >
                                  <span style={{ width: '1.25rem', textAlign: 'center' }}>🚫</span>
                                  Reject PO
                                </button>
                              )}
                            </div>
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
                            {poIds[order.id] && (
                              <div style={{ marginTop: '1.25rem', maxWidth: '32rem' }}>
                                <MessageThread purchaseOrderId={poIds[order.id]} title={`Messages with ${order.profiles?.business_name || order.profiles?.full_name || 'buyer'}`} />
                              </div>
                            )}
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
