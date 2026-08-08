'use client'
import { useState } from 'react'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils/pricing'
import { formatAEST } from '@/lib/utils/timezone'
import { AUDateTimeInput } from '@/components/AUDateInput'

const STATUS_TRANSITIONS: Record<string, { status: string; label: string; danger?: boolean }[]> = {
  payment_confirmed: [
    { status: 'preparing',        label: 'Mark Preparing' },
    { status: 'cancelled',        label: 'Cancel Order', danger: true },
  ],
  preparing: [
    { status: 'ready_for_pickup', label: 'Mark Ready' },
    { status: 'cancelled',        label: 'Cancel Order', danger: true },
  ],
  ready_for_pickup: [
    { status: 'out_for_delivery', label: 'Mark Dispatched' },
    { status: 'delivered',        label: 'Mark Delivered' },
  ],
  out_for_delivery: [
    { status: 'delivered',        label: 'Mark Delivered' },
  ],
}

const STATUS_LABEL: Record<string, [string, string]> = {
  pending_payment:   ['#d97706', '⏳ Pending payment'],
  payment_confirmed: ['#16a34a', '💳 Paid'],
  preparing:         ['#16a34a', '⚙ Preparing'],
  ready_for_pickup:  ['#0d9488', '📦 Ready'],
  out_for_delivery:  ['#0d9488', '🚚 In transit'],
  delivered:         ['#1a3a2a', '✓ Delivered'],
  disputed:          ['#dc2626', '🚨 Disputed'],
  cancelled:         ['#6b7280', '✕ Cancelled'],
}

