import { getSessionUserFromCookie, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PrintButton } from '@/components/PrintButton'

const ACTIVE_PO_STATUSES = ['pending', 'ready']

export default async function HarvestListPage() {
  const sessionUser = await getSessionUserFromCookie()
  if (!sessionUser) redirect('/auth/login')

  const admin = createAdminClient()

  const { data: farmers } = await admin
    .from('farmers').select('id, business_name').eq('user_id', sessionUser.id).limit(1)
  const farmer = farmers?.[0] ?? null
  if (!farmer) redirect('/dashboard')

  // Every order this farmer still needs to fulfil this cycle — not yet
  // packed off to the hub/courier, and not rejected.
  const { data: pos } = await admin
    .from('purchase_orders')
    .select('order_id')
    .eq('farmer_id', farmer.id)
    .in('status', ACTIVE_PO_STATUSES)

  const orderIds = [...new Set((pos || []).map(p => p.order_id))]

  const { data: items } = orderIds.length > 0
    ? await admin
        .from('order_items')
        .select('id, order_id, quantity, products(name, unit, category)')
        .eq('farmer_id', farmer.id)
        .in('order_id', orderIds)
    : { data: [] as any[] }

  // Aggregate across every active order — a grower cuts once for the whole
  // week's demand, not order by order.
  const byProduct = new Map<string, { name: string; unit: string; category: string; qty: number; orders: Set<string> }>()
  for (const item of items || []) {
    const p = (item as any).products
    const key = p?.name + '|' + p?.unit
    const entry = byProduct.get(key) || { name: p?.name || 'Unknown', unit: p?.unit || '', category: p?.category || '', qty: 0, orders: new Set() }
    entry.qty += item.quantity
    entry.orders.add(item.order_id)
    byProduct.set(key, entry)
  }

  const rows = [...byProduct.values()].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className="page-pad" style={{ padding: '2.5rem', maxWidth: '860px', margin: '0 auto' }}>
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <Link href="/dashboard/farmer/orders" className="btn btn-ghost btn-sm">← Orders</Link>
        <span style={{ flex: 1 }} />
        <Link href="/dashboard/farmer/pack-list" className="btn btn-outline btn-sm">📦 Pack List</Link>
        <PrintButton label="Print" />
      </div>

      <div style={{ background: 'white', border: '1px solid var(--olive)', borderRadius: '1.5rem', padding: '2.5rem' }}>
        <div style={{ borderBottom: '2px solid var(--forest)', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', color: 'var(--forest)', letterSpacing: '-0.02em' }}>Harvest List</div>
          <p style={{ fontSize: '0.85rem', color: 'var(--moss)', marginTop: '0.25rem' }}>
            {farmer.business_name} · totals across {orderIds.length} active order{orderIds.length === 1 ? '' : 's'}
          </p>
        </div>

        {rows.length === 0 ? (
          <p style={{ color: 'var(--moss)', textAlign: 'center', padding: '3rem 0' }}>Nothing to harvest right now — no active orders.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--forest)' }}>
                {['Product', 'Total to cut', 'Orders'].map((h, i) => (
                  <th key={h} style={{ padding: '0.75rem', textAlign: i === 0 ? 'left' : 'right', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--forest)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.name + r.unit} style={{ borderBottom: '1px solid var(--olive)' }}>
                  <td style={{ padding: '1rem 0.75rem', fontSize: '1.1rem', fontWeight: 700, color: 'var(--forest)' }}>{r.name}</td>
                  <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontSize: '1.4rem', fontFamily: 'var(--font-display)', color: 'var(--forest)' }}>
                    {r.qty} <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-body)', color: 'var(--moss)' }}>{r.unit}</span>
                  </td>
                  <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontSize: '0.85rem', color: 'var(--moss)' }}>{r.orders.size}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
