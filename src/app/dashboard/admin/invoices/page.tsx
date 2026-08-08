import { createAdminClient } from '@/lib/supabase/server'
import { formatPrice } from '@/lib/utils/pricing'
import { formatAEST } from '@/lib/utils/timezone'
import Link from 'next/link'
import { ExportInvoicesButton } from './ExportInvoicesButton'
import { AUDateInput } from '@/components/AUDateInput'

export const dynamic = 'force-dynamic'

// Every paid transaction is an invoice event — this is the platform-wide,
// admin-facing record of all of them (across every buyer and grower), for
// ATO record-keeping and general bookkeeping. Buyers only ever see their
// own invoices at /dashboard/buyer/invoices; this is the whole-of-platform
// equivalent.
const PAID_STATUSES = ['payment_confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'resolved']

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>
}) {
  const { from, to } = await searchParams
  const admin = createAdminClient()

  let query = admin
    .from('orders')
    .select(`
      id, order_number, created_at, status, total_cents, gst_cents, fulfillment_type,
      profiles!orders_buyer_id_fkey(full_name, business_name),
      order_items(farmer_id, farmers(business_name))
    `)
    .in('status', PAID_STATUSES)
    .order('created_at', { ascending: false })
    .limit(300)

  if (from) query = query.gte('created_at', from)
  if (to)   query = query.lte('created_at', `${to}T23:59:59`)

  const { data: orders } = await query

  const totalGmv = (orders || []).reduce((s, o) => s + (o.total_cents || 0), 0)
  const totalGst = (orders || []).reduce((s, o) => s + (o.gst_cents || 0), 0)

  return (
    <div className="page-pad" style={{ padding: '2.5rem', maxWidth: '68rem' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--navy)', marginBottom: '0.25rem' }}>Invoices</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--moss)' }}>
            Every paid transaction across the platform — the full record for bookkeeping and ATO purposes
          </p>
        </div>
        <ExportInvoicesButton from={from} to={to} />
      </div>

      {/* Date range filter */}
      <form style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>From</label>
          <AUDateInput name="from" defaultValue={from || ''} className="input" style={{ fontSize: '0.85rem' }} ariaLabel="From date" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>To</label>
          <AUDateInput name="to" defaultValue={to || ''} className="input" style={{ fontSize: '0.85rem' }} ariaLabel="To date" />
        </div>
        <button type="submit" className="btn btn-forest btn-sm">Filter</button>
        {(from || to) && <Link href="/dashboard/admin/invoices" className="btn btn-ghost btn-sm">Clear</Link>}
      </form>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.875rem', marginBottom: '2rem' }}>
        {[
          { label: 'Transactions', value: String((orders || []).length), color: 'var(--navy)' },
          { label: 'Total GMV',    value: formatPrice(totalGmv),        color: 'var(--navy)' },
          { label: 'GST collected',value: formatPrice(totalGst),        color: '#065F46' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '1rem 1.25rem' }}>
            <p style={{ fontSize: '1.5rem', fontFamily: 'var(--font-display)', color: s.color, fontWeight: 700, lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Transaction list */}
      {(!orders || orders.length === 0) ? (
        <div className="card" style={{ padding: '4rem', textAlign: 'center' }}>
          <p style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🧾</p>
          <p style={{ color: 'var(--moss)', fontSize: '0.9rem' }}>No paid transactions in this range.</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '48rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--olive)' }}>
                  {['Date', 'Order', 'Buyer', 'Grower(s)', 'Method', 'GST', 'Total', ''].map((h, i) => (
                    <th key={h} style={{ padding: '0.65rem 0.875rem', textAlign: i >= 5 && i < 7 ? 'right' : 'left', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-3)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(orders || []).map((o: any, i: number) => {
                  const buyerName = o.profiles?.business_name || o.profiles?.full_name || 'Unknown'
                  const growerNames = [...new Set((o.order_items || []).map((it: any) => it.farmers?.business_name).filter(Boolean))]
                  return (
                    <tr key={o.id} style={{ background: i % 2 === 0 ? 'white' : 'var(--offwhite, #fafaf7)' }}>
                      <td style={{ padding: '0.65rem 0.875rem', fontSize: '0.8rem', color: 'var(--moss)', whiteSpace: 'nowrap' }}>{formatAEST(o.created_at, 'dd MMM yyyy')}</td>
                      <td style={{ padding: '0.65rem 0.875rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--navy)', whiteSpace: 'nowrap' }}>{o.order_number}</td>
                      <td style={{ padding: '0.65rem 0.875rem', fontSize: '0.82rem', color: 'var(--navy)' }}>{buyerName}</td>
                      <td style={{ padding: '0.65rem 0.875rem', fontSize: '0.8rem', color: 'var(--moss)' }}>{growerNames.join(', ') || '—'}</td>
                      <td style={{ padding: '0.65rem 0.875rem', fontSize: '0.78rem', color: 'var(--moss)' }}>{o.fulfillment_type === 'hub_pickup' ? 'Hub pickup' : 'Delivery'}</td>
                      <td style={{ padding: '0.65rem 0.875rem', fontSize: '0.82rem', color: 'var(--moss)', textAlign: 'right' }}>{formatPrice(o.gst_cents || 0)}</td>
                      <td style={{ padding: '0.65rem 0.875rem', fontSize: '0.82rem', fontWeight: 700, color: 'var(--navy)', textAlign: 'right' }}>{formatPrice(o.total_cents)}</td>
                      <td style={{ padding: '0.65rem 0.875rem', textAlign: 'right' }}>
                        <Link href={`/dashboard/admin/invoices/${o.id}`} className="btn btn-ghost btn-sm">View →</Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
