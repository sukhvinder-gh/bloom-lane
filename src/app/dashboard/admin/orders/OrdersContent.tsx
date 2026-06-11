'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils/pricing'
import { formatAEST } from '@/lib/utils/timezone'

type View = 'orders' | 'packing' | 'picking'

function AdminStatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    pending_payment:   ['badge-cream',  '⏳ Pending'],
    payment_confirmed: ['badge-olive',  '💳 Paid'],
    preparing:         ['badge-olive',  '⚙ Preparing'],
    ready_for_pickup:  ['badge-sage',   '📦 Ready'],
    out_for_delivery:  ['badge-sage',   '🚚 Transit'],
    delivered:         ['badge-forest', '✓ Delivered'],
    disputed:          ['badge-red',    '🚨 Disputed'],
    cancelled:         ['badge-cream',  '✕ Cancelled'],
  }
  const [cls, label] = map[status] || ['badge-cream', status]
  return <span className={`badge ${cls}`}>{label}</span>
}

// All valid manual transitions per status
const STATUS_ACTIONS: Record<string, Array<{ status: string; label: string; icon: string; danger?: boolean }>> = {
  payment_confirmed: [
    { status: 'preparing',        label: 'Mark Preparing',  icon: '⚙' },
    { status: 'cancelled',        label: 'Cancel Order',    icon: '✕', danger: true },
  ],
  preparing: [
    { status: 'ready_for_pickup', label: 'Mark Ready',      icon: '📦' },
    { status: 'cancelled',        label: 'Cancel Order',    icon: '✕', danger: true },
  ],
  ready_for_pickup: [
    { status: 'out_for_delivery', label: 'Mark Dispatched', icon: '🚚' },
    { status: 'delivered',        label: 'Mark Delivered',  icon: '✓' },
  ],
  out_for_delivery: [
    { status: 'delivered',        label: 'Mark Delivered',  icon: '✓' },
  ],
  delivered: [
    { status: '_gen_payouts',     label: 'Generate Payouts', icon: '💸' },
  ],
  disputed: [
    { status: 'delivered',        label: 'Resolve — Delivered', icon: '✓' },
    { status: 'refunded',         label: 'Resolve — Refund',    icon: '↩' },
  ],
}

