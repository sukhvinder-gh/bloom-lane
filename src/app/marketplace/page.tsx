'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useCart } from '@/hooks/useCart'
import { formatPrice, getPricePerStemCents } from '@/lib/utils/pricing'
import { isMarketOpen } from '@/lib/utils/timezone'
import { COLOR_PALETTE } from '@/lib/data/flowerSpecies'

const CATEGORIES = [
  { id: '', label: 'All' }, { id: 'flowers_cut', label: '✿ Cut Flowers' },
  { id: 'flowers_dried', label: '🌾 Dried' }, { id: 'flowers_native', label: '🌼 Natives' },
  { id: 'foliage', label: '🍃 Foliage' },
  { id: 'vegetables', label: '🥦 Vegetables' }, { id: 'herbs', label: '🌿 Herbs' },
  { id: 'fruit', label: '🍓 Fruit' }, { id: 'eggs', label: '🥚 Eggs' },
  { id: 'honey', label: '🍯 Honey' }, { id: 'other', label: '📦 Other' },
]

// Non-flower categories aren't fully supported yet — shown but disabled
// with a "Coming soon" note rather than hidden entirely.
const COMING_SOON_CATEGORIES = new Set(['vegetables', 'herbs', 'fruit', 'eggs', 'honey', 'other'])

const CATEGORY_LABEL: Record<string, string> = {
  flowers_cut: 'Cut Flowers', flowers_dried: 'Dried Flowers', flowers_native: 'Australian Natives', foliage: 'Foliage',
  vegetables: 'Vegetables', herbs: 'Herbs', fruit: 'Fruit', eggs: 'Eggs', honey: 'Honey', other: 'Other',
}

const EMOJI: Record<string, string> = {
  flowers_cut: '🌸', flowers_dried: '🌾', flowers_native: '🌼', foliage: '🍃', vegetables: '🥦',
  herbs: '🌿', fruit: '🍓', eggs: '🥚', honey: '🍯', other: '📦',
}

function productImages(p: any): string[] {
  const all: string[] = []
  if (p.image_url) all.push(p.image_url)
  if (Array.isArray(p.image_urls)) {
    for (const u of p.image_urls) {
      if (u && !all.includes(u)) all.push(u)
    }
  }
  return all
}