export default function AdminOrderDetail({ order }: { order: any }) {
  const [status, setStatus]         = useState(order.status)
  const [updating, setUpdating]     = useState(false)
  const [fulfillDate, setFulfillDate] = useState(order.grower_fulfillment_date?.slice(0, 16) || '')
  const [deliveryDate, setDeliveryDate] = useState(order.florist_delivery_date?.slice(0, 16) || '')
  const [savingDates, setSavingDates] = useState(false)
  const [datesMsg, setDatesMsg]     = useState('')
  const [emailPicker, setEmailPicker] = useState(false)
  const [emailMsg, setEmailMsg]     = useState('')
  const [note, setNote]             = useState('')

  const transitions = STATUS_TRANSITIONS[status] || []
  const [statusColor, statusLabel] = STATUS_LABEL[status] || ['#6b7280', status]

  const buyer   = (order as any).profiles
  const items   = (order as any).order_items || []

  // Group items by farmer
  const byFarmer = new Map<string, { farmer: any; items: any[] }>()
  for (const item of items) {
    const fid = item.farmer_id
    if (!byFarmer.has(fid)) byFarmer.set(fid, { farmer: item.farmers, items: [] })
    byFarmer.get(fid)!.items.push(item)
  }

  async function updateStatus(newStatus: string) {
    if (!confirm(`Change order status to "${newStatus}"?`)) return
    setUpdating(true)
    const res = await fetch(`/api/orders/${order.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) setStatus(newStatus)
    else { const d = await res.json(); alert(d.error || 'Status update failed') }
    setUpdating(false)
  }

  async function saveDates() {
    setSavingDates(true)
    await fetch(`/api/admin/orders/${order.id}/dates`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grower_fulfillment_date: fulfillDate || null, florist_delivery_date: deliveryDate || null }),
    })
    setSavingDates(false)
    setDatesMsg('✓ Dates saved')
    setTimeout(() => setDatesMsg(''), 3000)
  }

  async function sendEmails(sendTo: 'all' | 'buyer' | 'growers') {
    setEmailPicker(false)
    setEmailMsg('Sending…')
    const res = await fetch('/api/admin/resend-order-emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_number: order.order_number, send_to: sendTo }),
    })
    const data = await res.json()
    setEmailMsg(data.allOk ? '✓ Emails sent' : '⚠ Some failed')
    if (!data.allOk) console.error('[resend]', data.results)
    setTimeout(() => setEmailMsg(''), 4000)
  }

  const label = (s: string) => s.replace(/_/g, ' ')

  return (
    <div style={{ padding: '2rem 2.5rem', maxWidth: '900px' }}>

      {/* Email picker modal */}
      {emailPicker && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setEmailPicker(false)}>
          <div style={{ background: 'white', borderRadius: '1.25rem', padding: '2rem', maxWidth: '22rem', width: '90%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}
            onClick={e => e.stopPropagation()}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--forest)', marginBottom: '0.375rem' }}>Send confirmation emails</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--moss)', marginBottom: '1.5rem' }}>{order.order_number} — who should receive this?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {([
                { key: 'all',     label: 'All parties',  desc: 'Buyer + all growers',  icon: '📧' },
                { key: 'buyer',   label: 'Buyer only',   desc: 'Order confirmation',   icon: '🛍️' },
                { key: 'growers', label: 'Growers only', desc: 'Purchase order (PDF)', icon: '🌿' },
              ] as const).map(opt => (
                <button key={opt.key} onClick={() => sendEmails(opt.key)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '0.875rem 1rem', borderRadius: '0.75rem', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)', transition: 'all 0.12s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--offwhite)'; e.currentTarget.style.borderColor = 'var(--navy)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = 'var(--border)' }}>
                  <span style={{ fontSize: '1.25rem' }}>{opt.icon}</span>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--navy)', margin: 0 }}>{opt.label}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--moss)', margin: 0 }}>{opt.desc}</p>
                  </div>
                </button>
              ))}
              <button onClick={() => setEmailPicker(false)}
                style={{ padding: '0.5rem', fontSize: '0.8rem', color: 'var(--moss)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Back */}
      <Link href="/dashboard/admin/orders" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8rem', color: 'var(--moss)', textDecoration: 'none', marginBottom: '1.5rem' }}>
        ← Back to Orders
      </Link>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', color: 'var(--forest)', textTransform: 'uppercase', letterSpacing: '-0.02em', margin: 0 }}>{order.order_number}</h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--moss)', marginTop: '0.25rem' }}>{formatAEST(order.created_at, 'dd MMM yyyy, h:mma')}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {emailMsg
            ? <span style={{ fontSize: '0.8rem', color: 'var(--forest)', fontWeight: 700 }}>{emailMsg}</span>
            : <button onClick={() => setEmailPicker(true)} className="btn btn-outline btn-sm">📧 Send emails</button>
          }
          <span style={{ padding: '0.3rem 0.875rem', borderRadius: '99px', fontSize: '0.8rem', fontWeight: 700, background: statusColor + '22', color: statusColor }}>{statusLabel}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>

        {/* Buyer info */}
        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--moss)', marginBottom: '0.75rem' }}>Buyer</p>
          <p style={{ fontWeight: 700, color: 'var(--forest)', fontSize: '0.95rem' }}>{buyer?.full_name || '—'}</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--moss)', marginTop: '0.2rem' }}>{buyer?.email || '—'}</p>
          <p style={{ fontSize: '0.75rem', color: 'var(--moss)', marginTop: '0.2rem', opacity: 0.7 }}>{order.buyer_is_b2b ? 'B2B Account' : 'B2C / Retail'}</p>
        </div>

        {/* Fulfillment */}
        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--moss)', marginBottom: '0.75rem' }}>Fulfillment</p>
          <p style={{ fontWeight: 700, color: 'var(--forest)', fontSize: '0.95rem' }}>{order.fulfillment_type === 'hub_pickup' ? '🏭 Hub Pickup' : '🚚 Delivery'}</p>
          {order.fulfillment_type === 'direct_delivery' && (
            <p style={{ fontSize: '0.8rem', color: 'var(--moss)', marginTop: '0.2rem' }}>
              {[order.delivery_address, order.delivery_suburb, order.delivery_state].filter(Boolean).join(', ') || '—'}
            </p>
          )}
        </div>

        {/* Dates */}
        <div className="card" style={{ padding: '1.25rem 1.5rem', gridColumn: '1 / -1' }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--moss)', marginBottom: '0.875rem' }}>Dates</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--moss)', display: 'block', marginBottom: '0.3rem' }}>🌿 Grower fulfils by</label>
              <AUDateTimeInput className="input" style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                value={fulfillDate} onChange={setFulfillDate} ariaLabel="Grower fulfils by" />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--moss)', display: 'block', marginBottom: '0.3rem' }}>🚚 Florist delivery date</label>
              <AUDateTimeInput className="input" style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                value={deliveryDate} onChange={setDeliveryDate} ariaLabel="Florist delivery date" />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button onClick={saveDates} disabled={savingDates} className="btn btn-forest btn-sm">{savingDates ? 'Saving…' : 'Save dates'}</button>
            {datesMsg && <span style={{ fontSize: '0.8rem', color: 'var(--forest)', fontWeight: 700 }}>{datesMsg}</span>}
          </div>
        </div>
      </div>

      {/* Order items by grower */}
      <div className="card" style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-light)' }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--moss)', margin: 0 }}>Order Items</p>
        </div>
        {[...byFarmer.values()].map(({ farmer, items: fItems }, i) => (
          <div key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
            <div style={{ padding: '0.75rem 1.5rem', background: 'var(--olive)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--forest)', margin: 0 }}>🌿 {farmer?.business_name}</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--moss)', margin: 0 }}>{farmer?.email || 'no email'}</p>
            </div>
            {fItems.map((item: any) => (
              <div key={item.id} style={{ padding: '0.75rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)' }}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--forest)', margin: 0 }}>{item.products?.name}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--moss)', margin: 0 }}>{item.quantity} × {item.products?.unit} · {formatPrice(item.unit_price_cents)} each</p>
                </div>
                <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--forest)', margin: 0 }}>{formatPrice(item.subtotal_cents)}</p>
              </div>
            ))}
          </div>
        ))}

        {/* Totals */}
        <div style={{ padding: '1rem 1.5rem', background: 'var(--offwhite)' }}>
          {[
            ['Subtotal', order.subtotal_cents],
            ['GST', order.gst_cents],
            ['Delivery fee', order.delivery_fee_cents],
          ].map(([lbl, val]) => val > 0 && (
            <div key={String(lbl)} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--moss)', marginBottom: '0.3rem' }}>
              <span>{String(lbl)}</span><span>{formatPrice(Number(val))}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1rem', color: 'var(--forest)', paddingTop: '0.5rem', borderTop: '1px solid var(--border-light)', marginTop: '0.25rem' }}>
            <span>Total</span><span>{formatPrice(order.total_cents)}</span>
          </div>
        </div>
      </div>

      {/* Status actions */}
      {transitions.length > 0 && (
        <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--moss)', marginBottom: '0.875rem' }}>Change Status</p>
          <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
            {transitions.map(t => (
              <button key={t.status} onClick={() => updateStatus(t.status)} disabled={updating}
                className={`btn btn-sm ${t.danger ? 'btn-bloom' : 'btn-forest'}`}>
                {label(t.label)}
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
