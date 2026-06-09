import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatPrice } from '@/lib/utils/pricing'
import { formatAEST } from '@/lib/utils/timezone'
import Link from 'next/link'
import { PrintButton } from '@/components/PrintButton'

export default async function BuyerInvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, abn, business_name, abn_verified, role')
    .eq('id', user.id)
    .single()

  const admin = createAdminClient()

  const { data: order } = await admin
    .from('orders')
    .select('*, order_items(*, products(name, unit, is_gst_free))')
    .eq('id', orderId)
    .eq('buyer_id', user.id)
    .single()

  if (!order) redirect('/dashboard/buyer/orders')

  // Don't show invoice for orders that haven't been paid
  if (['pending_payment', 'cancelled', 'refunded'].includes(order.status)) {
    redirect(`/dashboard/buyer/orders/${orderId}`)
  }

  const isB2B = profile?.role === 'buyer_b2b'
  const businessName = profile?.business_name || profile?.full_name

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

      {/* Invoice document */}
      <div style={{ background: 'white', border: '1px solid var(--olive)', borderRadius: '1.5rem', padding: '3rem', maxWidth: '860px', margin: '0 auto', fontFamily: 'var(--font-body)' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem', borderBottom: '2px solid var(--forest)', paddingBottom: '1.5rem' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--forest)', textTransform: 'uppercase', letterSpacing: '-0.03em', marginBottom: '0.25rem' }}>BLOOM LANE</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--moss)' }}>Bloom Lane Market Pty Ltd</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--moss)' }}>ABN: [Bloom Lane ABN]</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--forest)', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>TAX INVOICE</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--moss)', marginTop: '0.25rem' }}>Invoice #{order.order_number}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--moss)', marginTop: '0.1rem' }}>{formatAEST(order.created_at, 'dd MMMM yyyy')}</div>
            <div style={{ marginTop: '0.5rem' }}>
              <span style={{ background: 'var(--olive)', padding: '0.25rem 0.75rem', borderRadius: '99px', fontSize: '0.75rem', color: 'var(--forest)', fontWeight: 700 }}>
                {BUYER_STATUS[order.status] || order.status}
              </span>
            </div>
          </div>
        </div>

        {/* Bill to */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
          <div>
            <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--moss)', fontWeight: 700, marginBottom: '0.5rem' }}>Bill To</p>
            <p style={{ fontWeight: 700, color: 'var(--forest)', marginBottom: '0.2rem' }}>{businessName}</p>
            {isB2B && profile?.abn && (
              <p style={{ fontSize: '0.8rem', color: 'var(--moss)' }}>ABN: {profile.abn}</p>
            )}
            {profile?.email && <p style={{ fontSize: '0.8rem', color: 'var(--moss)' }}>{profile.email}</p>}
          </div>
          <div>
            <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--moss)', fontWeight: 700, marginBottom: '0.5rem' }}>Delivery Details</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--forest)', fontWeight: 600 }}>
              {order.fulfillment_type === 'hub_pickup' ? '🏭 Hub pickup' : '🚚 Direct delivery'}
            </p>
            {order.delivery_address && (
              <p style={{ fontSize: '0.8rem', color: 'var(--moss)', marginTop: '0.2rem' }}>
                {order.delivery_address}, {order.delivery_suburb} {order.delivery_state} {order.delivery_postcode}
              </p>
            )}
            {(order as any).florist_delivery_date && (
              <p style={{ fontSize: '0.8rem', color: 'var(--moss)', marginTop: '0.375rem' }}>
                Estimated delivery: <strong>{formatAEST((order as any).florist_delivery_date, 'dd MMM yyyy')}</strong>
              </p>
            )}
          </div>
        </div>

        {/* Line items */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--forest)' }}>
              {['Description', 'Qty', 'Unit Price', 'GST', 'Amount'].map((h, i) => (
                <th key={h} style={{ padding: '0.625rem 0.75rem', textAlign: i >= 2 ? 'right' : 'left', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--forest)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(order.order_items || []).map((item: any) => {
              const gstComponent = item.products?.is_gst_free ? 0 : Math.round((item.subtotal_cents * 0.10) / 1.10)
              return (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--olive)' }}>
                  <td style={{ padding: '0.75rem', color: 'var(--forest)' }}>
                    <span style={{ fontWeight: 600 }}>{item.products?.name}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--moss)', marginLeft: '0.5rem' }}>per {item.products?.unit}</span>
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--forest)' }}>{item.quantity}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--forest)' }}>{formatPrice(item.unit_price_cents)}</td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--moss)', fontSize: '0.8rem' }}>
                    {item.products?.is_gst_free ? 'Exempt' : formatPrice(gstComponent)}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, color: 'var(--forest)' }}>{formatPrice(item.subtotal_cents)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2rem' }}>
          <div style={{ width: '18rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--olive)' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--moss)' }}>Subtotal</span>
              <span style={{ color: 'var(--forest)' }}>{formatPrice(order.subtotal_cents)}</span>
            </div>
            {order.delivery_fee_cents > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--olive)' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--moss)' }}>{order.fulfillment_type === 'hub_pickup' ? 'Hub pickup' : 'Delivery'}</span>
                <span style={{ color: 'var(--forest)' }}>{formatPrice(order.delivery_fee_cents)}</span>
              </div>
            )}
            {order.gst_cents > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--olive)' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--moss)' }}>GST (10%, included)</span>
                <span style={{ color: 'var(--moss)' }}>{formatPrice(order.gst_cents)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.75rem' }}>
              <span style={{ fontWeight: 700, color: 'var(--forest)' }}>Total {isB2B ? '(inc. GST)' : ''}</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--forest)', letterSpacing: '-0.03em' }}>{formatPrice(order.total_cents)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid var(--olive)', paddingTop: '1rem', fontSize: '0.75rem', color: 'var(--moss)' }}>
          <p>Bloom Lane Market · This is a tax invoice. {isB2B ? 'All prices shown are exclusive of GST unless indicated. GST of 10% applies to applicable items.' : 'All prices include GST where applicable.'}</p>
          <p style={{ marginTop: '0.25rem' }}>Invoice #{order.order_number} · Generated {formatAEST(new Date().toISOString(), 'dd MMM yyyy')}</p>
        </div>
      </div>
    </div>
  )
}
