import { getSessionUserFromCookie, createAdminClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { formatPrice } from '@/lib/utils/pricing'
import { formatAEST } from '@/lib/utils/timezone'
import Link from 'next/link'
import { PrintButton } from '@/components/PrintButton'
import { invoiceTitle, invoiceFooterText } from '@/lib/invoicing/rcti'

// A grower's own copy of their invoice for one order — strictly their own
// line items only, even when the order also contains other farms' items
// (a farmer must never see another farmer's products or pricing).
export default async function FarmerInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params

  const sessionUser = await getSessionUserFromCookie()
  if (!sessionUser) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: farmer } = await admin
    .from('farmers')
    .select('id, business_name, abn, gst_registered, address, suburb, state, postcode, email, rcti_agreed, rcti_agreed_at, rcti_full_name')
    .eq('user_id', sessionUser.id)
    .maybeSingle()

  if (!farmer) redirect('/dashboard')

  const { data: order } = await admin
    .from('orders')
    .select('id, order_number, created_at, profiles!orders_buyer_id_fkey(full_name, business_name)')
    .eq('id', orderId)
    .single()

  if (!order) notFound()

  const { data: items } = await admin
    .from('order_items')
    .select('id, quantity, unit_price_cents, subtotal_cents, gst_cents, gst_applied, products(name, unit)')
    .eq('order_id', orderId)
    .eq('farmer_id', farmer.id)

  if (!items || items.length === 0) notFound()

  const subtotal = items.reduce((s, i) => s + i.subtotal_cents, 0)
  const gst = items.reduce((s, i) => s + (i.gst_cents || 0), 0)
  const isTaxInvoice = items.some(i => i.gst_applied)
  const buyerName = (order as any).profiles?.business_name || (order as any).profiles?.full_name || 'Buyer'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', padding: '2rem' }}>

      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', maxWidth: '860px', margin: '0 auto 2rem' }}>
        <Link href="/dashboard/farmer/invoices" className="btn btn-ghost btn-sm">← Invoices</Link>
        <span style={{ flex: 1 }} />
        <PrintButton label="Download PDF" />
      </div>

      <div style={{ maxWidth: '860px', margin: '0 auto' }}>
        <div style={{ background: 'white', border: '1px solid var(--olive)', borderRadius: '1.5rem', padding: '3rem', fontFamily: 'var(--font-body)' }}>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', borderBottom: '2px solid var(--forest)', paddingBottom: '1.5rem' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--forest)', letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
                {farmer.business_name}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--moss)', lineHeight: 1.6 }}>
                {farmer.abn && <div>ABN: {farmer.abn}</div>}
                {(farmer.address || farmer.suburb) && (
                  <div>{[farmer.address, farmer.suburb, farmer.state, farmer.postcode].filter(Boolean).join(', ')}</div>
                )}
                {farmer.email && <div>{farmer.email}</div>}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: isTaxInvoice && farmer.rcti_agreed ? '1.05rem' : '1.25rem', color: 'var(--forest)', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
                {invoiceTitle(isTaxInvoice, !!farmer.rcti_agreed)}
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--moss)', marginTop: '0.25rem' }}>Order #{order.order_number}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--moss)', marginTop: '0.1rem' }}>{formatAEST(order.created_at, 'dd MMMM yyyy')}</div>
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--moss)', fontWeight: 700, marginBottom: '0.5rem' }}>Bill To</p>
            <p style={{ fontWeight: 700, color: 'var(--forest)' }}>{buyerName}</p>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--forest)' }}>
                {['Description', 'Qty', 'Unit Price', 'GST', 'Amount'].map((h, i) => (
                  <th key={h} style={{ padding: '0.625rem 0.75rem', textAlign: i >= 2 ? 'right' : 'left', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--forest)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item: any) => (
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

          <div style={{ borderTop: '1px solid var(--olive)', paddingTop: '1rem', fontSize: '0.75rem', color: 'var(--moss)' }}>
            <p>{invoiceFooterText({
              isTaxInvoice, rctiAgreed: !!farmer.rcti_agreed, businessName: farmer.business_name,
              rctiFullName: farmer.rcti_full_name, rctiAgreedAt: farmer.rcti_agreed_at,
            })}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
