import { getSessionUserFromCookie, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatAEST } from '@/lib/utils/timezone'
import { PrintButton } from '@/components/PrintButton'

const ACTIVE_PO_STATUSES = ['pending', 'ready']

export default async function PackListPage() {
  const sessionUser = await getSessionUserFromCookie()
  if (!sessionUser) redirect('/auth/login')

  const admin = createAdminClient()

  const { data: farmers } = await admin
    .from('farmers').select('id, business_name').eq('user_id', sessionUser.id).limit(1)
  const farmer = farmers?.[0] ?? null
  if (!farmer) redirect('/dashboard')

  const { data: pos } = await admin
    .from('purchase_orders')
    .select('order_id, status, pickup_method')
    .eq('farmer_id', farmer.id)
    .in('status', ACTIVE_PO_STATUSES)

  const orderIds = [...new Set((pos || []).map(p => p.order_id))]
  const pickupMethodByOrder = new Map((pos || []).map(p => [p.order_id, p.pickup_method]))

  const { data: orders } = orderIds.length > 0
    ? await admin
        .from('orders')
        .select('id, order_number, created_at, fulfillment_type, buyer_id, order_items(id, quantity, products(name, unit))')
        .in('id', orderIds)
        .eq('order_items.farmer_id', farmer.id)
        .order('created_at', { ascending: true })
    : { data: [] as any[] }

  const buyerIds = [...new Set((orders || []).map((o: any) => o.buyer_id))]
  const { data: buyers } = buyerIds.length > 0
    ? await admin.from('profiles').select('id, full_name, business_name').in('id', buyerIds)
    : { data: [] as any[] }
  const buyerById = new Map((buyers || []).map((b: any) => [b.id, b]))

  return (
    <div className="page-pad" style={{ padding: '2.5rem', maxWidth: '860px', margin: '0 auto' }}>
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <Link href="/dashboard/farmer/orders" className="btn btn-ghost btn-sm">← Orders</Link>
        <span style={{ flex: 1 }} />
        <Link href="/dashboard/farmer/harvest-list" className="btn btn-outline btn-sm">🌾 Harvest List</Link>
        <Link href="/dashboard/farmer/pack-list/labels" className="btn btn-outline btn-sm">🏷 Print labels</Link>
        <PrintButton label="Print" />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ background: 'white', border: '1px solid var(--olive)', borderRadius: '1.5rem', padding: '2rem 2.5rem' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', color: 'var(--forest)', letterSpacing: '-0.02em' }}>Pack List</div>
          <p style={{ fontSize: '0.85rem', color: 'var(--moss)', marginTop: '0.25rem' }}>{farmer.business_name} · {(orders || []).length} order{(orders || []).length === 1 ? '' : 's'} to pack</p>
        </div>

        {(orders || []).length === 0 ? (
          <div style={{ background: 'white', border: '1px solid var(--olive)', borderRadius: '1.5rem', padding: '3rem', textAlign: 'center', color: 'var(--moss)' }}>
            Nothing to pack right now — no active orders.
          </div>
        ) : (
          (orders || []).map((order: any) => {
            const buyer = buyerById.get(order.buyer_id)
            const buyerName = buyer?.business_name || buyer?.full_name || 'Buyer'
            return (
              <div key={order.id} style={{ background: 'white', border: '1px solid var(--olive)', borderRadius: '1.5rem', padding: '1.75rem 2.5rem', breakInside: 'avoid' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '2px solid var(--forest)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
                  <div>
                    <span style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--forest)' }}>{buyerName}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--moss)', marginLeft: '0.75rem' }}>
                      {pickupMethodByOrder.get(order.id) === 'farm_pickup' ? '🚜 Farm pickup' : order.fulfillment_type === 'hub_pickup' ? '🏭 Hub pickup' : '🚚 Direct delivery'}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--moss)' }}>
                    {order.order_number} · {formatAEST(order.created_at, 'dd MMM')}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {(order.order_items || []).map((item: any) => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                      <span style={{ color: 'var(--forest)', fontWeight: 600 }}>{item.products?.name}</span>
                      <span style={{ color: 'var(--forest)', fontFamily: 'var(--font-display)' }}>{item.quantity} <span style={{ fontSize: '0.75rem', color: 'var(--moss)', fontFamily: 'var(--font-body)' }}>{item.products?.unit}</span></span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
