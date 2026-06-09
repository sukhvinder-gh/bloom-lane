import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

const STATUS_INFO: Record<string, { label: string; color: string; bg: string; hint: string }> = {
  approved:         { label: '✓ Approved',        color: 'var(--forest)',  bg: 'var(--sage)',        hint: 'Your profile is live and visible to buyers.' },
  pending_approval: { label: '⏳ Pending Approval', color: '#92400e',        bg: '#fef9c3',            hint: 'An admin will review your application shortly.' },
  suspended:        { label: '✕ Suspended',         color: 'var(--bloom)',   bg: 'var(--bloom-soft)',  hint: 'Contact support to resolve your account status.' },
}

export default async function FarmerOverviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: farmer } = await supabase
    .from('farmers')
    .select('id, business_name, status, region, suburb, state, sustainability, seasonal_specialties')
    .eq('user_id', user.id)
    .single()

  const { count: orderCount } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')

  const { count: productCount } = await supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('farmer_id', farmer?.id || '')
    .eq('is_active', true)

  const status = farmer?.status ? STATUS_INFO[farmer.status] : null

  return (
    <div className="page-pad">

      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="type-heading reveal" style={{ color: 'var(--navy)', marginBottom: '0.25rem' }}>
          {farmer ? farmer.business_name : 'Welcome'}
        </h1>
        {status && (
          <span style={{ display: 'inline-block', padding: '0.25rem 0.875rem', borderRadius: '99px', background: status.bg, color: status.color, fontSize: '0.8rem', fontWeight: 600 }}>
            {status.label}
          </span>
        )}
        {status && (
          <p className="type-label" style={{ color: 'var(--moss)', marginTop: '0.5rem' }}>{status.hint}</p>
        )}
      </div>

      {/* No profile yet */}
      {!farmer && (
        <div className="card reveal" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <p style={{ fontSize: '2rem', marginBottom: '1rem' }}>🌱</p>
          <h2 className="type-label-lg" style={{ color: 'var(--navy)', marginBottom: '0.5rem' }}>Set up your farm profile</h2>
          <p style={{ color: 'var(--moss)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Create your grower profile to start listing products and getting discovered by buyers.
          </p>
          <Link href="/dashboard/farmer/storefront" className="btn btn-forest">Create Profile →</Link>
        </div>
      )}

      {farmer && (
        <>
          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(10rem, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'Active Products',  value: productCount ?? 0,  icon: '📋', href: '/dashboard/farmer/inventory' },
              { label: 'Pending Orders',   value: orderCount ?? 0,    icon: '📦', href: '/dashboard/farmer/orders' },
            ].map(s => (
              <Link key={s.label} href={s.href} style={{ textDecoration: 'none' }}>
                <div className="card reveal" style={{ padding: '1.25rem 1.5rem', cursor: 'pointer' }}>
                  <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{s.icon}</p>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 700, color: 'var(--navy)', lineHeight: 1 }}>{s.value}</p>
                  <p className="type-label-sm" style={{ color: 'var(--moss)', marginTop: '0.25rem' }}>{s.label}</p>
                </div>
              </Link>
            ))}
          </div>

          {/* Quick actions */}
          <div className="card reveal" style={{ overflow: 'hidden', marginBottom: '1.5rem' }}>
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-light)', background: 'var(--offwhite)' }}>
              <h2 className="type-label-lg" style={{ color: 'var(--navy)' }}>Quick Actions</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))', gap: '1px', background: 'var(--border-light)' }}>
              {[
                { icon: '🏪', label: 'Edit Storefront',    desc: 'Update bio, region, growing practices, sustainability',  href: '/dashboard/farmer/storefront' },
                { icon: '📋', label: 'Manage Inventory',   desc: 'List products and set stock for this week',               href: '/dashboard/farmer/inventory' },
                { icon: '📦', label: 'View Orders',        desc: 'See incoming orders and update fulfilment status',         href: '/dashboard/farmer/orders' },
                { icon: '💰', label: 'Payouts',            desc: 'Check your earnings and payout history',                   href: '/dashboard/farmer/payouts' },
              ].map(a => (
                <Link key={a.href} href={a.href} className="farmer-action-card" style={{ textDecoration: 'none', background: 'white', padding: '1.25rem 1.5rem', display: 'block' }}>
                  <p style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{a.icon}</p>
                  <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--navy)', marginBottom: '0.2rem' }}>{a.label}</p>
                  <p className="type-label-sm" style={{ color: 'var(--moss)' }}>{a.desc}</p>
                </Link>
              ))}
            </div>
          </div>

          {/* Profile completeness nudge */}
          {(!farmer.region || !farmer.sustainability?.length) && (
            <div className="card reveal" style={{ padding: '1.25rem 1.5rem', background: 'var(--bloom-soft)', border: '1px solid var(--bloom-mid)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--navy)', marginBottom: '0.2rem' }}>Complete your public profile</p>
                  <p className="type-label-sm" style={{ color: 'var(--moss)' }}>
                    Add your region, growing practices, and sustainability badges to get discovered by buyers browsing the grower directory.
                  </p>
                </div>
                <Link href="/dashboard/farmer/storefront" className="btn btn-forest btn-sm" style={{ flexShrink: 0 }}>
                  Complete Profile →
                </Link>
              </div>
            </div>
          )}

          {/* View public profile */}
          {farmer.status === 'approved' && (
            <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
              <Link href={`/growers/${farmer.id}`} className="type-label-sm" style={{ color: 'var(--moss)', textDecoration: 'none' }}>
                View your public grower profile →
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}
