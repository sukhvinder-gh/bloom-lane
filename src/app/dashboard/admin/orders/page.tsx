'use client'
import { useState, useEffect, useRef } from 'react'
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
  disputed: [
    { status: 'delivered',        label: 'Resolve — Delivered', icon: '✓' },
    { status: 'refunded',         label: 'Resolve — Refund',    icon: '↩' },
  ],
}

function OrderActionsMenu({ order, onUpdate, loading }: { order: any; onUpdate: (id: string, status: string) => void; loading: boolean }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const actions = STATUS_ACTIONS[order.status] || []

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [open])

  if (actions.length === 0) return <span style={{ fontSize: '0.75rem', color: 'var(--moss)', paddingLeft: '0.5rem' }}>—</span>

  const menuItemBase: React.CSSProperties = {
    width: '100%', display: 'flex', alignItems: 'center', gap: '0.625rem',
    padding: '0.7rem 1rem', fontSize: '0.85rem', background: 'none', border: 'none',
    fontFamily: 'var(--font-body)', cursor: 'pointer', textAlign: 'left',
  }

  return (
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
              onClick={() => { onUpdate(order.id, action.status); setOpen(false) }}
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
  )
}

export default function AdminOrdersPage() {
  const [orders, setOrders]       = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [view, setView]           = useState<View>('orders')
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/orders').then(r => r.json()).then(d => { setOrders(d.data || []); setLoading(false) })
  }, [])

  async function updateStatus(orderId: string, status: string) {
    setUpdatingId(orderId)
    await fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setOrders(os => os.map(o => o.id === orderId ? { ...o, status } : o))
    setUpdatingId(null)
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
      <h1 className="type-heading reveal" style={{ color: 'var(--forest)', marginBottom: '2rem' }}>Order Management</h1>

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
                    {['Order #', 'Buyer', 'Fulfillment', 'Items', 'Status', 'Total', 'Actions'].map(h => (
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
                        <AdminStatusBadge status={order.status} />
                      </td>
                      <td style={{ padding: '0.875rem 1.25rem' }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--forest)', letterSpacing: '-0.02em' }}>{formatPrice(order.total_cents)}</span>
                      </td>
                      <td style={{ padding: '0.875rem 1.25rem' }}>
                        <OrderActionsMenu order={order} onUpdate={updateStatus} loading={updatingId === order.id} />
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
