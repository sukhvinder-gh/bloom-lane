// src/app/dashboard/buyer/invoices/page.tsx
import { getSessionUserFromCookie, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatPrice } from '@/lib/utils/pricing'
import { formatAEST } from '@/lib/utils/timezone'
import Link from 'next/link'

export default async function BuyerInvoicesPage() {
  const sessionUser = await getSessionUserFromCookie()
  if (!sessionUser) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role, full_name, email, abn, business_name, abn_verified')
    .eq('id', sessionUser.id)
    .single()

  // Only show paid/completed orders as invoices
  const { data: orders } = await admin
    .from('orders')
    .select('*, order_items(*, products(name, unit, farmer_id, is_gst_free), farmers(business_name))')
    .eq('buyer_id', sessionUser.id)
    .in('status', ['payment_confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'resolved'])
    .order('created_at', { ascending: false })

  const isB2B = profile?.role === 'buyer_b2b' && profile?.abn_verified

  return (
    <div className="page-pad" style={{ padding: '2.5rem', fontFamily: 'var(--font-body)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--forest)', marginBottom: '0.25rem' }}>
            Invoices
          </h1>
          <p style={{ color: 'var(--forest)', opacity: 0.5, fontSize: '0.9rem' }}>
            Tax invoices for all your orders
          </p>
        </div>
        {isB2B && profile?.abn && (
          <div style={{ background: 'var(--olive)', borderRadius: '0.75rem', padding: '0.75rem 1.25rem', fontSize: '0.8rem', color: 'var(--forest)' }}>
            <p style={{ fontWeight: 700, marginBottom: '0.1rem' }}>B2B Account</p>
            <p style={{ opacity: 0.6 }}>ABN: {profile.abn}</p>
          </div>
        )}
      </div>

      {(!orders || orders.length === 0) ? (
        <div style={{ textAlign: 'center', padding: '4rem', background: 'white', borderRadius: 'var(--r-card)', border: '1px solid var(--olive)' }}>
          <p style={{ fontSize: '2rem', marginBottom: '1rem' }}>🧾</p>
          <p style={{ color: 'var(--forest)', opacity: 0.5 }}>No invoices yet. Place your first order to see invoices here.</p>
          <Link href="/marketplace" style={{ display: 'inline-block', marginTop: '1.5rem', background: 'var(--forest)', color: 'var(--cream)', padding: '0.625rem 1.5rem', borderRadius: '99px', textDecoration: 'none', fontWeight: 700, fontSize: '0.875rem' }}>
            Browse Marketplace
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {(orders || []).map(order => (
            <div key={order.id} style={{ background: 'white', borderRadius: 'var(--r-card)', border: '1px solid var(--olive)', overflow: 'hidden' }}>
              {/* Invoice header */}
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--olive)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--forest)' }}>
                    TAX INVOICE — {order.order_number}
                  </p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--forest)', opacity: 0.5, marginTop: '0.1rem' }}>
                    {formatAEST(order.created_at, 'dd MMM yyyy, h:mm a zzz')}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--forest)' }}>
                    {formatPrice(order.total_cents)}
                  </p>
                  {isB2B && order.gst_cents > 0 && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--forest)', opacity: 0.5 }}>
                      incl. {formatPrice(order.gst_cents)} GST
                    </p>
                  )}
                </div>
              </div>

              {/* Line items */}
              <div style={{ padding: '1rem 1.5rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr>
                      {['Item', 'Supplier', 'Qty', 'Unit Price', 'Subtotal', 'GST'].map(h => (
                        <th key={h} style={{ padding: '0.4rem 0', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--forest)', opacity: 0.5, borderBottom: '1px solid var(--olive)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(order.order_items || []).map((item: any) => {
                      const gstComponent = item.products?.is_gst_free ? 0 : Math.round((item.subtotal_cents * 0.10) / 1.10)
                      return (
                        <tr key={item.id} style={{ borderBottom: '1px solid var(--olive)' }}>
                          <td style={{ padding: '0.625rem 0', color: 'var(--forest)' }}>{item.products?.name}</td>
                          <td style={{ padding: '0.625rem 0', color: 'var(--forest)', opacity: 0.6 }}>{item.farmers?.business_name}</td>
                          <td style={{ padding: '0.625rem 0', color: 'var(--forest)' }}>{item.quantity} {item.products?.unit}</td>
                          <td style={{ padding: '0.625rem 0', color: 'var(--forest)' }}>{formatPrice(item.unit_price_cents)}</td>
                          <td style={{ padding: '0.625rem 0', fontWeight: 700, color: 'var(--forest)' }}>{formatPrice(item.subtotal_cents)}</td>
                          <td style={{ padding: '0.625rem 0', color: 'var(--forest)', opacity: 0.6 }}>
                            {item.products?.is_gst_free ? <span style={{ fontSize: '0.7rem' }}>GST-free</span> : formatPrice(gstComponent)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {/* Totals */}
                <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ minWidth: '14rem' }}>
                    {order.delivery_fee_cents > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: 'var(--forest)', opacity: 0.6, marginBottom: '0.3rem' }}>
                        <span>Delivery</span><span>{formatPrice(order.delivery_fee_cents)}</span>
                      </div>
                    )}
                    {isB2B && order.gst_cents > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: 'var(--forest)', opacity: 0.6, marginBottom: '0.3rem' }}>
                        <span>GST (10%)</span><span>{formatPrice(order.gst_cents)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--forest)', borderTop: '1.5px solid var(--forest)', paddingTop: '0.4rem', marginTop: '0.3rem' }}>
                      <span>Total</span><span>{formatPrice(order.total_cents)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: '0.75rem 1.5rem', background: 'var(--cream)', borderTop: '1px solid var(--olive)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--forest)', opacity: 0.5 }}>
                  The Green Guild Market · GST registered · ABN on file
                </p>
                <Link href={`/dashboard/buyer/orders/${order.id}`} style={{ fontSize: '0.8rem', color: 'var(--forest)', fontWeight: 700, textDecoration: 'none', opacity: 0.7 }}>
                  View Order →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
