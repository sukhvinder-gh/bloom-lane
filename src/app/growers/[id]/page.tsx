import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { formatPrice, getBuyerUnitPrice } from '@/lib/utils/pricing'

const EMOJI: Record<string, string> = { flowers_cut: '🌸', flowers_dried: '🌾', foliage: '🍃', vegetables: '🥦', herbs: '🌿', fruit: '🍓', eggs: '🥚', honey: '🍯', other: '📦' }

export default async function GrowerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: farmer } = await admin
    .from('farmers')
    .select(`
      id, business_name, bio, suburb, state,
      brand_color, banner_url, logo_url,
      region, growing_practices, seasonal_specialties, sustainability,
      created_at
    `)
    .eq('id', id)
    .eq('status', 'approved')
    .single()

  if (!farmer) notFound()

  const { data: products } = await admin
    .from('products')
    .select('id, name, category, unit, wholesale_price, b2c_markup_pct, b2c_available, image_url, is_gst_free')
    .eq('farmer_id', id)
    .eq('is_active', true)
    .gt('b2c_available', 0)
    .order('category')

  const memberSince = new Date(farmer.created_at).getFullYear()

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(255,247,249,0.9)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border-light)', padding: '1rem 2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', textDecoration: 'none', flexShrink: 0 }}>
          <div style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', color: 'var(--cream)', fontSize: '1rem' }}>B</div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--navy)', fontWeight: 600 }}>The Green Guild</span>
        </Link>
        <div style={{ flex: 1 }} />
        <Link href="/growers" className="btn btn-ghost btn-sm">← All Growers</Link>
        <Link href="/marketplace" className="btn btn-forest btn-sm">Shop Now</Link>
      </nav>

      {/* Banner */}
      <div style={{ height: '14rem', background: farmer.brand_color || 'var(--navy)', position: 'relative', overflow: 'hidden' }}>
        {farmer.banner_url && <img src={farmer.banner_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.45))' }} />
      </div>

      <div style={{ maxWidth: '56rem', margin: '0 auto', padding: '0 2rem 4rem' }}>

        {/* Header card */}
        <div className="card reveal" style={{ padding: '2rem', marginTop: '-3rem', position: 'relative', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* Logo / avatar */}
            <div style={{ width: '4.5rem', height: '4.5rem', borderRadius: '1rem', background: farmer.brand_color || 'var(--navy)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid white', boxShadow: 'var(--shadow-card)', overflow: 'hidden' }}>
              {farmer.logo_url
                ? <img src={farmer.logo_url} alt={farmer.business_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: '1.75rem' }}>{farmer.business_name[0]}</span>
              }
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 className="type-heading" style={{ color: 'var(--navy)', marginBottom: '0.25rem' }}>{farmer.business_name}</h1>
              <p className="type-label" style={{ color: 'var(--moss)', marginBottom: '0.75rem' }}>
                📍 {[farmer.region, farmer.suburb, farmer.state].filter(Boolean).join(', ')}
                {' · '}Member since {memberSince}
              </p>
              {farmer.sustainability?.length > 0 && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {farmer.sustainability.map((s: string) => (
                    <span key={s} className="badge badge-sage">{s}</span>
                  ))}
                </div>
              )}
            </div>
            <Link href="/marketplace" className="btn btn-forest btn-sm" style={{ flexShrink: 0 }}>
              Shop their products →
            </Link>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 18rem', gap: '1.5rem', alignItems: 'start' }}>

          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* About */}
            {farmer.bio && (
              <div className="card reveal" style={{ padding: '1.75rem' }}>
                <h2 className="type-label-lg" style={{ color: 'var(--navy)', marginBottom: '1rem' }}>About the Farm</h2>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{farmer.bio}</p>
              </div>
            )}

            {/* Growing practices */}
            {farmer.growing_practices && (
              <div className="card reveal" style={{ padding: '1.75rem' }}>
                <h2 className="type-label-lg" style={{ color: 'var(--navy)', marginBottom: '1rem' }}>Growing Practices</h2>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{farmer.growing_practices}</p>
              </div>
            )}

            {/* Current listings */}
            {products && products.length > 0 && (
              <div id="products" className="card reveal" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '1.25rem 1.75rem', borderBottom: '1px solid var(--border-light)' }}>
                  <h2 className="type-label-lg" style={{ color: 'var(--navy)' }}>Products in Stock</h2>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(12rem, 1fr))', gap: '1px', background: 'var(--border-light)' }}>
                  {products.map(p => (
                    <div key={p.id} style={{ background: 'white', padding: '1rem' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{EMOJI[p.category] || '🌿'}</div>
                      <p style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--navy)', marginBottom: '0.15rem' }}>{p.name}</p>
                      <p className="type-label-sm" style={{ color: 'var(--moss)', marginBottom: '0.5rem' }}>per {p.unit} · {p.b2c_available} left</p>
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--navy)', letterSpacing: '-0.02em' }}>
                        {formatPrice(getBuyerUnitPrice(p, false))}
                      </p>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '1rem 1.75rem', borderTop: '1px solid var(--border-light)', textAlign: 'center' }}>
                  <Link href="/marketplace" className="btn btn-forest btn-sm">Order from {farmer.business_name} →</Link>
                </div>
              </div>
            )}
          </div>

          {/* Right column — sidebar info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Location — suburb/state only, NOT street address */}
            <div className="card reveal" style={{ padding: '1.5rem' }}>
              <h2 className="type-label-lg" style={{ color: 'var(--navy)', marginBottom: '0.875rem' }}>Farm Location</h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {[farmer.region, farmer.suburb, farmer.state].filter(Boolean).join(', ') || 'Australia'}
              </p>
              <p className="type-label-sm" style={{ color: 'var(--moss)', marginTop: '0.5rem' }}>
                Exact address not shown — orders are delivered to your hub or door.
              </p>
            </div>

            {/* Seasonal specialties */}
            {farmer.seasonal_specialties?.length > 0 && (
              <div className="card reveal" style={{ padding: '1.5rem' }}>
                <h2 className="type-label-lg" style={{ color: 'var(--navy)', marginBottom: '0.875rem' }}>Seasonal Specialties</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {farmer.seasonal_specialties.map((s: string) => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: farmer.brand_color || 'var(--sage-new)', flexShrink: 0, display: 'block' }} />
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sustainability */}
            {farmer.sustainability?.length > 0 && (
              <div className="card reveal" style={{ padding: '1.5rem' }}>
                <h2 className="type-label-lg" style={{ color: 'var(--navy)', marginBottom: '0.875rem' }}>Sustainability</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {farmer.sustainability.map((s: string) => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      <span style={{ fontSize: '0.875rem' }}>✓</span>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No contact details — explicitly */}
            <div style={{ padding: '1rem 1.25rem', background: 'var(--offwhite)', borderRadius: '0.75rem', border: '1px solid var(--border-light)' }}>
              <p className="type-label-sm" style={{ color: 'var(--moss)' }}>
                Contact details are not listed. All orders and communication happen through the The Green Guild platform.
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
