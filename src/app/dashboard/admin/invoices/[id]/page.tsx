import { notFound } from 'next/navigation'
import { getSessionUserFromCookie, createAdminClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/utils/permissions'
import { formatPrice } from '@/lib/utils/pricing'
import { formatAEST } from '@/lib/utils/timezone'
import Link from 'next/link'
import { PrintButton } from '@/components/PrintButton'
import { invoiceTitle, invoiceFooterText } from '@/lib/invoicing/rcti'

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
    .select('id, business_name, abn, gst_registered, address, suburb, state, postcode, email, rcti_agreed, rcti_agreed_at, rcti_full_name')
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

  const groupSubtotal = growerDocs.reduce((s, d) => s + d.subtotal, 0)
  const groupGst = growerDocs.reduce((s, d) => s + d.gst, 0)

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

        {/* Grouped summary — only meaningful with more than one farm in this order */}
        {growerDocs.length > 1 && (
          <div style={{ background: 'var(--forest)', borderRadius: '1.5rem', padding: '1.75rem 2rem', color: 'white' }}>
            <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.15em', opacity: 0.7, fontWeight: 700, marginBottom: '0.75rem' }}>
              Order Summary · {growerDocs.length} farms
            </p>
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontSize: '0.7rem', opacity: 0.7, marginBottom: '0.15rem' }}>Subtotal</p>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem' }}>{formatPrice(groupSubtotal)}</p>
              </div>
              {groupGst > 0 && (
                <div>
                  <p style={{ fontSize: '0.7rem', opacity: 0.7, marginBottom: '0.15rem' }}>GST</p>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem' }}>{formatPrice(groupGst)}</p>
                </div>
              )}
              <div>
                <p style={{ fontSize: '0.7rem', opacity: 0.7, marginBottom: '0.15rem' }}>Total</p>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 700 }}>{formatPrice(groupSubtotal + groupGst)}</p>
              </div>
            </div>
          </div>
        )}

        {/* One document per grower — never combined */}
        {growerDocs.map(({ farmerId, farmer, items: farmerItems, subtotal, gst, isTaxInvoice }) => (
          <div key={farmerId} style={{ background: 'white', border: '1px solid var(--olive)', borderRadius: '1.5rem', padding: '3rem', fontFamily: 'var(--font-body)' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', borderBottom: '2px solid var(--forest)', paddingBottom: '1.5rem' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--forest)', letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
                  {farmer?.business_name || 'Grower'}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--moss)', lineHeight: 1.6 }}>
                  {farmer?.abn && <div>ABN: {farmer.abn}</div>}
                  {(farmer?.address || farmer?.suburb) && (
                    <div>{[farmer.address, farmer.suburb, farmer.state, farmer.postcode].filter(Boolean).join(', ')}</div>
                  )}
                  {farmer?.email && <div>{farmer.email}</div>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: isTaxInvoice && farmer?.rcti_agreed ? '1.05rem' : '1.25rem', color: 'var(--forest)', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
                  {invoiceTitle(isTaxInvoice, !!farmer?.rcti_agreed)}
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

            {/* Footer — GST/RCTI status statement */}
            <div style={{ borderTop: '1px solid var(--olive)', paddingTop: '1rem', fontSize: '0.75rem', color: 'var(--moss)' }}>
              <p>{invoiceFooterText({
                isTaxInvoice, rctiAgreed: !!farmer?.rcti_agreed, businessName: farmer?.business_name,
                rctiFullName: farmer?.rcti_full_name, rctiAgreedAt: farmer?.rcti_agreed_at,
              })}</p>
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
