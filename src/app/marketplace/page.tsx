'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/hooks/useCart'
import { formatPrice } from '@/lib/utils/pricing'
import { isMarketOpen } from '@/lib/utils/timezone'

const CATEGORIES = [
  { id: '', label: 'All' }, { id: 'flowers_cut', label: '✿ Cut Flowers' },
  { id: 'flowers_dried', label: '🌾 Dried' }, { id: 'foliage', label: '🍃 Foliage' },
  { id: 'vegetables', label: '🥦 Vegetables' }, { id: 'herbs', label: '🌿 Herbs' },
  { id: 'fruit', label: '🍓 Fruit' }, { id: 'eggs', label: '🥚 Eggs' },
  { id: 'honey', label: '🍯 Honey' },
]

const EMOJI: Record<string, string> = { flowers_cut: '🌸', flowers_dried: '🌾', foliage: '🍃', vegetables: '🥦', herbs: '🌿', fruit: '🍓', eggs: '🥚', honey: '🍯', other: '📦' }

export default function MarketplacePage() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('')
  const [isB2B, setIsB2B] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [marketOpen] = useState(isMarketOpen())
  const [search, setSearch] = useState('')
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const { addItem, updateQuantity, items, totalItems } = useCart()

  // Auto-detect buyer type from profile — buyers never see the toggle
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('role').eq('id', user.id).single().then(({ data }) => {
        const role = data?.role || null
        setUserRole(role)
        if (role === 'buyer_b2b') setIsB2B(true)
        else if (role === 'buyer_b2c') setIsB2B(false)
        // admin / farmer roles keep the default (true) and can toggle for preview
      })
    })
  }, [])

  // Buyers have their type auto-set; admins/farmers can toggle for browsing preview
  const isBuyer = userRole === 'buyer_b2b' || userRole === 'buyer_b2c'

  useEffect(() => {
    setLoading(true)
    fetch(`/api/products?b2b=${isB2B}${category ? `&category=${category}` : ''}`)
      .then(r => r.json()).then(d => { setProducts(d.data || []); setLoading(false) })
  }, [category, isB2B])

  function handleAdd(product: any) {
    addItem(product, 1, isB2B)
    setAddedIds(s => new Set([...s, product.id]))
    setTimeout(() => setAddedIds(s => { const n = new Set(s); n.delete(product.id); return n }), 1200)
  }

  function getCartQty(productId: string) {
    return items.find(i => i.product_id === productId)?.quantity || 0
  }

  const filtered = products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.farmers?.business_name?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>

      {/* ── Top nav ── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(255,247,249,0.9)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--olive)', padding: '1rem 2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', textDecoration: 'none', flexShrink: 0 }}>
          <div style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', color: 'var(--cream)', fontSize: '1rem' }}>B</div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--forest)', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>Bloom Lane</span>
        </Link>
        <div style={{ flex: 1, position: 'relative' }}>
          <svg style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: 'var(--moss)', pointerEvents: 'none' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input className="input" style={{ paddingLeft: '2.5rem', paddingTop: '0.6rem', paddingBottom: '0.6rem' }} placeholder="Search products or farms…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexShrink: 0 }}>
          <Link href="/dashboard" className="btn btn-ghost btn-sm">Dashboard</Link>
          <Link href="/checkout" className="btn btn-forest btn-sm" style={{ position: 'relative' }}>
            Cart
            {totalItems() > 0 && <span style={{ position: 'absolute', top: '-0.5rem', right: '-0.5rem', width: '1.25rem', height: '1.25rem', borderRadius: '50%', background: 'var(--sage)', color: 'var(--forest)', fontSize: '0.6rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{totalItems()}</span>}
          </Link>
        </div>
      </nav>

      {/* ── Mobile controls (hidden on desktop) ── */}
      <div className="market-cats-mobile" style={{ display: 'none', flexDirection: 'column', gap: '0', borderBottom: '1px solid var(--border-light)', background: 'white' }}>
        {/* B2B/B2C toggle — hidden for buyers (auto-set from profile) */}
        {!isBuyer && (
          <div style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid var(--border-light)' }}>
            <span className="type-label-sm" style={{ color: 'var(--moss)', flexShrink: 0 }}>View as</span>
            <div style={{ display: 'flex', background: 'var(--offwhite)', borderRadius: '99px', padding: '0.2rem', gap: '0.2rem' }}>
              {[{ id: true, l: 'Wholesale' }, { id: false, l: 'Retail' }].map(opt => (
                <button key={String(opt.id)} type="button" onClick={() => setIsB2B(opt.id)}
                  className="type-label-sm"
                  style={{ padding: '0.35rem 0.875rem', borderRadius: '99px', border: 'none', cursor: 'pointer', transition: 'all 0.18s', background: isB2B === opt.id ? 'var(--navy)' : 'transparent', color: isB2B === opt.id ? 'white' : 'var(--moss)' }}>
                  {opt.l}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* Category pills */}
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', padding: '0.75rem 1rem', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
          {CATEGORIES.map(cat => (
            <button key={cat.id} type="button" onClick={() => setCategory(cat.id)}
              style={{ flexShrink: 0, padding: '0.375rem 0.875rem', borderRadius: '99px', border: `1.5px solid ${category === cat.id ? 'var(--navy)' : 'var(--border)'}`, background: category === cat.id ? 'var(--navy)' : 'white', color: category === cat.id ? 'white' : 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Market status banner */}
      {marketOpen ? (
        <div style={{ padding: '0.75rem', textAlign: 'center', background: 'var(--forest)' }}>
          <span className="type-label" style={{ color: 'var(--sage)' }}>
            <span className="status-dot status-live" style={{ marginRight: '0.5rem' }} />
            Market is LIVE · Order before Wednesday 8:00 PM AEST
          </span>
        </div>
      ) : (
        <div style={{ padding: '0.75rem', textAlign: 'center', background: 'var(--olive)' }}>
          <span className="type-label" style={{ color: 'var(--forest)' }}>
            🕐 Market closed · Opens Wednesday 8:00 AM AEST · Browse now, order Wednesday
          </span>
        </div>
      )}

      <div className="market-layout" style={{ display: 'flex' }}>

        {/* Sidebar — hidden on mobile */}
        <aside className="market-sidebar" style={{ width: '13rem', flexShrink: 0, padding: '1.5rem', position: 'sticky', top: '4.5rem', height: 'calc(100vh - 4.5rem)', overflowY: 'auto', borderRight: '1px solid var(--olive)', background: 'white' }}>

          {/* B2B/B2C toggle — hidden for buyers (type auto-set from profile) */}
          {!isBuyer && (
            <div style={{ marginBottom: '1.75rem' }}>
              <p className="label" style={{ marginBottom: '0.75rem' }}>View as</p>
              <div className="card" style={{ padding: '0.25rem', display: 'flex', background: 'var(--olive)', borderRadius: '2rem' }}>
                {[{ id: true, l: 'Wholesale' }, { id: false, l: 'Retail' }].map(opt => (
                  <button key={String(opt.id)} type="button" onClick={() => setIsB2B(opt.id)}
                    className="type-label-sm"
                    style={{ flex: 1, padding: '0.5rem', borderRadius: '2rem', border: 'none', cursor: 'pointer', transition: 'all 0.2s ease', background: isB2B === opt.id ? 'var(--forest)' : 'transparent', color: isB2B === opt.id ? 'var(--cream)' : 'var(--moss)' }}>
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* Buyer type indicator for actual buyers */}
          {isBuyer && (
            <div style={{ marginBottom: '1.75rem', padding: '0.75rem 1rem', background: 'var(--olive)', borderRadius: '1rem' }}>
              <p className="type-label-sm" style={{ color: 'var(--forest)', fontWeight: 700 }}>
                {isB2B ? 'Wholesale pricing' : 'Retail pricing'}
              </p>
              <p className="type-label-sm" style={{ color: 'var(--moss)', marginTop: '0.2rem' }}>
                {isB2B ? 'Ex-GST · ABN required' : 'Inc-GST'}
              </p>
            </div>
          )}

          {/* Category */}
          <p className="label">Category</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            {CATEGORIES.map(cat => (
              <button key={cat.id} type="button" onClick={() => setCategory(cat.id)}
                className={`nav-item ${category === cat.id ? 'active' : ''}`} style={{ width: '100%', textAlign: 'left' }}>
                {cat.label}
              </button>
            ))}
          </div>
        </aside>

        {/* Product grid */}
        <main style={{ flex: 1, padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.75rem' }}>
            <h1 className="type-subheading" style={{ color: 'var(--forest)' }}>
              {category ? CATEGORIES.find(c => c.id === category)?.label : 'All Products'}
            </h1>
            <span className="type-label-sm" style={{ color: 'var(--moss)' }}>
              {loading ? '…' : `${filtered.length} products`}
            </span>
          </div>

          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(14rem, 1fr))', gap: '1.25rem' }}>
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="card" style={{ height: '17rem', background: 'var(--olive)' }} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '6rem 0' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🌾</div>
              <h3 className="type-subheading" style={{ color: 'var(--forest)', marginBottom: '0.75rem' }}>No products listed yet</h3>
              <p className="type-label" style={{ color: 'var(--moss)' }}>Growers list Sunday–Tuesday · Market opens Wednesday</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(14rem, 1fr))', gap: '1.25rem' }}>
              {filtered.map((product, i) => {
                const available = isB2B ? product.b2b_available : product.b2c_available
                const displayPrice = isB2B
                  ? (product.b2b_display_price || product.wholesale_price)
                  : (product.b2c_display_price || product.buyer_unit_price || product.wholesale_price)
                const priceLabel = isB2B
                  ? (product.is_gst_free ? 'ex-GST · GST free' : 'ex-GST')
                  : (product.is_gst_free ? 'inc-GST · GST free' : 'inc-GST')
                return (
                  <div key={product.id} className="card card-hover reveal" style={{ display: 'flex', flexDirection: 'column', animationDelay: `${i * 40}ms` }}>
                    <div style={{ height: '9rem', background: 'var(--olive)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3.5rem', position: 'relative', flexShrink: 0, overflow: 'hidden', borderRadius: 'var(--r-card) var(--r-card) 0 0' }}>
                      {product.image_url ? <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : EMOJI[product.category] || '🌿'}
                      {product.is_gst_free && <span className="badge badge-sage" style={{ position: 'absolute', top: '0.625rem', left: '0.625rem' }}>GST Free</span>}
                    </div>
                    <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <Link href={`/growers/${product.farmer_id}`} onClick={e => e.stopPropagation()} className="type-label-sm farm-name-link" style={{ color: 'var(--moss)', marginBottom: '0.25rem', textDecoration: 'none', display: 'block' }}>
                        {product.farmers?.business_name}
                      </Link>
                      <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--forest)', marginBottom: '0.25rem', lineHeight: 1.3 }}>{product.name}</p>
                      <p className="type-label-sm" style={{ color: 'var(--moss)', marginBottom: '1rem' }}>per {product.unit} · {available} left</p>
                      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 'auto' }}>
                        <div>
                          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--forest)', letterSpacing: '-0.03em', textTransform: 'uppercase' }}>{formatPrice(displayPrice)}</div>
                          <div className="type-label-sm" style={{ color: 'var(--moss)' }}>
                            {priceLabel}
                            {isB2B && !product.is_gst_free && (
                              <span style={{ marginLeft: '0.35rem', opacity: 0.6 }}>· {formatPrice(product.buyer_unit_price || Math.round(product.wholesale_price * 1.1))} inc-GST</span>
                            )}
                          </div>
                        </div>
                        {!marketOpen ? (
                          <span className="type-label-sm" style={{ color: 'var(--moss)' }}>Closed</span>
                        ) : available === 0 ? (
                          <span className="type-label-sm" style={{ color: '#b91c1c' }}>Sold out</span>
                        ) : getCartQty(product.id) === 0 ? (
                          <button onClick={() => handleAdd(product)} className="btn btn-forest btn-sm">Add</button>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'var(--forest)', borderRadius: '99px', padding: '0.2rem 0.25rem' }}>
                            <button onClick={() => updateQuantity(product.id, getCartQty(product.id) - 1)}
                              style={{ width: '1.75rem', height: '1.75rem', borderRadius: '50%', border: 'none', background: 'rgba(255,247,249,0.2)', color: 'var(--cream)', cursor: 'pointer', fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                            <span style={{ color: 'var(--cream)', fontWeight: 700, fontSize: '0.875rem', minWidth: '1.25rem', textAlign: 'center' }}>{getCartQty(product.id)}</span>
                            <button onClick={() => handleAdd(product)} disabled={getCartQty(product.id) >= available}
                              style={{ width: '1.75rem', height: '1.75rem', borderRadius: '50%', border: 'none', background: getCartQty(product.id) >= available ? 'rgba(255,247,249,0.1)' : 'rgba(255,247,249,0.2)', color: 'var(--cream)', cursor: getCartQty(product.id) >= available ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
