import { getSessionUserFromCookie, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatPrice } from '@/lib/utils/pricing'
import { formatAEST } from '@/lib/utils/timezone'
import Link from 'next/link'
import { PrintButton } from '@/components/PrintButton'

export default async function BuyerInvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params

  const sessionUser = await getSessionUserFromCookie()
  if (!sessionUser) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('full_name, email, abn, business_name, abn_verified, role')
    .eq('id', sessionUser.id)
    .single()

  const { data: order } = await admin
    .from('orders')
    .select('*, order_items(*, products(name, unit))')
    .eq('id', orderId)
    .eq('buyer_id', sessionUser.id)
    .single()

  if (!order) redirect('/dashboard/buyer/orders')

  // Don't show invoice for orders that haven't been paid
  if (['pending_payment', 'cancelled', 'refunded'].includes(order.status)) {
    redirect(`/dashboard/buyer/orders/${orderId}`)
  }

  const isB2B = profile?.role === 'buyer_b2b'
  const businessName = profile?.business_name || profile?.full_name

  // Each grower is a separate supplier for GST purposes — one document per
  // farmer_id, never a single combined tax invoice across growers.
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

  const grandSubtotal = growerDocs.reduce((s, g) => s + g.subtotal, 0)
  const grandGst = growerDocs.reduce((s, g) => s + g.gst, 0)

  const BUYER_STATUS: Record<string, string> = {
    payment_confirmed: 'Processing', preparing: 'Processing',
    ready_for_pickup: 'Ready for delivery', out_for_delivery: 'Ready for delivery',
    delivered: 'Completed', disputed: 'Disputed',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', padding: '2rem' }}>

      {/* Action bar */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', maxWidth: '860px', margin: '0 auto 2rem' }}>
        <Link href={`/dashboard/buyer/orders/${orderId}`} className="btn btn-ghost btn-sm">← Order</Link>
        <span style={{ flex: 1 }} />
        <PrintButton label="Download PDF" />
      </div>

      <div style={{ maxWidth: '860px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

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
                <div style={{ fontSize: '0.75rem', color: 'var(--moss)', marginTop: '0.35rem' }}>Fulfilled via The Green Guild</div>
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
              {isB2B && profile?.abn && <p style={{ fontSize: '0.8rem', color: 'var(--moss)' }}>ABN: {profile.abn}</p>}
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

        {/* Consolidated statement — NOT a tax invoice, summarises the whole order */}
        <div style={{ background: 'white', border: '1px solid var(--olive)', borderRadius: '1.5rem', padding: '3rem', fontFamily: 'var(--font-body)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', borderBottom: '2px solid var(--forest)', paddingBottom: '1.5rem' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--forest)', textTransform: 'uppercase', letterSpacing: '-0.03em', marginBottom: '0.25rem' }}>THE GREEN GUILD</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--moss)' }}>Consolidated Order Statement (not a tax invoice)</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--moss)' }}>Order #{order.order_number}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--moss)', marginTop: '0.1rem' }}>{formatAEST(order.created_at, 'dd MMMM yyyy')}</div>
              <div style={{ marginTop: '0.5rem' }}>
                <span style={{ background: 'var(--olive)', padding: '0.25rem 0.75rem', borderRadius: '99px', fontSize: '0.75rem', color: 'var(--forest)', fontWeight: 700 }}>
                  {BUYER_STATUS[order.status] || order.status}
                </span>
              </div>
            </div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--forest)' }}>
                {['Grower', 'Subtotal', 'GST'].map((h, i) => (
                  <th key={h} style={{ padding: '0.625rem 0.75rem', textAlign: i >= 1 ? 'right' : 'left', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--forest)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {growerDocs.map(({ farmerId, farmer, subtotal, gst }) => (
                <tr key={farmerId} style={{ borderBottom: '1px solid var(--olive)' }}>
                  <td style={{ padding: '0.75rem', color: 'var(--forest)', fontWeight: 600 }}>{farmer?.business_name || 'Grower'}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--forest)' }}>{formatPrice(subtotal)}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--moss)' }}>{gst > 0 ? formatPrice(gst) : 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2rem' }}>
            <div style={{ width: '18rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--olive)' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--moss)' }}>Items subtotal</span>
                <span style={{ color: 'var(--forest)' }}>{formatPrice(grandSubtotal)}</span>
              </div>
              {order.delivery_fee_cents > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--olive)' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--moss)' }}>{order.fulfillment_type === 'hub_pickup' ? 'Hub pickup' : 'Delivery'}</span>
                  <span style={{ color: 'var(--forest)' }}>{formatPrice(order.delivery_fee_cents)}</span>
                </div>
              )}
              {grandGst > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--olive)' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--moss)' }}>GST breakdown (total)</span>
                  <span style={{ color: 'var(--moss)' }}>{formatPrice(grandGst)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.75rem' }}>
                <span style={{ fontWeight: 700, color: 'var(--forest)' }}>Total paid</span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--forest)', letterSpacing: '-0.03em' }}>{formatPrice(order.total_cents)}</span>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--olive)', paddingTop: '1rem', fontSize: '0.75rem', color: 'var(--moss)' }}>
            <p>This statement summarises your order across {growerDocs.length} {growerDocs.length === 1 ? 'grower' : 'growers'}. Each grower's individual invoice above is the legal supply document for that grower — this page is a convenience summary only.</p>
            <p style={{ marginTop: '0.25rem' }}>Order #{order.order_number} · Generated {formatAEST(new Date().toISOString(), 'dd MMM yyyy')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
