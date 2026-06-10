import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils/pricing'
import { formatAEST, isMarketOpen } from '@/lib/utils/timezone'

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = { payment_confirmed: 'badge-olive', preparing: 'badge-olive', delivered: 'badge-sage', disputed: 'badge-red', cancelled: 'badge-cream', refunded: 'badge-cream' }
  return <span className={`badge ${map[status] || 'badge-cream'}`}>{status?.replace(/_/g, ' ')}</span>
}

export default async function BuyerDashboard() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
  const marketOpen = isMarketOpen()
  const isB2B = profile?.role === 'buyer_b2b'

  const { data: orders } = await supabase.from('orders').select('*, order_items(count)').eq('buyer_id', session.user.id).order('created_at', { ascending: false }).limit(6)
  const { data: allOrders } = await supabase.from('orders').select('total_cents, status').eq('buyer_id', session.user.id)

  const totalSpend   = allOrders?.reduce((s, o) => s + o.total_cents, 0) || 0
  const activeOrders = allOrders?.filter(o => !['delivered', 'cancelled', 'refunded'].includes(o.status)).length || 0

  return (
    <div className="page-pad" style={{ padding: '2.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2.5rem', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <h1 className="type-heading reveal" style={{ color: 'var(--forest)', marginBottom: '0.375rem' }}>Welcome back 👋</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <p className="type-label" style={{ color: 'var(--moss)' }}>{profile?.business_name || profile?.full_name}</p>
            {isB2B && <span className="badge badge-sage">B2B Wholesale</span>}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className={`badge ${marketOpen ? 'badge-forest' : 'badge-olive'}`}>
            {marketOpen && <span className="status-dot status-live" />}
            {marketOpen ? 'Market live' : 'Market opens Wednesday 8am'}
          </span>
          <Link href="/marketplace" className="btn btn-forest btn-sm">Browse market →</Link>
        </div>
      </div>

      {/* ABN notice */}
      {isB2B && !profile?.abn_verified && (
        <div className="reveal" style={{ background: 'var(--olive)', border: '1px solid var(--sage)', borderRadius: '1.5rem', padding: '1.25rem 1.75rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '1.5rem' }}>⚠</span>
          <div>
            <p className="type-label" style={{ color: 'var(--forest)', marginBottom: '0.25rem' }}>ABN verification pending</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--moss)' }}>Your ABN is being verified. Wholesale pricing requires a verified ABN.</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
        {[
          { label: 'Total spend', value: formatPrice(totalSpend), sub: 'All time', icon: '💳', bg: 'var(--forest)', textClr: 'var(--cream)', subClr: 'var(--moss)', href: '/dashboard/buyer/orders' },
          { label: 'Active orders', value: String(activeOrders), sub: 'In progress', icon: '📦', bg: 'var(--sage)', textClr: 'var(--forest)', subClr: 'rgba(1,71,46,0.5)', href: '/dashboard/buyer/orders' },
          { label: 'Total orders', value: String(allOrders?.length || 0), sub: 'All time', icon: '🧾', bg: 'var(--olive)', textClr: 'var(--forest)', subClr: 'var(--moss)', href: '/dashboard/buyer/invoices' },
          { label: 'Account type', value: isB2B ? 'Wholesale' : 'Retail', sub: isB2B ? 'Ex-GST pricing' : 'Inc-GST pricing', icon: isB2B ? '🏪' : '🛍️', bg: 'white', textClr: 'var(--forest)', subClr: 'var(--moss)', href: '/marketplace' },
        ].map((s, i) => (
          <Link key={i} href={s.href} className={`reveal reveal-d${i + 1}`} style={{ display: 'block', background: s.bg, borderRadius: '2.5rem', padding: '2rem', boxShadow: '0 8px 32px rgba(1,71,46,0.2), 0 2px 8px rgba(1,71,46,0.06)', textDecoration: 'none' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.875rem' }}>{s.icon}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', color: s.textClr, letterSpacing: '-0.03em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>{s.value}</div>
            <div className="type-label" style={{ color: s.textClr, opacity: 0.7, marginBottom: '0.2rem' }}>{s.label}</div>
            <div className="type-label-sm" style={{ color: s.subClr }}>{s.sub}</div>
          </Link>
        ))}
      </div>

      {/* Recent orders */}
      <div className="card reveal" style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 className="type-label-lg" style={{ color: 'var(--forest)' }}>Recent orders</h2>
          <Link href="/dashboard/buyer/orders" className="type-label-sm" style={{ color: 'var(--moss)', textDecoration: 'underline', textUnderlineOffset: '3px' }}>View all →</Link>
        </div>
        {!orders?.length ? (
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛒</div>
            <p style={{ fontSize: '0.9rem', color: 'var(--moss)', marginBottom: '1.5rem' }}>No orders yet. Head to the market!</p>
            <Link href="/marketplace" className="btn btn-forest btn-sm">Browse marketplace</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {orders?.map(order => (
              <Link key={order.id} href={`/dashboard/buyer/orders/${order.id}`} className="table-row"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 0.5rem', gap: '1rem', textDecoration: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: 'var(--olive)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>📦</div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--forest)', marginBottom: '0.2rem' }}>{order.order_number}</p>
                    <p className="type-label-sm" style={{ color: 'var(--moss)' }}>{formatAEST(order.created_at, 'dd MMM yyyy')} · {order.fulfillment_type === 'hub_pickup' ? 'Hub pickup' : 'Delivery'}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <StatusBadge status={order.status} />
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--forest)', letterSpacing: '-0.02em' }}>{formatPrice(order.total_cents)}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
