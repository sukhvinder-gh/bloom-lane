'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatAEST } from '@/lib/utils/timezone'
import { PrintButton } from '@/components/PrintButton'

function fmtShort(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

type Item = { id: string; quantity: number; notes: string | null; packed_at: string | null; products: { name: string; unit: string } | null }
type Order = {
  id: string; order_number: string; created_at: string; grower_fulfillment_date: string
  fulfillment_type: string; pickup_method: string | null; buyer_name: string
  items: Item[]; all_packed: boolean; overdue: boolean
}

export default function PackListPage() {
  const [mode, setMode] = useState<'range' | 'day'>('range')
  // Left null until the server tells us what "this week" means (computed
  // in Sydney time server-side — see the harvest-list page for why the
  // client doesn't do this calculation itself).
  const [from, setFrom] = useState<string | null>(null)
  const [to, setTo] = useState<string | null>(null)
  const [data, setData] = useState<{ orders: Order[]; order_count: number; unscheduled_order_count: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())

  async function load(f?: string | null, t?: string | null) {
    setLoading(true)
    const qs = f && t ? `?from=${f}&to=${t}` : ''
    try {
      const res = await fetch(`/api/farmer/pack-list${qs}`)
      const json = await res.json()
      setData(json.data)
      setFrom(json.data.from)
      setTo(json.data.to)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function resetToThisWeek() {
    setMode('range')
    load()
  }

  async function toggleItem(orderId: string, item: Item) {
    const nextPacked = !item.packed_at
    setBusyIds(s => new Set(s).add(item.id))
    setData(d => {
      if (!d) return d
      return {
        ...d,
        orders: d.orders.map(o => {
          if (o.id !== orderId) return o
          const items = o.items.map(i => i.id === item.id ? { ...i, packed_at: nextPacked ? new Date().toISOString() : null } : i)
          const allPacked = items.length > 0 && items.every(i => !!i.packed_at)
          return { ...o, items, all_packed: allPacked, overdue: allPacked ? false : o.overdue }
        }),
      }
    })
    const res = await fetch('/api/farmer/pack-list', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: item.id, packed: nextPacked }),
    })
    if (!res.ok) load(from, to)
    setBusyIds(s => { const n = new Set(s); n.delete(item.id); return n })
  }

  async function toggleOrder(order: Order) {
    const nextPacked = !order.all_packed
    setBusyIds(s => {
      const n = new Set(s)
      order.items.forEach(i => n.add(i.id))
      return n
    })
    setData(d => d ? {
      ...d,
      orders: d.orders.map(o => o.id === order.id
        ? { ...o, all_packed: nextPacked, overdue: nextPacked ? false : o.overdue, items: o.items.map(i => ({ ...i, packed_at: nextPacked ? new Date().toISOString() : null })) }
        : o),
    } : d)
    const res = await fetch('/api/farmer/pack-list', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: order.id, packed: nextPacked }),
    })
    if (!res.ok) load(from, to)
    setBusyIds(s => {
      const n = new Set(s)
      order.items.forEach(i => n.delete(i.id))
      return n
    })
  }

  const orders = data?.orders || []

  return (
    <div className="page-pad" style={{ padding: '2.5rem', maxWidth: '860px', margin: '0 auto' }}>
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <Link href="/dashboard/farmer/orders" className="btn btn-ghost btn-sm">← Orders</Link>
        <span style={{ flex: 1 }} />
        <Link href="/dashboard/farmer/harvest-list" className="btn btn-outline btn-sm">🌾 Harvest List</Link>
        <Link href="/dashboard/farmer/pack-list/labels" className="btn btn-outline btn-sm">🏷 Print labels</Link>
        <PrintButton label="Print" />
      </div>

      {/* Date filter */}
      <div className="no-print card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {(['range', 'day'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{ padding: '0.4rem 0.9rem', borderRadius: '99px', border: '1.5px solid var(--olive)', background: mode === m ? 'var(--forest)' : 'white', color: mode === m ? 'white' : 'var(--forest)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, fontFamily: 'var(--font-body)' }}
            >
              {m === 'range' ? 'Date range' : 'Single date'}
            </button>
          ))}
        </div>
        {mode === 'range' ? (
          <>
            <div><label className="label">From</label><input type="date" className="input" value={from ?? ''} onChange={e => load(e.target.value, to)} /></div>
            <div><label className="label">To</label><input type="date" className="input" value={to ?? ''} onChange={e => load(from, e.target.value)} /></div>
          </>
        ) : (
          <div><label className="label">Date</label><input type="date" className="input" value={from ?? ''} onChange={e => load(e.target.value, e.target.value)} /></div>
        )}
        <button onClick={resetToThisWeek} className="btn btn-ghost btn-sm">This week</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ background: 'white', border: '1px solid var(--olive)', borderRadius: '1.5rem', padding: '2rem 2.5rem' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', color: 'var(--forest)', letterSpacing: '-0.02em' }}>Pack List</div>
          <p style={{ fontSize: '0.85rem', color: 'var(--moss)', marginTop: '0.25rem' }}>
            {data?.order_count ?? 0} order{(data?.order_count ?? 0) === 1 ? '' : 's'} to pack{from && to ? ` · ${fmtShort(from)}${from !== to ? ` – ${fmtShort(to)}` : ''}` : ''}
          </p>
          {!!data?.unscheduled_order_count && (
            <p className="no-print" style={{ fontSize: '0.78rem', color: '#92400e', marginTop: '0.75rem', background: '#fef9c3', padding: '0.6rem 0.875rem', borderRadius: '0.625rem' }}>
              ⚠ {data.unscheduled_order_count} active order{data.unscheduled_order_count === 1 ? '' : 's'} {data.unscheduled_order_count === 1 ? "doesn't" : "don't"} have a harvest date set yet, so {data.unscheduled_order_count === 1 ? "it isn't" : "they aren't"} shown here — check with admin.
            </p>
          )}
        </div>

        {loading ? (
          <div style={{ background: 'white', border: '1px solid var(--olive)', borderRadius: '1.5rem', padding: '3rem', textAlign: 'center', color: 'var(--moss)' }}>Loading…</div>
        ) : orders.length === 0 ? (
          <div style={{ background: 'white', border: '1px solid var(--olive)', borderRadius: '1.5rem', padding: '3rem', textAlign: 'center', color: 'var(--moss)' }}>
            Nothing to pack in this date range.
          </div>
        ) : (
          orders.map(order => (
            <div key={order.id} style={{ background: order.overdue ? '#fef2f2' : 'white', border: order.overdue ? '1.5px solid #FCA5A5' : '1px solid var(--olive)', borderRadius: '1.5rem', padding: '1.75rem 2.5rem', breakInside: 'avoid' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid var(--forest)', paddingBottom: '0.75rem', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <label className="no-print" style={{ display: 'flex', alignItems: 'center', cursor: busyIds.has(order.items[0]?.id) ? 'wait' : 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={order.all_packed}
                      onChange={() => toggleOrder(order)}
                      aria-label={`Mark whole order ${order.order_number} as packed`}
                      style={{ width: '1.5rem', height: '1.5rem', accentColor: 'var(--forest)', marginRight: '0.75rem' }}
                    />
                  </label>
                  <div>
                    <span style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--forest)', textDecoration: order.all_packed ? 'line-through' : 'none', opacity: order.all_packed ? 0.6 : 1 }}>{order.buyer_name}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--moss)', marginLeft: '0.75rem' }}>
                      {order.pickup_method === 'farm_pickup' ? '🚜 Farm pickup' : order.fulfillment_type === 'hub_pickup' ? '🏭 Hub pickup' : '🚚 Direct delivery'}
                    </span>
                    {order.overdue && (
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.68rem', fontWeight: 700, color: '#B91C1C', background: '#FEE2E2', border: '1px solid #FCA5A5', padding: '0.15rem 0.5rem', borderRadius: '99px' }}>
                        ⚠ Not fulfilled
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--moss)' }}>
                  {order.order_number} · {formatAEST(order.grower_fulfillment_date, 'dd MMM')}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {order.items.map(item => (
                  <div key={item.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.95rem' }}>
                      <input
                        type="checkbox"
                        className="no-print"
                        checked={!!item.packed_at}
                        onChange={() => toggleItem(order.id, item)}
                        disabled={busyIds.has(item.id)}
                        aria-label={`Mark ${item.products?.name} as packed`}
                        style={{ width: '1.35rem', height: '1.35rem', accentColor: 'var(--forest)', cursor: busyIds.has(item.id) ? 'wait' : 'pointer', flexShrink: 0 }}
                      />
                      <span style={{ color: 'var(--forest)', fontWeight: 600, flex: 1, textDecoration: item.packed_at ? 'line-through' : 'none', opacity: item.packed_at ? 0.6 : 1 }}>{item.products?.name}</span>
                      <span style={{ color: 'var(--forest)', fontFamily: 'var(--font-display)' }}>{item.quantity} <span style={{ fontSize: '0.75rem', color: 'var(--moss)', fontFamily: 'var(--font-body)' }}>{item.products?.unit}</span></span>
                    </div>
                    {item.notes && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--moss)', fontStyle: 'italic', marginLeft: '2.1rem', marginTop: '0.15rem' }}>📝 {item.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
