import { getSessionUserFromCookie, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatPrice } from '@/lib/utils/pricing'
import { formatAEST } from '@/lib/utils/timezone'
import Link from 'next/link'
import { PrintButton } from '@/components/PrintButton'
import { RejectPOForm } from './RejectPOForm'

export default async function FarmerPOPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await params

  const sessionUser = await getSessionUserFromCookie()
  if (!sessionUser) redirect('/auth/login')

  const admin = createAdminClient()

  // Fetch the farmer record for this user
  const { data: farmer } = await admin
    .from('farmers')
    .select('id, business_name, abn, email, suburb, state, commission_rate')
    .eq('user_id', sessionUser.id)
    .single()

  if (!farmer) redirect('/dashboard')

  // Fetch order header (include hub_id for delivery zone lookup)
  const { data: order } = await admin
    .from('orders')
    .select('id, order_number, created_at, grower_fulfillment_date, florist_delivery_date, fulfillment_type, buyer_is_b2b, hub_id')
    .eq('id', orderId)
    .single()

  if (!order) redirect('/dashboard/farmer/orders')

  // Fetch hub details if this is a hub_pickup order
  let hubZone: { hub_address: string | null; hub_suburb: string | null; hub_state: string | null; hub_postcode: string | null; hub_collection_day: string | null; hub_collection_time_start: string | null; hub_collection_time_end: string | null } | null = null
  if (order.fulfillment_type === 'hub_pickup' && (order as any).hub_id) {
    const { data } = await admin
      .from('delivery_zones')
      .select('hub_address, hub_suburb, hub_state, hub_postcode, hub_collection_day, hub_collection_time_start, hub_collection_time_end')
      .eq('id', (order as any).hub_id)
      .single()
    hubZone = data
  }

  // Fetch this farmer's items from the order
  const { data: items } = await admin
    .from('order_items')
    .select('id, quantity, unit_price_cents, subtotal_cents, is_b2b, products(name, unit, category)')
    .eq('order_id', orderId)
    .eq('farmer_id', farmer.id)

  if (!items || items.length === 0) redirect('/dashboard/farmer/orders')

  // Fetch existing PO status (if any)
  const { data: poRecord } = await admin
    .from('purchase_orders')
    .select('status, rejection_reason, rejected_at')
    .eq('order_id', orderId)
    .eq('farmer_id', farmer.id)
    .maybeSingle()

  const commissionRate: number = (farmer as any).commission_rate ?? 0.10
  const gross = items.reduce((s, i) => s + i.subtotal_cents, 0)
  const commission = Math.round(gross * commissionRate)
  const net = gross - commission

  const COMMISSION_RATE = Math.round(commissionRate * 100)

  return (
    <div className="page-pad" style={{ padding: '2.5rem', maxWidth: '860px', margin: '0 auto' }}>

      {/* Action bar (hidden when printing) */}
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <Link href="/dashboard/farmer/orders" className="btn btn-ghost btn-sm">← Orders</Link>
        <span style={{ flex: 1 }} />
        {(!poRecord || poRecord.status === 'pending') && (
          <RejectPOForm orderId={orderId} farmerId={farmer.id} />
        )}
        <PrintButton label="Save as PDF" />
      </div>

      {/* PO rejection status banner */}
      {poRecord?.status === 'rejected' && (
        <div className="no-print" style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '1rem', padding: '1rem 1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🚫</span>
          <div>
            <p style={{ fontWeight: 700, color: '#b91c1c', fontSize: '0.9rem' }}>This PO has been rejected</p>
            {poRecord.rejection_reason && <p style={{ fontSize: '0.8rem', color: '#b91c1c', opacity: 0.8, marginTop: '0.2rem' }}>{poRecord.rejection_reason}</p>}
            <p style={{ fontSize: '0.75rem', color: '#b91c1c', opacity: 0.6, marginTop: '0.2rem' }}>Rejected {poRecord.rejected_at ? formatAEST(poRecord.rejected_at) : ''} · Admin has been notified</p>
          </div>
        </div>
      )}

      {/* ─── PRINTABLE DOCUMENT ─── */}
      <div style={{ background: 'white', border: '1px solid var(--olive)', borderRadius: '1.5rem', padding: '3rem', fontFamily: 'var(--font-body)' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem', borderBottom: '2px solid var(--forest)', paddingBottom: '1.5rem' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--forest)', textTransform: 'uppercase', letterSpacing: '-0.03em', marginBottom: '0.25rem' }}>THE GREEN GUILD</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--moss)' }}>The Green Guild Market · ABN on file</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--forest)', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>PURCHASE ORDER</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--moss)', marginTop: '0.25rem' }}>PO for {order.order_number}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--moss)', marginTop: '0.1rem' }}>{formatAEST(order.created_at, 'dd MMMM yyyy')}</div>
          </div>
        </div>

        {/* To / From */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
          <div>
            <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--moss)', fontWeight: 700, marginBottom: '0.5rem' }}>To (Grower)</p>
            <p style={{ fontWeight: 700, color: 'var(--forest)', marginBottom: '0.2rem' }}>{farmer.business_name}</p>
            {farmer.abn && <p style={{ fontSize: '0.8rem', color: 'var(--moss)' }}>ABN: {farmer.abn}</p>}
            {farmer.email && <p style={{ fontSize: '0.8rem', color: 'var(--moss)' }}>{farmer.email}</p>}
            {(farmer.suburb || farmer.state) && <p style={{ fontSize: '0.8rem', color: 'var(--moss)' }}>{[farmer.suburb, farmer.state].filter(Boolean).join(', ')}</p>}
          </div>
          <div>
            <p style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--moss)', fontWeight: 700, marginBottom: '0.5rem' }}>Dates</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--moss)', width: '9rem', flexShrink: 0 }}>Order placed:</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--forest)', fontWeight: 600 }}>{formatAEST(order.created_at, 'dd MMM yyyy')}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--moss)', width: '9rem', flexShrink: 0 }}>Fulfil by:</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--forest)', fontWeight: 600 }}>
                  {order.grower_fulfillment_date ? formatAEST(order.grower_fulfillment_date, 'dd MMM yyyy, h:mm a') : 'TBC — see admin'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--moss)', width: '9rem', flexShrink: 0 }}>Delivery method:</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--forest)', fontWeight: 600 }}>
                  {order.fulfillment_type === 'hub_pickup' ? (
                    hubZone
                      ? `Hub drop-off — ${[hubZone.hub_address, hubZone.hub_suburb, hubZone.hub_state].filter(Boolean).join(', ')}`
                      : 'Hub drop-off (admin to confirm location)'
                  ) : 'Direct delivery to florist'}
                </span>
              </div>
              {order.fulfillment_type === 'hub_pickup' && hubZone && (hubZone.hub_collection_day || hubZone.hub_collection_time_start) && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--moss)', width: '9rem', flexShrink: 0 }}>Collection window:</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--forest)', fontWeight: 600 }}>
                    {hubZone.hub_collection_day ? `${hubZone.hub_collection_day.charAt(0).toUpperCase()}${hubZone.hub_collection_day.slice(1)}` : ''}{' '}
                    {hubZone.hub_collection_time_start && hubZone.hub_collection_time_end ? `${hubZone.hub_collection_time_start} – ${hubZone.hub_collection_time_end}` : ''}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Line items */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--forest)' }}>
              {['Product', 'Qty', 'Unit', 'Unit Price', 'Subtotal'].map((h, i) => (
                <th key={h} style={{ padding: '0.625rem 0.75rem', textAlign: i >= 2 ? 'right' : 'left', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--forest)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.id} style={{ borderBottom: '1px solid var(--olive)' }}>
                <td style={{ padding: '0.75rem', color: 'var(--forest)', fontWeight: 600 }}>{(item as any).products?.name}</td>
                <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--forest)' }}>{item.quantity}</td>
                <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--moss)', fontSize: '0.8rem' }}>{(item as any).products?.unit}</td>
                <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--forest)' }}>{formatPrice(item.unit_price_cents)}</td>
                <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--forest)', fontWeight: 700 }}>{formatPrice(item.subtotal_cents)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Commission summary */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '2rem' }}>
          <div style={{ width: '18rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--olive)' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--moss)' }}>Gross value</span>
              <span style={{ fontWeight: 700, color: 'var(--forest)' }}>{formatPrice(gross)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--olive)' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--moss)' }}>Platform commission ({COMMISSION_RATE}%)</span>
              <span style={{ color: '#b91c1c' }}>− {formatPrice(commission)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0 0' }}>
              <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--forest)' }}>Net payable to you</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--forest)', letterSpacing: '-0.03em' }}>{formatPrice(net)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid var(--olive)', paddingTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--moss)' }}>
          <span>The Green Guild Market · This document constitutes a purchase order between The Green Guild and the above grower.</span>
          <span>PO #{order.order_number}</span>
        </div>
      </div>
    </div>
  )
}
