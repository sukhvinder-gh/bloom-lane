import { getSessionUserFromCookie, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatPrice } from '@/lib/utils/pricing'
import { formatAEST } from '@/lib/utils/timezone'
import Link from 'next/link'
import { AUDateInput } from '@/components/AUDateInput'

// Farm-scoped counterpart to the admin invoice ledger — a grower's own
// transaction record, strictly limited to their own order_items. Never
// their whole order's total (an order can span other farms too) and never
// another farm's line items, even on a shared order.
const PAID_STATUSES = ['payment_confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'resolved']

export default async function FarmerInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const { from, to } = await searchParams

  const sessionUser = await getSessionUserFromCookie()
  if (!sessionUser) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: farmer } = await admin
    .from('farmers')
    .select('id, business_name')
    .eq('user_id', sessionUser.id)
    .maybeSingle()

  if (!farmer) redirect('/dashboard')

  let query = admin
    .from('order_items')
    .select(`
      id, quantity, subtotal_cents, gst_cents, gst_applied, created_at,
      orders!inner(id, order_number, created_at, status, fulfillment_type, profiles!orders_buyer_id_fkey(full_name, business_name))
    `)
    .eq('farmer_id', farmer.id)
    .in('orders.status', PAID_STATUSES)

  if (from) query = query.gte('created_at', from)
  if (to)   query = query.lte('created_at', `${to}T23:59:59`)

  const { data: items } = await query

  const byOrder = new Map<string, { order: any; items: any[] }>()
  for (const item of items || []) {
    const order = (item as any).orders
    if (!byOrder.has(order.id)) byOrder.set(order.id, { order, items: [] })
    byOrder.get(order.id)!.items.push(item)
  }

  const rows = [...byOrder.values()]
    .map(({ order, items: orderItems }) => {
      const subtotal = orderItems.reduce((s, i) => s + i.subtotal_cents, 0)
      const gst = orderItems.reduce((s, i) => s + (i.gst_cents || 0), 0)
      const buyerName = order.profiles?.business_name || order.profiles?.full_name || 'Buyer'
      return {
        orderId: order.id, orderNumber: order.order_number, createdAt: order.created_at,
        fulfillmentType: order.fulfillment_type, buyerName, itemCount: orderItems.length, subtotal, gst,
      }
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const totalRevenue = rows.reduce((s, r) => s + r.subtotal, 0)
  const totalGst = rows.reduce((s, r) => s + r.gst, 0)

  return (
    <div className="page-pad" style={{ padding: '2.5rem', maxWidth: '68rem' }}>

      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--forest)', marginBottom: '0.25rem' }}>Invoices</h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--moss)' }}>
          Your own paid transactions with {farmer.business_name} — for your bookkeeping and ATO records.
        </p>
      </div>

      {/* Date range filter */}
      <form style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <label className="label">From</label>
          <AUDateInput name="from" defaultValue={from || ''} className="input" style={{ fontSize: '0.85rem' }} ariaLabel="From date" />
        </div>
        <div>
          <label className="label">To</label>
          <AUDateInput name="to" defaultValue={to || ''} className="input" style={{ fontSize: '0.85rem' }} ariaLabel="To date" />
        </div>
        <button type="submit" className="btn btn-forest btn-sm">Filter</button>
        {(from || to) && <Link href="/dashboard/farmer/invoices" className="btn btn-ghost btn-sm">Clear</Link>}
      </form>

      {/* Summary */}
      <div className="mg-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.875rem', marginBottom: '2rem' }}>
        {[
          { label: 'Transactions', value: String(rows.length), color: 'var(--forest)' },
          { label: 'Revenue',      value: formatPrice(totalRevenue), color: 'var(--forest)' },
          { label: 'GST collected', value: formatPrice(totalGst), color: '#065F46' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '1rem 1.25rem' }}>
            <p style={{ fontSize: '1.5rem', fontFamily: 'var(--font-display)', color: s.color, fontWeight: 700, lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--moss)', marginTop: '0.25rem' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="card" style={{ padding: '4rem', textAlign: 'center' }}>
          <p style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🧾</p>
          <p style={{ color: 'var(--moss)', fontSize: '0.9rem' }}>No paid transactions in this range.</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <div className="table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '42rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--olive)' }}>
                  {['Date', 'Order', 'Buyer', 'Method', 'GST', 'Your Total', ''].map((h, i) => (
                    <th key={h} style={{ padding: '0.65rem 0.875rem', textAlign: i >= 4 && i < 6 ? 'right' : 'left', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--moss)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.orderId} style={{ background: i % 2 === 0 ? 'white' : 'var(--offwhite, #fafaf7)' }}>
                    <td style={{ padding: '0.65rem 0.875rem', fontSize: '0.8rem', color: 'var(--moss)', whiteSpace: 'nowrap' }}>{formatAEST(r.createdAt, 'dd MMM yyyy')}</td>
                    <td style={{ padding: '0.65rem 0.875rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--forest)', whiteSpace: 'nowrap' }}>{r.orderNumber}</td>
                    <td style={{ padding: '0.65rem 0.875rem', fontSize: '0.82rem', color: 'var(--forest)' }}>{r.buyerName}</td>
                    <td style={{ padding: '0.65rem 0.875rem', fontSize: '0.78rem', color: 'var(--moss)' }}>{r.fulfillmentType === 'hub_pickup' ? 'Hub pickup' : 'Delivery'}</td>
                    <td style={{ padding: '0.65rem 0.875rem', fontSize: '0.82rem', color: 'var(--moss)', textAlign: 'right' }}>{formatPrice(r.gst)}</td>
                    <td style={{ padding: '0.65rem 0.875rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--forest)', textAlign: 'right' }}>{formatPrice(r.subtotal)}</td>
                    <td style={{ padding: '0.65rem 0.875rem', textAlign: 'right' }}>
                      <Link href={`/dashboard/farmer/invoices/${r.orderId}`} className="btn btn-ghost btn-sm">View →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