function OrderActionsMenu({ order, onUpdate, loading }: { order: any; onUpdate: (id: string, status: string) => void; loading: boolean }) {
  const [open, setOpen] = useState(false)
  const [genPayoutsMsg, setGenPayoutsMsg] = useState('')
  const [confirm, setConfirm] = useState<{ status: string; label: string; danger?: boolean } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const actions = STATUS_ACTIONS[order.status] || []

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  async function handleAction(status: string) {
    setOpen(false)
    if (status === '_gen_payouts') {
      const res = await fetch(`/api/admin/orders/${order.id}/generate-payouts`, { method: 'POST' })
      const data = await res.json()
      setGenPayoutsMsg(data.created?.length ? `✓ ${data.created.length} payout(s) created` : `Already generated (${data.skipped} skipped)`)
      setTimeout(() => setGenPayoutsMsg(''), 4000)
    } else {
      const action = actions.find(a => a.status === status)
      setConfirm({ status, label: action?.label || status, danger: action?.danger })
    }
  }

  function confirmAction() {
    if (!confirm) return
    onUpdate(order.id, confirm.status)
    setConfirm(null)
  }

  if (actions.length === 0 && !genPayoutsMsg) return <span style={{ fontSize: '0.75rem', color: 'var(--moss)', paddingLeft: '0.5rem' }}>—</span>
  if (genPayoutsMsg) return <span style={{ fontSize: '0.75rem', color: 'var(--forest)', fontWeight: 700 }}>{genPayoutsMsg}</span>

  const menuItemBase: React.CSSProperties = {
    width: '100%', display: 'flex', alignItems: 'center', gap: '0.625rem',
    padding: '0.7rem 1rem', fontSize: '0.85rem', background: 'none', border: 'none',
    fontFamily: 'var(--font-body)', cursor: 'pointer', textAlign: 'left',
  }

  return (
    <>
      {/* Confirmation modal */}
      {confirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setConfirm(null)}>
          <div style={{ background: 'white', borderRadius: '1.25rem', padding: '2rem', maxWidth: '22rem', width: '90%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}
            onClick={e => e.stopPropagation()}>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--forest)', marginBottom: '0.625rem' }}>Confirm status change</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--moss)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Change <strong style={{ color: 'var(--forest)' }}>{order.order_number}</strong> to:<br />
              <strong style={{ color: confirm.danger ? '#b91c1c' : 'var(--navy)', fontSize: '1rem' }}>{confirm.label}</strong>
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setConfirm(null)}
                style={{ flex: 1, padding: '0.625rem', borderRadius: '99px', border: '1px solid var(--border)', background: 'white', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: 'var(--moss)', fontFamily: 'var(--font-body)' }}>
                Cancel
              </button>
              <button onClick={confirmAction}
                style={{ flex: 1, padding: '0.625rem', borderRadius: '99px', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700, fontFamily: 'var(--font-body)', background: confirm.danger ? '#b91c1c' : 'var(--navy)', color: 'white' }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <div ref={menuRef} style={{ position: 'relative', display: 'inline-block' }}>
        <button
          onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
          disabled={loading}
          aria-label="Order actions"
          style={{
            width: '2rem', height: '2rem', borderRadius: '50%',
            background: open ? 'var(--navy)' : 'var(--offwhite)',
            border: '1px solid var(--border)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.1rem', color: open ? 'white' : 'var(--navy)', fontWeight: 700,
            transition: 'all 0.15s',
          }}
        >
          {loading ? '…' : '⋮'}
        </button>

        {open && (
          <div style={{
            position: 'absolute', top: '2.25rem', right: 0, zIndex: 100,
            background: 'white', borderRadius: '0.75rem',
            boxShadow: '0 4px 24px rgba(30,37,53,0.14)',
            border: '1px solid var(--border-light)',
            minWidth: '13rem', overflow: 'hidden',
          }}>
            {actions.map(action => (
              <button
                key={action.status}
                onClick={() => handleAction(action.status)}
                style={{ ...menuItemBase, color: action.danger ? 'var(--bloom)' : 'var(--navy)' }}
                onMouseEnter={e => (e.currentTarget.style.background = action.danger ? 'var(--bloom-soft)' : 'var(--offwhite)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <span style={{ width: '1.25rem', textAlign: 'center' }}>{action.icon}</span>
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

function DateManager({ order, onUpdate }: { order: any; onUpdate: (id: string, field: string, value: string) => void }) {
  const [open, setOpen] = useState(false)
  const [fulfillDate, setFulfillDate] = useState(order.grower_fulfillment_date ? order.grower_fulfillment_date.slice(0, 16) : '')
  const [deliveryDate, setDeliveryDate] = useState(order.florist_delivery_date ? order.florist_delivery_date.slice(0, 16) : '')
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function outside(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    if (open) document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [open])

  async function save() {
    setSaving(true)
    await fetch(`/api/admin/orders/${order.id}/dates`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grower_fulfillment_date: fulfillDate || null, florist_delivery_date: deliveryDate || null }),
    })
    onUpdate(order.id, 'grower_fulfillment_date', fulfillDate)
    onUpdate(order.id, 'florist_delivery_date', deliveryDate)
    setSaving(false)
    setOpen(false)
  }

  const hasDates = order.grower_fulfillment_date || order.florist_delivery_date
  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setOpen(o => !o)}
        title="Set fulfillment / delivery dates"
        style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: hasDates ? 'var(--olive)' : 'var(--offwhite)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', transition: 'all 0.15s' }}
      >📅</button>
      {open && (
        <div style={{ position: 'absolute', top: '2.25rem', right: 0, zIndex: 100, background: 'white', borderRadius: '1rem', boxShadow: '0 4px 24px rgba(30,37,53,0.14)', border: '1px solid var(--border-light)', padding: '1.25rem', minWidth: '17rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <p className="type-label-sm" style={{ color: 'var(--forest)', fontWeight: 700 }}>Fulfilment &amp; Delivery Dates</p>
          <div>
            <label className="type-label-sm" style={{ color: 'var(--moss)', display: 'block', marginBottom: '0.3rem' }}>Grower fulfils by</label>
            <input type="datetime-local" className="input" style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
              value={fulfillDate} onChange={e => setFulfillDate(e.target.value)} />
          </div>
          <div>
            <label className="type-label-sm" style={{ color: 'var(--moss)', display: 'block', marginBottom: '0.3rem' }}>Florist delivery date</label>
            <input type="datetime-local" className="input" style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
              value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)} />
          </div>
          <button onClick={save} disabled={saving} className="btn btn-forest btn-sm">{saving ? 'Saving…' : 'Save dates'}</button>
        </div>
      )}
    </div>
  )
}

export default function OrdersContent({ initialOrders, initialRejectedPOs }: { initialOrders: any[]; initialRejectedPOs: any[] }) {
  const [orders, setOrders]       = useState<any[]>(initialOrders)
  const [loading, setLoading]     = useState(false)
  const [view, setView]           = useState<View>('orders')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const [rejectedPOs, setRejectedPOs] = useState<any[]>(initialRejectedPOs)

  async function updateStatus(orderId: string, status: string) {
    setUpdatingId(orderId)
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      setOrders(os => os.map(o => o.id === orderId ? { ...o, status } : o))
    } else {
      const data = await res.json()
      alert(`Failed to update status: ${data.error || 'Unknown error'}`)
    }
    setUpdatingId(null)
  }

  function updateOrderField(orderId: string, field: string, value: string) {
    setOrders(os => os.map(o => o.id === orderId ? { ...o, [field]: value } : o))
  }

  const packingList = orders.filter(o => ['payment_confirmed', 'preparing'].includes(o.status))
  const pickingMap: Record<string, { farmer: any; items: any[]; total: number }> = {}
  packingList.forEach(order => order.order_items?.forEach((item: any) => {
    if (!pickingMap[item.farmer_id]) pickingMap[item.farmer_id] = { farmer: item.farmers, items: [], total: 0 }
    pickingMap[item.farmer_id].items.push({ ...item, order_number: order.order_number })
    pickingMap[item.farmer_id].total += item.subtotal_cents
  }))

  const TABS: { id: View; label: string; icon: string }[] = [
    { id: 'orders',  label: 'All Orders',   icon: '📋' },
    { id: 'packing', label: 'Packing List',  icon: '📦' },
    { id: 'picking', label: 'Picking List',  icon: '🌿' },
  ]

  return (
    <div className="page-pad" style={{ padding: '2.5rem' }}>
      <h1 className="type-heading reveal" style={{ color: 'var(--forest)', marginBottom: rejectedPOs.length ? '1rem' : '2rem' }}>Order Management</h1>

      {rejectedPOs.length > 0 && (
        <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '1rem', padding: '1rem 1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
          <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>🚫</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700, color: '#b91c1c', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              {rejectedPOs.length} PO{rejectedPOs.length > 1 ? 's' : ''} rejected by growers — action required
            </p>
            {rejectedPOs.slice(0, 3).map((po: any) => (
              <p key={po.id} style={{ fontSize: '0.8rem', color: '#b91c1c', opacity: 0.8, marginTop: '0.2rem' }}>
                · {po.farmers?.business_name} — Order {po.orders?.order_number}: "{po.rejection_reason}"
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.75rem' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setView(t.id)} className={`btn btn-sm ${view === t.id ? 'btn-forest' : 'btn-outline'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="card" style={{ height: '4rem', background: 'var(--olive)' }} />)}
        </div>
      ) : (
        <>
          {/* ── All Orders ── */}
          {view === 'orders' && (
            <div className="card reveal" style={{ overflow: 'visible' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: 'var(--olive)', borderBottom: '1px solid var(--sage)' }}>
                    {['Order #', 'Buyer', 'Fulfillment', 'Items', 'Dates', 'Status', 'Total', 'Actions'].map(h => (
                      <th key={h} className="type-label-sm" style={{ padding: '1rem 1.25rem', textAlign: 'left', color: 'var(--moss)', letterSpacing: '0.2em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.id} className="table-row">
                      <td style={{ padding: '0.875rem 1.25rem' }}>
                        <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.875rem', color: 'var(--forest)', letterSpacing: '-0.01em', textTransform: 'uppercase' }}>{order.order_number}</p>
                        <p className="type-label-sm" style={{ color: 'var(--moss)' }}>{formatAEST(order.created_at, 'dd MMM, h:mma')}</p>
                      </td>
                      <td style={{ padding: '0.875rem 1.25rem' }}>
                        <p style={{ fontWeight: 700, color: 'var(--forest)' }}>{order.profiles?.full_name}</p>
                      </td>
                      <td style={{ padding: '0.875rem 1.25rem', fontSize: '1.25rem' }}>
                        {order.fulfillment_type === 'hub_pickup' ? '🏭' : '🚚'}
                      </td>
                      <td style={{ padding: '0.875rem 1.25rem' }}>
                        <span className="type-label-sm" style={{ color: 'var(--moss)' }}>{order.order_items?.length || 0} items</span>
                      </td>
                      <td style={{ padding: '0.875rem 1.25rem' }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--moss)', whiteSpace: 'nowrap' }}>
                          {order.grower_fulfillment_date
                            ? <div>🌿 {formatAEST(order.grower_fulfillment_date, 'dd MMM, h:mma')}</div>
                            : <div style={{ opacity: 0.4 }}>🌿 —</div>}
                          {order.florist_delivery_date
                            ? <div style={{ marginTop: '0.15rem' }}>🚚 {formatAEST(order.florist_delivery_date, 'dd MMM, h:mma')}</div>
                            : <div style={{ marginTop: '0.15rem', opacity: 0.4 }}>🚚 —</div>}
                        </div>
                      </td>
                      <td style={{ padding: '0.875rem 1.25rem' }}>
                        <AdminStatusBadge status={order.status} />
                      </td>
                      <td style={{ padding: '0.875rem 1.25rem' }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--forest)', letterSpacing: '-0.02em' }}>{formatPrice(order.total_cents)}</span>
                      </td>
                      <td style={{ padding: '0.875rem 1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <DateManager order={order} onUpdate={updateOrderField} />
                          <OrderActionsMenu order={order} onUpdate={updateStatus} loading={updatingId === order.id} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Packing List ── */}
          {view === 'packing' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="card-sage reveal" style={{ padding: '1.25rem 1.75rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '2rem' }}>📦</span>
                <div>
                  <p className="type-label" style={{ color: 'var(--forest)', marginBottom: '0.2rem' }}>Packing list — {packingList.length} orders to pack</p>
                  <p className="type-label-sm" style={{ color: 'var(--moss)' }}>Each bag contains all items for one buyer. Print and attach to bag.</p>
                </div>
              </div>
              {packingList.map(order => (
                <div key={order.id} className="card reveal" style={{ overflow: 'hidden' }}>
                  <div style={{ padding: '1rem 1.75rem', background: 'var(--olive)', borderBottom: '1px solid var(--sage)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--forest)', textTransform: 'uppercase', letterSpacing: '-0.01em' }}>{order.order_number}</p>
                      <p className="type-label-sm" style={{ color: 'var(--moss)' }}>{order.profiles?.full_name} · {order.fulfillment_type === 'hub_pickup' ? '🏭 Hub' : `🚚 ${order.delivery_suburb}`}</p>
                    </div>
                    {order.qr_code_url && <img src={order.qr_code_url} alt="QR" style={{ width: '3.5rem', height: '3.5rem', borderRadius: '0.625rem' }} />}
                  </div>
                  {order.order_items?.map((item: any) => (
                    <div key={item.id} style={{ padding: '0.875rem 1.75rem', borderBottom: '1px solid var(--olive)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ width: '1.25rem', height: '1.25rem', borderRadius: '0.25rem', border: '2px solid var(--sage)', flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--forest)' }}>{item.products?.name} × {item.quantity}</p>
                        <p className="type-label-sm" style={{ color: 'var(--moss)' }}>from {item.farmers?.business_name}</p>
                      </div>
                      {item.ppod_url ? <span className="badge badge-sage">✓ PPOD</span> : <span className="badge badge-olive">No PPOD</span>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* ── Picking List ── */}
          {view === 'picking' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="card reveal" style={{ padding: '1.25rem 1.75rem', display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--olive)' }}>
                <span style={{ fontSize: '2rem' }}>🌿</span>
                <div>
                  <p className="type-label" style={{ color: 'var(--forest)', marginBottom: '0.2rem' }}>Picking list — {Object.keys(pickingMap).length} growers to notify</p>
                  <p className="type-label-sm" style={{ color: 'var(--moss)' }}>Share each grower's list so they know what to bring to the Hub.</p>
                </div>
              </div>
              {Object.values(pickingMap).map((entry, i) => (
                <div key={i} className="card reveal" style={{ overflow: 'hidden' }}>
                  <div style={{ padding: '1rem 1.75rem', background: 'var(--sage)', borderBottom: '1px solid var(--moss)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                      <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '50%', background: entry.farmer?.brand_color || 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cream)', fontFamily: 'var(--font-display)', fontSize: '1rem' }}>{entry.farmer?.business_name?.[0]}</div>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--forest)' }}>{entry.farmer?.business_name}</p>
                        <p className="type-label-sm" style={{ color: 'rgba(1,71,46,0.5)' }}>{entry.items.length} items to bring</p>
                      </div>
                    </div>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--forest)', letterSpacing: '-0.03em' }}>{formatPrice(entry.total)}</span>
                  </div>
                  {entry.items.map((item: any, j: number) => (
                    <div key={j} style={{ padding: '0.875rem 1.75rem', borderBottom: '1px solid var(--olive)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                        <div style={{ width: '1.25rem', height: '1.25rem', borderRadius: '0.25rem', border: '2px solid var(--sage)', flexShrink: 0 }} />
                        <div>
                          <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--forest)' }}>{item.products?.name} — {item.quantity} {item.products?.unit}</p>
                          <p className="type-label-sm" style={{ color: 'var(--moss)' }}>→ Order {item.order_number}</p>
                        </div>
                      </div>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--forest)', letterSpacing: '-0.02em', flexShrink: 0 }}>{formatPrice(item.subtotal_cents)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