// ── Product detail drawer ────────────────────────────────────────────────────
function ProductDrawer({
  product, isB2B, isAdminOrFarmer, authLoaded, marketOpen, cartQty,
  onAdd, onUpdateQty, onClose,
}: {
  product: any; isB2B: boolean; isAdminOrFarmer: boolean; authLoaded: boolean;
  marketOpen: boolean; cartQty: number;
  onAdd: () => void; onUpdateQty: (qty: number) => void; onClose: () => void;
}) {
  const images = productImages(product)
  const [imgIdx, setImgIdx] = useState(0)
  const available = isB2B ? product.b2b_available : product.b2c_available
  const displayPrice = isB2B
    ? (product.b2b_display_price ?? product.wholesale_price)
    : (product.b2c_display_price ?? product.buyer_unit_price ?? product.wholesale_price)
  // "GST Free" only means something for a registered grower's exempt product —
  // an unregistered grower never charges GST at all, so labelling their items
  // "GST Free" implies a tax-exemption status that doesn't apply.
  const showsGstFree = product.is_gst_free && !!product.farmers?.gst_registered
  const gstApplies = !product.is_gst_free && !!product.farmers?.gst_registered
  const priceLabel = isB2B
    ? (showsGstFree ? 'ex-GST · GST free' : 'ex-GST')
    : (showsGstFree ? 'inc-GST · GST free' : 'inc-GST')

  // Close on Escape
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)', animation: 'fadeIn 0.2s ease' }}
      />
      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 301,
        width: '100%', maxWidth: '32rem',
        background: 'white', overflowY: 'auto',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.18)',
        animation: 'slideInRight 0.25s cubic-bezier(.16,1,.3,1)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Close button */}
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 10, width: '2.25rem', height: '2.25rem', borderRadius: '50%', border: '1px solid var(--olive)', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', color: 'var(--moss)', fontFamily: 'var(--font-body)' }}
          aria-label="Close"
        >✕</button>

        {/* Main image */}
        <div style={{ flexShrink: 0, height: '20rem', background: 'var(--olive)', overflow: 'hidden', position: 'relative' }}>
          {images.length > 0 ? (
            <img
              key={images[imgIdx]}
              src={images[imgIdx]}
              alt={product.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '5rem' }}>
              {EMOJI[product.category] || '🌿'}
            </div>
          )}
          {showsGstFree && (
            <span className="badge badge-sage" style={{ position: 'absolute', top: '0.875rem', left: '0.875rem', fontSize: '0.75rem' }}>GST Free</span>
          )}
        </div>

        {/* Image thumbnails strip */}
        {images.length > 1 && (
          <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1.5rem', overflowX: 'auto', background: 'var(--offwhite, #fafaf7)', borderBottom: '1px solid var(--olive)', scrollbarWidth: 'none' }}>
            {images.map((url, i) => (
              <button
                key={i}
                onClick={() => setImgIdx(i)}
                style={{
                  flexShrink: 0, width: '3.5rem', height: '3.5rem', borderRadius: '0.5rem', overflow: 'hidden',
                  border: imgIdx === i ? '2px solid var(--forest)' : '2px solid transparent',
                  padding: 0, cursor: 'pointer', background: 'none',
                  transition: 'border-color 0.15s',
                }}
              >
                <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </button>
            ))}
          </div>
        )}

        {/* Product info */}
        <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Name + category */}
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--moss)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '0.375rem' }}>
              {EMOJI[product.category]} {CATEGORY_LABEL[product.category] || product.category}
            </p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', color: 'var(--forest)', lineHeight: 1.1, marginBottom: '0.25rem' }}>
              {product.name}
            </h2>
            {product.latin_name && (
              <p style={{ fontSize: '0.8rem', color: 'var(--moss)', fontStyle: 'italic', marginBottom: '0.25rem' }}>{product.latin_name}</p>
            )}
            <p style={{ fontSize: '0.82rem', color: 'var(--moss)' }}>
              per {product.unit}
              {(() => {
                const perStem = getPricePerStemCents(product, displayPrice)
                return perStem !== null && product.unit !== 'stem' ? ` · ≈ ${formatPrice(perStem)}/stem` : ''
              })()}
            </p>
            {product.color_tags?.length > 0 && (
              <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.5rem' }}>
                {product.color_tags.map((cid: string) => {
                  const c = COLOR_PALETTE.find(x => x.id === cid)
                  return c ? <span key={cid} title={c.label} style={{ width: '1rem', height: '1rem', borderRadius: '50%', background: c.swatch, border: '1px solid rgba(0,0,0,0.15)' }} /> : null
                })}
              </div>
            )}
          </div>

          {/* Price */}
          <div style={{ background: 'var(--olive)', borderRadius: '1rem', padding: '1rem 1.25rem' }}>
            {!authLoaded ? (
              <div style={{ width: '6rem', height: '2rem', borderRadius: '0.5rem', background: 'rgba(0,0,0,0.08)' }} />
            ) : isAdminOrFarmer ? (
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', color: 'var(--forest)', letterSpacing: '-0.03em' }}>
                  {formatPrice(product.b2b_display_price ?? product.wholesale_price)}
                  <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-body)', marginLeft: '0.4rem', opacity: 0.6 }}>wholesale</span>
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--moss)', marginTop: '0.25rem' }}>
                  {showsGstFree ? 'ex-GST · GST free' : 'ex-GST'}
                  {' · '}Retail: {formatPrice(product.b2c_display_price ?? product.buyer_unit_price ?? Math.round((product.wholesale_price ?? 0) * 1.1))}
                </p>
              </div>
            ) : (
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', color: 'var(--forest)', letterSpacing: '-0.03em' }}>
                  {formatPrice(displayPrice)}
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--moss)', marginTop: '0.25rem' }}>
                  {priceLabel}
                  {isB2B && gstApplies && (
                    <span style={{ marginLeft: '0.5rem', opacity: 0.7 }}>
                      · {formatPrice(product.buyer_unit_price ?? Math.round((product.wholesale_price ?? 0) * 1.1))} inc-GST
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <p style={{ fontSize: '0.875rem', color: 'var(--forest)', lineHeight: 1.7 }}>{product.description}</p>
          )}

          {/* Grower */}
          {product.farmers?.business_name && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: 'var(--sage)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>🌾</div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--moss)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Grown by</p>
                <Link href={`/growers/${product.farmer_id}`} style={{ fontSize: '0.875rem', color: 'var(--forest)', fontWeight: 700, textDecoration: 'none' }}>
                  {product.farmers.business_name}
                </Link>
              </div>
            </div>
          )}

          {/* Pickup / delivery options */}
          {product.farmers?.farmer_fulfillment_options?.length > 0 ? (
            <div style={{ background: 'var(--green-soft)', padding: '0.625rem 0.75rem', borderRadius: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {product.farmers.farmer_fulfillment_options.map((opt: any, i: number) => (
                <p key={i} style={{ fontSize: '0.78rem', color: 'var(--forest)', fontWeight: 600 }}>
                  {opt.type === 'pickup' ? '🚜 Farm pickup' : '🚚 Delivery'}
                  {opt.day_of_week && ` — ${opt.day_of_week.charAt(0).toUpperCase()}${opt.day_of_week.slice(1)}`}
                  {opt.start_time && opt.end_time && ` ${opt.start_time}–${opt.end_time}`}
                  {' · '}{opt.cost_cents > 0 ? formatPrice(opt.cost_cents) : 'Free'}
                  {opt.max_distance_km && ` (within ${opt.max_distance_km}km)`}
                </p>
              ))}
            </div>
          ) : product.farmers?.offers_farm_pickup && (
            <p style={{ fontSize: '0.78rem', color: 'var(--forest)', fontWeight: 600, background: 'var(--green-soft)', padding: '0.5rem 0.75rem', borderRadius: '0.5rem' }}>
              🚜 Farm pickup available from this grower
            </p>
          )}

          {/* Stock */}
          <p style={{ fontSize: '0.78rem', color: available <= 5 ? '#B91C1C' : 'var(--moss)' }}>
            {available <= 0 ? '✕ Out of stock' : available <= 5 ? `⚠ Only ${available} left` : `${available} available`}
          </p>

          {/* Add to cart */}
          <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
            {!marketOpen ? (
              <div style={{ padding: '0.875rem', background: 'var(--olive)', borderRadius: '1rem', textAlign: 'center' }}>
                <p style={{ fontSize: '0.82rem', color: 'var(--moss)', fontWeight: 600 }}>🕐 Market closed — opens Wednesday</p>
              </div>
            ) : available === 0 ? (
              <div style={{ padding: '0.875rem', background: 'var(--olive)', borderRadius: '1rem', textAlign: 'center' }}>
                <p style={{ fontSize: '0.82rem', color: 'var(--moss)', fontWeight: 600 }}>Sold out this week</p>
              </div>
            ) : cartQty === 0 ? (
              <button
                onClick={onAdd}
                className="btn btn-forest"
                style={{ width: '100%', padding: '0.875rem', fontSize: '0.95rem', borderRadius: '1rem' }}
              >
                Add to cart
              </button>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--forest)', borderRadius: '1rem', padding: '0.625rem 1rem' }}>
                <button
                  onClick={() => onUpdateQty(cartQty - 1)}
                  style={{ width: '2.25rem', height: '2.25rem', borderRadius: '50%', border: 'none', background: 'rgba(255,247,249,0.18)', color: 'white', cursor: 'pointer', fontSize: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontFamily: 'var(--font-body)' }}
                >−</button>
                <span style={{ flex: 1, textAlign: 'center', color: 'white', fontWeight: 700, fontSize: '1.1rem' }}>{cartQty} in cart</span>
                <button
                  onClick={onAdd}
                  disabled={cartQty >= available}
                  style={{ width: '2.25rem', height: '2.25rem', borderRadius: '50%', border: 'none', background: cartQty >= available ? 'rgba(255,247,249,0.08)' : 'rgba(255,247,249,0.18)', color: 'white', cursor: cartQty >= available ? 'not-allowed' : 'pointer', fontSize: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontFamily: 'var(--font-body)' }}
                >+</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function MarketplacePage() {
  const [products, setProducts]   = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [category, setCategory]   = useState('')
  const [colors, setColors]             = useState<string[]>([])
  const [farmFilters, setFarmFilters]     = useState<string[]>([])
  const [regionFilters, setRegionFilters] = useState<string[]>([])
  const [isB2B, setIsB2B]         = useState(false)
  const [userRole, setUserRole]   = useState<string | null>(null)
  const [authLoaded, setAuthLoaded] = useState(false)
  const [marketOpen]              = useState(isMarketOpen())
  const [search, setSearch]       = useState('')
  const [selected, setSelected]   = useState<any>(null)
  const [farmerId, setFarmerId]   = useState('')
  const [shopAsBuyer, setShopAsBuyer] = useState(false)
  const { addItem, updateQuantity, items, totalItems } = useCart()

  // Read ?farmer_id=/?as=buyer via plain browser API rather than useSearchParams()
  // so this top-level page doesn't need a Suspense boundary split for these params.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setFarmerId(params.get('farmer_id') || '')
    setShopAsBuyer(params.get('as') === 'buyer')
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setAuthLoaded(true)
      if (!user) return
      supabase.from('profiles').select('role').eq('id', user.id).single().then(({ data }) => {
        const role = data?.role || null
        setUserRole(role)
        if (role === 'buyer_b2b') setIsB2B(true)
        else if (role === 'buyer_b2c') setIsB2B(false)
        // A grower explicitly shopping as a buyer (via "Shop as Buyer" in their
        // sidebar) sees genuine retail pricing, not the wholesale preview —
        // what they see here must match what checkout actually charges them.
        else if (shopAsBuyer) setIsB2B(false)
        else if (role === 'farmer' || role === 'admin' || role === 'super_admin' || role === 'platform_admin') setIsB2B(true)
      })
    })
  }, [shopAsBuyer])

  const isAdminOrFarmer = !shopAsBuyer && (userRole === 'farmer' || userRole === 'admin' || userRole === 'super_admin' || userRole === 'platform_admin')

  useEffect(() => {
    setLoading(true)
    const colorsParam = colors.length ? `&colors=${colors.map(encodeURIComponent).join(',')}` : ''
    fetch(`/api/products?b2b=${isB2B}${category ? `&category=${category}` : ''}${colorsParam}${farmerId ? `&farmer_id=${farmerId}` : ''}`)
      .then(r => r.json()).then(d => { setProducts(d.data || []); setLoading(false) })
  }, [category, colors, isB2B, farmerId])

  function toggleFilter(setArr: React.Dispatch<React.SetStateAction<string[]>>, value: string) {
    setArr(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value])
  }


  // Show every flower category chip always — hiding chips for zero-stock
  // categories made newly-added ones (Dried, Natives, Foliage) disappear
  // instead of reading as available-but-empty. Coming-soon (non-flower)
  // categories are hidden entirely for now rather than shown disabled.
  const visibleCategories = CATEGORIES.filter(c => c.id === '' || !COMING_SOON_CATEGORIES.has(c.id))

  const [cartError, setCartError] = useState('')

  async function handleAdd(product: any) {
    const result = await addItem(product, 1, isB2B)
    if (!result.success) {
      setCartError(result.error === 'Insufficient stock' ? `Only ${result.available ?? 0} left — someone else may have just grabbed the rest.` : (result.error || 'Could not add to cart'))
      setTimeout(() => setCartError(''), 4000)
    }
  }

  async function handleUpdateQty(productId: string, qty: number) {
    const result = await updateQuantity(productId, qty)
    if (!result.success) {
      setCartError(result.error === 'Insufficient stock' ? `Only ${result.available ?? 0} left available.` : (result.error || 'Could not update quantity'))
      setTimeout(() => setCartError(''), 4000)
    }
  }

  function getCartQty(productId: string) {
    return items.find(i => i.product_id === productId)?.quantity || 0
  }

  // Farm and region options are derived from whatever this category/color/b2b
  // fetch actually returned, so the dropdowns never offer a combination with
  // zero results.
  const farmOptions = [...new Set(products.map(p => p.farmers?.business_name).filter(Boolean))].sort()
  const regionOptions = [...new Set(products.map(p => p.farmers?.region).filter(Boolean))].sort()

  const filtered = products.filter(p => {
    if (farmFilters.length && !farmFilters.includes(p.farmers?.business_name)) return false
    if (regionFilters.length && !regionFilters.includes(p.farmers?.region)) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      p.name.toLowerCase().includes(q) ||
      p.farmers?.business_name?.toLowerCase().includes(q) ||
      p.farmers?.region?.toLowerCase().includes(q) ||
      p.latin_name?.toLowerCase().includes(q) ||
      p.common_name?.toLowerCase().includes(q)
    )
  })

  const closeDrawer = useCallback(() => setSelected(null), [])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>

      {/* Cart error toast */}
      {cartError && (
        <div style={{ position: 'fixed', top: '1.25rem', left: '50%', transform: 'translateX(-50%)', zIndex: 500, background: '#7f1d1d', color: '#fca5a5', padding: '0.75rem 1.25rem', borderRadius: '0.75rem', fontSize: '0.85rem', fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', maxWidth: '26rem', textAlign: 'center' }}>
          ⚠ {cartError}
        </div>
      )}

      {/* Top nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(0,0,0,0.08)', padding: '1rem 2rem', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', textDecoration: 'none', flexShrink: 0 }}>
          <span style={{ fontSize: '1.1rem' }}>🌸</span>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', fontWeight: 800, color: 'var(--forest)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>The Green Guild</span>
        </Link>
        <div style={{ flex: 1, minWidth: '10rem', position: 'relative' }}>
          <svg style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: 'var(--moss)', pointerEvents: 'none' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input className="input" style={{ paddingLeft: '2.5rem', paddingTop: '0.6rem', paddingBottom: '0.6rem' }} placeholder="Search products, farms or regions…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexShrink: 0 }}>
          {authLoaded && userRole && (
            <>
              <Link href="/dashboard" className="btn btn-ghost btn-sm">Dashboard</Link>
              <button className="btn btn-ghost btn-sm" onClick={() => fetch('/api/auth/signout', { method: 'POST' }).then(() => { window.location.href = '/auth/login' })}>Sign out</button>
            </>
          )}
          {authLoaded && !userRole && (
            <Link href="/auth/login" className="btn btn-ghost btn-sm">Sign in</Link>
          )}
          <Link href="/cart" className="btn btn-forest btn-sm" style={{ position: 'relative' }}>
            Cart
            {totalItems() > 0 && <span style={{ position: 'absolute', top: '-0.5rem', right: '-0.5rem', width: '1.25rem', height: '1.25rem', borderRadius: '50%', background: 'var(--sage)', color: 'var(--forest)', fontSize: '0.6rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{totalItems()}</span>}
          </Link>
        </div>
      </nav>

      {/* Grower filter banner */}
      {farmerId && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 1.5rem', background: 'var(--green-soft)', borderBottom: '1px solid var(--border-light)', flexWrap: 'wrap' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--forest)', fontWeight: 600 }}>
            Showing products from {products[0]?.farmers?.business_name || 'this grower'}
          </p>
          <Link href="/marketplace" onClick={() => setFarmerId('')} className="btn btn-ghost btn-sm">View all growers →</Link>
        </div>
      )}

      {/* Mobile controls */}
      <div className="market-cats-mobile" style={{ display: 'none', flexDirection: 'column', gap: '0', borderBottom: '1px solid var(--border-light)', background: 'white' }}>
        {isAdminOrFarmer && (
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
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', padding: '0.75rem 1rem', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
          {visibleCategories.map(cat => {
            const comingSoon = COMING_SOON_CATEGORIES.has(cat.id)
            return (
              <button key={cat.id} type="button" onClick={() => !comingSoon && setCategory(cat.id)} disabled={comingSoon}
                title={comingSoon ? 'Coming soon' : undefined}
                style={{ flexShrink: 0, padding: '0.375rem 0.875rem', borderRadius: '99px', border: `1.5px solid ${category === cat.id ? 'var(--navy)' : 'var(--border)'}`, background: category === cat.id ? 'var(--navy)' : 'white', color: comingSoon ? 'var(--text-3)' : category === cat.id ? 'white' : 'var(--text-secondary)', opacity: comingSoon ? 0.55 : 1, fontSize: '0.8rem', fontWeight: 600, cursor: comingSoon ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
                {cat.label}{comingSoon ? ' · Soon' : ''}
              </button>
            )
          })}
        </div>
        {farmOptions.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', padding: '0 1rem 0.75rem', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
            {farmOptions.map(f => (
              <button key={f} type="button" onClick={() => toggleFilter(setFarmFilters, f)}
                style={{ flexShrink: 0, padding: '0.375rem 0.875rem', borderRadius: '99px', border: `1.5px solid ${farmFilters.includes(f) ? 'var(--navy)' : 'var(--border)'}`, background: farmFilters.includes(f) ? 'var(--navy)' : 'white', color: farmFilters.includes(f) ? 'white' : 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {f}
              </button>
            ))}
          </div>
        )}
        {regionOptions.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', padding: '0 1rem 0.75rem', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
            {regionOptions.map(r => (
              <button key={r} type="button" onClick={() => toggleFilter(setRegionFilters, r)}
                style={{ flexShrink: 0, padding: '0.375rem 0.875rem', borderRadius: '99px', border: `1.5px solid ${regionFilters.includes(r) ? 'var(--navy)' : 'var(--border)'}`, background: regionFilters.includes(r) ? 'var(--navy)' : 'white', color: regionFilters.includes(r) ? 'white' : 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {r}
              </button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', padding: '0 1rem 0.75rem', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
          {COLOR_PALETTE.map(c => (
            <button key={c.id} type="button" onClick={() => toggleFilter(setColors, c.id)}
              style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.375rem 0.875rem', borderRadius: '99px', border: `1.5px solid ${colors.includes(c.id) ? 'var(--navy)' : 'var(--border)'}`, background: colors.includes(c.id) ? 'var(--navy)' : 'white', color: colors.includes(c.id) ? 'white' : 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <span style={{ width: '0.75rem', height: '0.75rem', borderRadius: '50%', background: c.swatch, border: '1px solid rgba(0,0,0,0.15)', flexShrink: 0 }} />
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Market status banner */}
      {marketOpen ? (
        <div style={{ padding: '0.6rem', textAlign: 'center', background: 'var(--green)' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'white', letterSpacing: '0.02em' }}>
            <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: '#a5f3c0', marginRight: '0.5rem', verticalAlign: 'middle', animation: 'pulse-dot 1.8s ease infinite' }} />
            Market is OPEN · Order before Wednesday 8:00 PM AEST
          </span>
        </div>
      ) : (
        <div style={{ padding: '0.6rem', textAlign: 'center', background: 'var(--surface-2)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-2)' }}>
            🕐 Market closed · Opens Wednesday 8:00 AM AEST · Browse now, order Wednesday
          </span>
        </div>
      )}

      <div className="market-layout" style={{ display: 'flex' }}>

        {/* Sidebar */}
        <aside className="market-sidebar" style={{ width: '13rem', flexShrink: 0, padding: '1.5rem', position: 'sticky', top: '4.5rem', height: 'calc(100vh - 4.5rem)', overflowY: 'auto', borderRight: '1px solid var(--olive)', background: 'white' }}>
          {isAdminOrFarmer && (
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
          <p className="label">Category</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginBottom: '1.5rem' }}>
            {visibleCategories.map(cat => {
              const comingSoon = COMING_SOON_CATEGORIES.has(cat.id)
              return (
                <button key={cat.id} type="button" onClick={() => !comingSoon && setCategory(cat.id)} disabled={comingSoon}
                  title={comingSoon ? 'Coming soon' : undefined}
                  className={`nav-item ${category === cat.id ? 'active' : ''}`}
                  style={{ width: '100%', textAlign: 'left', opacity: comingSoon ? 0.5 : 1, cursor: comingSoon ? 'not-allowed' : 'pointer' }}>
                  {cat.label}{comingSoon ? ' · Soon' : ''}
                </button>
              )
            })}
          </div>

          {farmOptions.length > 0 && (
            <>
              <p className="label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                Farm
                {farmFilters.length > 0 && (
                  <button type="button" onClick={() => setFarmFilters([])} style={{ background: 'none', border: 'none', color: 'var(--moss)', fontSize: '0.7rem', cursor: 'pointer', textDecoration: 'underline' }}>Clear</button>
                )}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginBottom: '1.5rem' }}>
                {farmOptions.map(f => (
                  <button key={f} type="button" onClick={() => toggleFilter(setFarmFilters, f)}
                    className={`nav-item ${farmFilters.includes(f) ? 'active' : ''}`} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: '0.9rem', flexShrink: 0 }}>{farmFilters.includes(f) ? '✓' : ''}</span>
                    {f}
                  </button>
                ))}
              </div>
            </>
          )}

          {regionOptions.length > 0 && (
            <>
              <p className="label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                Region
                {regionFilters.length > 0 && (
                  <button type="button" onClick={() => setRegionFilters([])} style={{ background: 'none', border: 'none', color: 'var(--moss)', fontSize: '0.7rem', cursor: 'pointer', textDecoration: 'underline' }}>Clear</button>
                )}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', marginBottom: '1.5rem' }}>
                {regionOptions.map(r => (
                  <button key={r} type="button" onClick={() => toggleFilter(setRegionFilters, r)}
                    className={`nav-item ${regionFilters.includes(r) ? 'active' : ''}`} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: '0.9rem', flexShrink: 0 }}>{regionFilters.includes(r) ? '✓' : ''}</span>
                    {r}
                  </button>
                ))}
              </div>
            </>
          )}

          <p className="label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            Color
            {colors.length > 0 && (
              <button type="button" onClick={() => setColors([])} style={{ background: 'none', border: 'none', color: 'var(--moss)', fontSize: '0.7rem', cursor: 'pointer', textDecoration: 'underline' }}>Clear</button>
            )}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
            {COLOR_PALETTE.map(c => (
              <button key={c.id} type="button" onClick={() => toggleFilter(setColors, c.id)}
                className={`nav-item ${colors.includes(c.id) ? 'active' : ''}`} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: '0.9rem', height: '0.9rem', borderRadius: '50%', background: c.swatch, border: '1px solid rgba(0,0,0,0.15)', flexShrink: 0 }} />
                {c.label}
                {colors.includes(c.id) && <span style={{ marginLeft: 'auto' }}>✓</span>}
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
                const available   = isB2B ? product.b2b_available : product.b2c_available
                const displayPrice = isB2B
                  ? (product.b2b_display_price ?? product.wholesale_price)
                  : (product.b2c_display_price ?? product.buyer_unit_price ?? product.wholesale_price)
                const showsGstFree = product.is_gst_free && !!product.farmers?.gst_registered
                const gstApplies  = !product.is_gst_free && !!product.farmers?.gst_registered
                const priceLabel  = isB2B
                  ? (showsGstFree ? 'ex-GST · GST free' : 'ex-GST')
                  : (showsGstFree ? 'inc-GST · GST free' : 'inc-GST')
                const imgs        = productImages(product)
                const cartQty     = getCartQty(product.id)

                return (
                  <div
                    key={product.id}
                    className="card card-hover reveal"
                    style={{ display: 'flex', flexDirection: 'column', animationDelay: `${i * 40}ms`, cursor: 'pointer' }}
                    onClick={() => setSelected(product)}
                  >
                    {/* Image / thumbnail */}
                    <div style={{ height: '9rem', background: 'var(--olive)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3.5rem', position: 'relative', flexShrink: 0, overflow: 'hidden', borderRadius: 'var(--r-card) var(--r-card) 0 0' }}>
                      {imgs.length > 0
                        ? <img src={imgs[0]} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : EMOJI[product.category] || '🌿'
                      }
                      {showsGstFree && <span className="badge badge-sage" style={{ position: 'absolute', top: '0.625rem', left: '0.625rem' }}>GST Free</span>}
                      {imgs.length > 1 && (
                        <span style={{ position: 'absolute', bottom: '0.5rem', right: '0.5rem', background: 'rgba(0,0,0,0.55)', color: 'white', borderRadius: '99px', fontSize: '0.62rem', fontWeight: 700, padding: '0.15rem 0.45rem' }}>
                          +{imgs.length - 1} photo{imgs.length > 2 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <p style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--forest)', marginBottom: '0.15rem', lineHeight: 1.3 }}>{product.name}</p>
                      {product.farmers?.business_name && (
                        <Link
                          href={`/growers/${product.farmer_id}`}
                          onClick={(e: React.MouseEvent) => e.stopPropagation()}
                          style={{ fontSize: '0.72rem', color: 'var(--moss)', textDecoration: 'none', marginBottom: '0.4rem', display: 'inline-block' }}
                        >
                          {product.farmers.business_name}
                        </Link>
                      )}
                      <p className="type-label-sm" style={{ color: 'var(--moss)', marginBottom: '1rem' }}>
                        per {product.unit} · {available} left
                        {(() => {
                          const perStem = getPricePerStemCents(product, displayPrice)
                          return perStem !== null && product.unit !== 'stem' ? ` · ≈ ${formatPrice(perStem)}/stem` : ''
                        })()}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 'auto' }}>
                        <div>
                          {!authLoaded ? (
                            <div style={{ width: '4rem', height: '1.4rem', borderRadius: '0.4rem', background: 'var(--offwhite)' }} />
                          ) : isAdminOrFarmer ? (
                            <>
                              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--forest)', letterSpacing: '-0.03em', textTransform: 'uppercase' }}>
                                {formatPrice(product.b2b_display_price ?? product.wholesale_price)}
                                <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-body)', marginLeft: '0.3rem', opacity: 0.6 }}>wholesale</span>
                              </div>
                              <div className="type-label-sm" style={{ color: 'var(--moss)' }}>
                                {showsGstFree ? 'ex-GST · GST free' : 'ex-GST'}
                                {' · '}Retail: {formatPrice(product.b2c_display_price ?? product.buyer_unit_price ?? Math.round((product.wholesale_price ?? 0) * 1.1))}
                              </div>
                            </>
                          ) : (
                            <>
                              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: 'var(--forest)', letterSpacing: '-0.03em', textTransform: 'uppercase' }}>{formatPrice(displayPrice)}</div>
                              <div className="type-label-sm" style={{ color: 'var(--moss)' }}>
                                {priceLabel}
                                {isB2B && gstApplies && (
                                  <span style={{ marginLeft: '0.35rem', opacity: 0.6 }}>· {formatPrice(product.buyer_unit_price ?? Math.round((product.wholesale_price ?? 0) * 1.1))} inc-GST</span>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                        {/* Intercept click so Add/qty buttons don't open drawer */}
                        <div onClick={e => e.stopPropagation()}>
                          {!marketOpen ? (
                            <span className="type-label-sm" style={{ color: 'var(--moss)' }}>Closed</span>
                          ) : available === 0 ? (
                            <span className="type-label-sm" style={{ color: '#b91c1c' }}>Sold out</span>
                          ) : cartQty === 0 ? (
                            <button onClick={() => handleAdd(product)} className="btn btn-forest btn-sm">Add</button>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: 'var(--forest)', borderRadius: '99px', padding: '0.2rem 0.25rem' }}>
                              <button onClick={() => handleUpdateQty(product.id, cartQty - 1)}
                                style={{ width: '1.75rem', height: '1.75rem', borderRadius: '50%', border: 'none', background: 'rgba(255,247,249,0.2)', color: 'var(--cream)', cursor: 'pointer', fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                              <input
                                type="text" inputMode="numeric" value={cartQty}
                                onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 0) handleUpdateQty(product.id, v) }}
                                style={{ width: '2.25rem', background: 'transparent', border: 'none', color: 'var(--cream)', fontWeight: 700, fontSize: '0.875rem', textAlign: 'center', outline: 'none' }}
                              />
                              <button onClick={() => handleAdd(product)} disabled={cartQty >= available}
                                style={{ width: '1.75rem', height: '1.75rem', borderRadius: '50%', border: 'none', background: cartQty >= available ? 'rgba(255,247,249,0.1)' : 'rgba(255,247,249,0.2)', color: 'var(--cream)', cursor: cartQty >= available ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>

      {/* Product detail drawer */}
      {selected && (
        <ProductDrawer
          product={selected}
          isB2B={isB2B}
          isAdminOrFarmer={isAdminOrFarmer}
          authLoaded={authLoaded}
          marketOpen={marketOpen}
          cartQty={getCartQty(selected.id)}
          onAdd={() => handleAdd(selected)}
          onUpdateQty={qty => handleUpdateQty(selected.id, qty)}
          onClose={closeDrawer}
        />
      )}
    </div>
  )
}
