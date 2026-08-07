import { notFound } from 'next/navigation'
import { getSessionUserFromCookie, createAdminClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/utils/permissions'
import { formatPrice } from '@/lib/utils/pricing'
import { formatAEST } from '@/lib/utils/timezone'
import Link from 'next/link'
import { PrintButton } from '@/components/PrintButton'

// Admin-side counterpart to the buyer's own invoice view — same per-grower
// document rendering (never a single combined tax invoice across growers),
// but reachable for any order on the platform rather than only the signed-in
// buyer's own. Used for ATO / bookkeeping review of any past transaction.
export default async function AdminInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params

  const sessionUser = await getSessionUserFromCookie()
  if (!sessionUser) notFound()

  const admin = createAdminClient()
  const { data: viewerProfile } = await admin.from('profiles').select('role').eq('id', sessionUser.id).single()
  if (!isAdminRole(viewerProfile?.role)) notFound()

  const { data: order } = await admin
    .from('orders')
    .select('*, order_items(*, products(name, unit)), profiles!orders_buyer_id_fkey(full_name, email, abn, business_name, abn_verified, role)')
    .eq('id', orderId)
    .single()

  if (!order) notFound()

  const buyerProfile = (order as any).profiles
  const isB2B = buyerProfile?.role === 'buyer_b2b'
  const businessName = buyerProfile?.business_name || buyerProfile?.full_name

  const items: any[] = order.order_items || []
  const farmerIds = [...new Set(items.map(i => i.farmer_id))]
  const { data: farmers } = await admin
    .from('farmers')
    .select('id, business_name, abn, gst_registered')
    .in('id', farmerIds)

  const farmerById = new Map((farmers || []).map(f => [f.id, f]))
  const byFarmer = new Map<string, any[]>()
  for (const item of items) {
    const list = byFarmer.get(item.farmer_id) || []
    list.push(item)
    byFarmer.set(item.farmer_id, list)
  }

  const growerDocs = [...byFarmer.entries()].map(([farmerId, farmerItems]) => {
    const farmer = farmerById.get(farmerId)
    const subtotal = farmerItems.reduce((s, i) => s + i.subtotal_cents, 0)
    const gst = farmerItems.reduce((s, i) => s + (i.gst_cents || 0), 0)
    const isTaxInvoice = farmerItems.some(i => i.gst_applied)
    return { farmerId, farmer, items: farmerItems, subtotal, gst, isTaxInvoice }
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', padding: '2rem' }}>

      {/* Action bar */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', maxWidth: '860px', margin: '0 auto 2rem' }}>
        <Link href="/dashboard/admin/invoices" className="btn btn-ghost btn-sm">← Invoices</Link>
        <span style={{ flex: 1 }} />
        <PrintButton label="Download PDF" />
      </div>

      <div style={{ maxWidth: '860px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

        {/* Order-level context — admin only, not part of the printed grower docs */}
        <div className="no-print" style={{ background: 'var(--olive)', borderRadius: '1rem', padding: '1rem 1.5rem', fontSize: '0.8rem', color: 'var(--forest)' }}>
          Order <strong>{order.order_number}</strong> · Buyer: <strong>{businessName}</strong>{buyerProfile?.email ? ` (${buyerProfile.email})` : ''} · Status: {order.status}
        </div>

        {/* One document per grower — never combined */}
        {growerDocs.map(({ farmerId, farmer, items: farmerItems, subtotal, gst, isTaxInvoice }) => (
          <div key={farmerId} style={{ background: 'white', border: '1px solid var(--olive)', borderRadius: '1.5rem', padding: '3rem', fontFamily: 'var(--font-body)' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', borderBottom: '2px solid var(--forest)', paddingBottom: '1.5rem' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--forest)', letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
                  {farmer?.business_name || 'Grower'}
                </div>
                {isTaxInvoice && farmer?.abn && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--moss)' }}>ABN: {farmer.abn}</div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--forest)', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
                  {isTaxInvoice ? 'Tax Invoice' : 'Invoice'}
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--moss)', marginTop: '0.25rem' }}>Order #{order.order_number}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--moss)', marginTop: '0.1rem' }}>{formatAEST(order.created_at, 'dd MMMM yyyy')}</div>
              </div>
            </div>

            {/* Bill to */}
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--moss)', fontWeight: 700, marginBottom: '0.5rem' }}>Bill To</p>
              <p style={{ fontWeight: 700, color: 'var(--forest)', marginBottom: '0.2rem' }}>{businessName}</p>
              {isB2B && buyerProfile?.abn && <p style={{ fontSize: '0.8rem', color: 'var(--moss)' }}>ABN: {buyerProfile.abn}</p>}
            </div>

            {/* Line items */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--forest)' }}>
                  {['Description', 'Qty', 'Unit Price', 'GST', 'Amount'].map((h, i) => (
                    <th key={h} style={{ padding: '0.625rem 0.75rem', textAlign: i >= 2 ? 'right' : 'left', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--forest)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {farmerItems.map((item: any) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--olive)' }}>
                    <td style={{ padding: '0.75rem', color: 'var(--forest)' }}>
                      <span style={{ fontWeight: 600 }}>{item.products?.name}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--moss)', marginLeft: '0.5rem' }}>per {item.products?.unit}</span>
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--forest)' }}>{item.quantity}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--forest)' }}>{formatPrice(item.unit_price_cents)}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--moss)', fontSize: '0.8rem' }}>
                      {item.gst_applied ? formatPrice(item.gst_cents) : 'N/A'}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, color: 'var(--forest)' }}>{formatPrice(item.subtotal_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
              <div style={{ width: '18rem' }}>
                {gst > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--olive)' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--moss)' }}>Includes GST</span>
                    <span style={{ color: 'var(--moss)' }}>{formatPrice(gst)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.6rem' }}>
                  <span style={{ fontWeight: 700, color: 'var(--forest)' }}>Total</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--forest)', letterSpacing: '-0.03em' }}>{formatPrice(subtotal)}</span>
                </div>
              </div>
            </div>

            {/* Footer — GST status statement */}
            <div style={{ borderTop: '1px solid var(--olive)', paddingTop: '1rem', fontSize: '0.75rem', color: 'var(--moss)' }}>
              {isTaxInvoice ? (
                <p>This is a tax invoice for supplies made by {farmer?.business_name || 'this grower'}. GST of 10% applies to applicable items.</p>
              ) : (
                <p>{farmer?.business_name || 'This supplier'} is not registered for GST. No GST has been charged on this invoice.</p>
              )}
            </div>
          </div>
        ))}

        <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--moss)' }}>
          Thank you for choosing The Green Guild.
        </p>
      </div>
    </div>
  )
}
