import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils/pricing'
import { formatAEST, isListingWindowOpen, isMarketOpen } from '@/lib/utils/timezone'

function AdminStatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    pending_payment:  ['badge-cream',  '⏳ Pending'],
    payment_confirmed:['badge-olive',  '💳 Paid'],
    preparing:        ['badge-olive',  '⚙ Preparing'],
    ready_for_pickup: ['badge-sage',   '📦 Ready'],
    out_for_delivery: ['badge-sage',   '🚚 Transit'],
    delivered:        ['badge-forest', '✓ Delivered'],
    disputed:         ['badge-red',    '🚨 Disputed'],
    cancelled:        ['badge-cream',  '✕ Cancelled'],
  }
  const [cls, label] = map[status] || ['badge-cream', status]
  return <span className={`badge ${cls}`}>{label}</span>
}

export default async function AdminDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')
  // Role check is handled by the dashboard layout — no redundant DB call needed here

  const [
    { count: totalFarmers },
    { count: totalBuyers },
    { count: pendingFarmers },
    { data: recentOrders },
    { data: pendingPayouts },
    { data: disputes },
  ] = await Promise.all([
    supabase.from('farmers').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).in('role', ['buyer_b2b', 'buyer_b2c']),
    supabase.from('farmers').select('*', { count: 'exact', head: true }).eq('status', 'pending_approval'),
    supabase.from('orders').select('*, profiles(full_name)').order('created_at', { ascending: false }).limit(8),
    supabase.from('payouts').select('*').eq('status', 'pending'),
    supabase.from('disputes').select('*, orders(order_number), profiles(full_name)').is('resolved_at', null),
  ])

  const gmv = recentOrders?.reduce((s, o) => s + o.total_cents, 0) || 0
  const pendingPayoutTotal = pendingPayouts?.reduce((s, p) => s + p.net_amount_cents, 0) || 0
  const listingOpen = isListingWindowOpen()
  const marketOpen = isMarketOpen()

  return (
    <div style={{ padding: '2.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2.5rem', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <h1 className="type-heading reveal" style={{ color: 'var(--forest)', marginBottom: '0.375rem' }}>Platform Overview</h1>
          <p className="type-label" style={{ color: 'var(--moss)' }}>{new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <span className={`badge ${listingOpen ? 'badge-sage' : 'badge-olive'}`}>
            {listingOpen && <span className="status-dot status-live" />}
            {listingOpen ? 'Listing open' : 'Listing closed'}
          </span>
          <span className={`badge ${marketOpen ? 'badge-forest' : 'badge-olive'}`}>
            {marketOpen && <span className="status-dot status-live" />}
            {marketOpen ? 'Market live' : 'Market closed'}
          </span>
        </div>
      </div>

      {/* Alerts */}
      {(pendingFarmers || 0) > 0 && (
        <div className="reveal" style={{ background: 'var(--olive)', border: '1px solid var(--sage)', borderRadius: '1.5rem', padding: '1.25rem 1.75rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
          <p className="type-label-sm" style={{ color: 'var(--forest)' }}>⚠ {pendingFarmers} grower {pendingFarmers === 1 ? 'application' : 'applications'} awaiting approval</p>
          <Link href="/dashboard/admin/farmers?filter=pending" className="btn btn-forest btn-sm">Review →</Link>
        </div>
      )}
      {(disputes?.length || 0) > 0 && (
        <div className="reveal" style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '1.5rem', padding: '1.25rem 1.75rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
          <p className="type-label-sm" style={{ color: '#b91c1c' }}>🚨 {disputes?.length} open {disputes?.length === 1 ? 'dispute' : 'disputes'} requiring resolution</p>
          <Link href="/dashboard/admin/disputes" className="btn btn-sm" style={{ background: '#b91c1c', color: 'white' }}>Resolve →</Link>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
        {[
          { label: 'Active Growers', value: String(totalFarmers || 0), sub: `${pendingFarmers} pending`, icon: '🌿', bg: 'var(--forest)', textClr: 'var(--cream)', subClr: 'var(--moss)' },
          { label: 'Total Buyers', value: String(totalBuyers || 0), sub: 'B2B + B2C', icon: '🏪', bg: 'var(--sage)', textClr: 'var(--forest)', subClr: 'rgba(1,71,46,0.5)' },
          { label: 'GMV (recent)', value: formatPrice(gmv), sub: 'Last 8 orders', icon: '💰', bg: 'var(--olive)', textClr: 'var(--forest)', subClr: 'var(--moss)' },
          { label: 'Pending Payouts', value: formatPrice(pendingPayoutTotal), sub: `${pendingPayouts?.length || 0} farmers`, icon: '⏳', bg: 'white', textClr: 'var(--forest)', subClr: 'var(--moss)' },
        ].map((s, i) => (
          <div key={i} className={`reveal reveal-d${i + 1}`} style={{ background: s.bg, borderRadius: '2.5rem', padding: '2rem', boxShadow: '0 8px 32px rgba(1,71,46,0.2), 0 2px 8px rgba(1,71,46,0.06)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.875rem' }}>{s.icon}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', color: s.textClr, letterSpacing: '-0.03em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>{s.value}</div>
            <div className="type-label" style={{ color: s.textClr, opacity: 0.7, marginBottom: '0.2rem' }}>{s.label}</div>
            <div className="type-label-sm" style={{ color: s.subClr }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1.75rem', alignItems: 'start' }}>

        {/* Orders table */}
        <div className="card reveal" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem 2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--olive)' }}>
            <h2 className="type-label-lg" style={{ color: 'var(--forest)' }}>Order Command Center</h2>
            <Link href="/dashboard/admin/orders" className="type-label-sm" style={{ color: 'var(--moss)', textDecoration: 'underline', textUnderlineOffset: '3px' }}>View all →</Link>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--olive)', borderBottom: '1px solid var(--sage)' }}>
                {['Order', 'Buyer', 'Type', 'Status', 'Total'].map((h, i) => (
                  <th key={h} className="type-label-sm" style={{ padding: '0.875rem 1.25rem', textAlign: i >= 4 ? 'right' : i === 3 ? 'center' : 'left', color: 'var(--moss)', letterSpacing: '0.2em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentOrders?.map(order => (
                <tr key={order.id} className="table-row">
                  <td style={{ padding: '0.875rem 1.25rem' }}>
                    <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', color: 'var(--forest)', letterSpacing: '-0.01em', textTransform: 'uppercase' }}>{order.order_number}</p>
                    <p className="type-label-sm" style={{ color: 'var(--moss)' }}>{formatAEST(order.created_at, 'dd MMM, h:mma')}</p>
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem' }}><p style={{ fontSize: '0.8rem', color: 'var(--forest)', fontWeight: 700 }}>{(order as any).profiles?.full_name}</p></td>
                  <td style={{ padding: '0.875rem 1.25rem', textAlign: 'center', fontSize: '1.25rem' }}>{order.fulfillment_type === 'hub_pickup' ? '🏭' : '🚚'}</td>
                  <td style={{ padding: '0.875rem 1.25rem', textAlign: 'center' }}><AdminStatusBadge status={order.status} /></td>
                  <td style={{ padding: '0.875rem 1.25rem', textAlign: 'right' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--forest)', letterSpacing: '-0.02em' }}>{formatPrice(order.total_cents)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Quick actions */}
        <div style={{ width: '14rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card reveal" style={{ padding: '1.75rem' }}>
            <h3 className="type-label-lg" style={{ color: 'var(--forest)', marginBottom: '1rem' }}>Quick Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {[
                { href: '/dashboard/admin/farmers?filter=pending', label: 'Approve growers', icon: '✓', count: pendingFarmers || 0 },
                { href: '/dashboard/admin/orders?view=packing', label: 'Packing list', icon: '📦', count: 0 },
                { href: '/dashboard/admin/payouts', label: 'Process payouts', icon: '💸', count: pendingPayouts?.length || 0 },
                { href: '/dashboard/admin/disputes', label: 'Resolve disputes', icon: '🛡', count: disputes?.length || 0 },
                { href: '/dashboard/admin/config', label: 'Platform config', icon: '⚙', count: 0 },
              ].map(action => (
                <Link key={action.href} href={action.href} className="nav-item" style={{ justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <span style={{ width: '1.25rem', textAlign: 'center' }}>{action.icon}</span>
                    {action.label}
                  </span>
                  {action.count > 0 && <span className="badge badge-sage">{action.count}</span>}
                </Link>
              ))}
            </div>
          </div>

          {(disputes?.length || 0) > 0 && (
            <div className="card reveal reveal-d2" style={{ padding: '1.75rem' }}>
              <h3 className="type-label-lg" style={{ color: 'var(--forest)', marginBottom: '1rem' }}>Open Disputes</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {disputes?.slice(0, 3).map(d => (
                  <div key={d.id} style={{ padding: '0.875rem', borderRadius: '1rem', background: '#fee2e2' }}>
                    <p className="type-label-sm" style={{ color: '#b91c1c', marginBottom: '0.25rem' }}>{(d as any).orders?.order_number}</p>
                    <p style={{ fontSize: '0.7rem', color: '#b91c1c', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.reason}</p>
                    <p className="type-label-sm" style={{ color: '#dc2626', opacity: 0.6, marginTop: '0.25rem' }}>by {(d as any).profiles?.full_name}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
