import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils/pricing'
import { isListingWindowOpen, formatAEST } from '@/lib/utils/timezone'

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = { payment_confirmed: 'badge-olive', preparing: 'badge-olive', delivered: 'badge-sage', disputed: 'badge-red', cancelled: 'badge-cream' }
  return <span className={`badge ${map[status] || 'badge-cream'}`}>{status?.replace(/_/g, ' ')}</span>
}

export default async function FarmerDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: farmer } = await supabase.from('farmers').select('id, user_id, business_name, bio, brand_color, suburb, state, postcode, status, stripe_account_id, stripe_onboarding_complete, commission_rate, abn, abn_verified, created_at').eq('user_id', user.id).single()

  // No farmer record yet — render setup prompt inline, NO redirect
  // Redirects cause loops: /dashboard/farmer → /dashboard/farmer/storefront → back
  if (!farmer) {
    return (
      <div style={{ padding: '3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', maxWidth: '28rem' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '1.5rem' }}>🌿</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: 'var(--forest)', marginBottom: '1rem' }}>
            Set up your farm profile
          </h2>
          <p style={{ color: 'var(--forest)', opacity: 0.6, marginBottom: '2rem', lineHeight: 1.7 }}>
            Complete your farmer profile to start listing products and receiving orders on Bloom Lane.
          </p>
          <Link href="/dashboard/farmer/storefront"
            style={{ display: 'inline-block', background: 'var(--forest)', color: 'var(--cream)', padding: '0.875rem 2.5rem', borderRadius: '99px', textDecoration: 'none', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.95rem' }}>
            Create Farm Profile →
          </Link>
        </div>
      </div>
    )
  }

  if (farmer.status === 'pending_approval') return (
    <div style={{ padding: '3rem', maxWidth: '32rem' }}>
      <div className="card-forest reveal" style={{ padding: '3.5rem', textAlign: 'center' }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '1.25rem' }}>⏳</div>
        <h2 className="type-subheading" style={{ color: 'var(--cream)', marginBottom: '1rem' }}>Application under review</h2>
        <p className="type-label" style={{ color: 'var(--moss)', lineHeight: 1.8 }}>Our team reviews all grower applications within 24 hours. You'll receive an email when approved.</p>
      </div>
    </div>
  )

  const [{ data: products }, { data: recentOrders }, { data: payouts }] = await Promise.all([
    supabase.from('products').select('*').eq('farmer_id', farmer.id),
    supabase.from('order_items').select('*, orders(status, created_at, order_number), products(name)').eq('farmer_id', farmer.id).order('created_at', { ascending: false }).limit(5),
    supabase.from('payouts').select('*').eq('farmer_id', farmer.id),
  ])

  const totalRevenue  = payouts?.reduce((s, p) => s + p.net_amount_cents, 0) || 0
  const pendingPayout = payouts?.filter(p => p.status === 'pending').reduce((s, p) => s + p.net_amount_cents, 0) || 0
  const listedCount   = products?.filter(p => p.is_listed_this_week).length || 0
  const listingOpen   = isListingWindowOpen()

  return (
    <div style={{ padding: '2.5rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2.5rem', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <h1 className="type-heading reveal" style={{ color: 'var(--forest)', marginBottom: '0.375rem' }}>Good morning 🌱</h1>
          <p className="type-label" style={{ color: 'var(--moss)' }}>{farmer.business_name}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className={`badge ${listingOpen ? 'badge-sage' : 'badge-olive'}`}>
            {listingOpen && <span className="status-dot status-live" />}
            {listingOpen ? 'Listing window open' : 'Window closed'}
          </span>
          <Link href="/dashboard/farmer/inventory/new" className="btn btn-forest btn-sm">+ Add product</Link>
        </div>
      </div>

      {/* Stripe alert */}
      {!farmer.stripe_onboarding_complete && (
        <div className="reveal" style={{ background: 'var(--olive)', border: '1px solid var(--sage)', borderRadius: '1.5rem', padding: '1.25rem 1.75rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
          <div>
            <p className="type-label" style={{ color: 'var(--forest)', marginBottom: '0.25rem' }}>⚠ Complete your payout setup</p>
            <p style={{ fontSize: '0.8rem', color: 'var(--moss)' }}>Connect your bank account via Stripe to receive payments.</p>
          </div>
          <Link href="/dashboard/farmer/stripe" className="btn btn-forest btn-sm" style={{ flexShrink: 0 }}>Setup payouts →</Link>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
        {[
          { label: 'Total earned', value: formatPrice(totalRevenue), sub: 'All time net', icon: '💰', bg: 'var(--forest)', textClr: 'var(--cream)', subClr: 'var(--moss)' },
          { label: 'Pending payout', value: formatPrice(pendingPayout), sub: 'Processing soon', icon: '⏳', bg: 'var(--sage)', textClr: 'var(--forest)', subClr: 'rgba(1,71,46,0.5)' },
          { label: 'Listed this week', value: String(listedCount), sub: 'Active listings', icon: '📋', bg: 'var(--olive)', textClr: 'var(--forest)', subClr: 'var(--moss)' },
          { label: 'Total products', value: String(products?.length || 0), sub: 'In catalogue', icon: '🌿', bg: 'white', textClr: 'var(--forest)', subClr: 'var(--moss)' },
        ].map((s, i) => (
          <div key={i} className={`reveal reveal-d${i + 1}`} style={{ background: s.bg, borderRadius: '2.5rem', padding: '2rem', boxShadow: '0 8px 32px rgba(1,71,46,0.2), 0 2px 8px rgba(1,71,46,0.06)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.875rem' }}>{s.icon}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: s.textClr, letterSpacing: '-0.03em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>{s.value}</div>
            <div className="type-label" style={{ color: s.textClr, opacity: 0.7, marginBottom: '0.2rem' }}>{s.label}</div>
            <div className="type-label-sm" style={{ color: s.subClr }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>

        {/* Inventory panel */}
        <div className="card reveal" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 className="type-label-lg" style={{ color: 'var(--forest)' }}>This week's listings</h2>
            <Link href="/dashboard/farmer/inventory" className="type-label-sm" style={{ color: 'var(--moss)', textDecoration: 'underline', textUnderlineOffset: '3px' }}>View all →</Link>
          </div>
          {!products?.length ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 0' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--moss)', marginBottom: '1.25rem' }}>No products yet.</p>
              <Link href="/dashboard/farmer/inventory/new" className="btn btn-forest btn-sm">Add first product</Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {products?.slice(0, 5).map(p => (
                <div key={p.id} className="table-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 0', gap: '1rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--forest)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                    <p className="type-label-sm" style={{ color: 'var(--moss)' }}>{p.b2b_available} B2B · {p.b2c_available} B2C left</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexShrink: 0 }}>
                    <span className={`badge ${p.is_listed_this_week ? 'badge-sage' : 'badge-olive'}`}>{p.is_listed_this_week ? 'Listed' : 'Unlisted'}</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--forest)', letterSpacing: '-0.02em' }}>{formatPrice(p.wholesale_price)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent orders */}
        <div className="card reveal reveal-d2" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 className="type-label-lg" style={{ color: 'var(--forest)' }}>Recent orders</h2>
            <Link href="/dashboard/farmer/orders" className="type-label-sm" style={{ color: 'var(--moss)', textDecoration: 'underline', textUnderlineOffset: '3px' }}>View all →</Link>
          </div>
          {!recentOrders?.length ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 0' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--moss)' }}>No orders yet. List products to get started.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {recentOrders?.map(item => (
                <div key={item.id} className="table-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.875rem 0', gap: '1rem' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--forest)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(item as any).products?.name} × {item.quantity}</p>
                    <p className="type-label-sm" style={{ color: 'var(--moss)' }}>{(item as any).orders?.order_number} · {formatAEST((item as any).orders?.created_at, 'dd MMM')}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexShrink: 0 }}>
                    <StatusBadge status={(item as any).orders?.status} />
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--forest)', letterSpacing: '-0.02em' }}>{formatPrice(item.subtotal_cents)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
