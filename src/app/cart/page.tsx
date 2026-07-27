'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCart } from '@/hooks/useCart'
import { formatPrice } from '@/lib/utils/pricing'

const EMOJI: Record<string, string> = {
  flowers_cut: '🌸', flowers_dried: '🌾', flowers_native: '🌼', foliage: '🍃', vegetables: '🥦',
  herbs: '🌿', fruit: '🍓', eggs: '🥚', honey: '🍯', other: '📦',
}

type StockIssue = {
  product_id: string; name: string; unit: string
  requested: number; available: number; delisted: boolean
}

export default function CartPage() {
  const router = useRouter()
  const { items, isB2B, updateQuantity, removeItem, subtotalCents, totalItems, setItemNotes } = useCart()

  const [stockIssues, setStockIssues] = useState<StockIssue[]>([])
  const [validating, setValidating]   = useState(false)
  const [cartError, setCartError]     = useState('')
  const [now, setNow]                 = useState(() => Date.now())

  useEffect(() => {
    if (items.length > 0) validateStock()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Tick every 15s so reservation countdowns stay roughly live.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(id)
  }, [])

  function minutesLeft(reservedUntil?: string): number | null {
    if (!reservedUntil) return null
    return Math.max(0, Math.round((new Date(reservedUntil).getTime() - now) / 60_000))
  }

  async function handleUpdateQuantity(productId: string, qty: number) {
    const result = await updateQuantity(productId, qty)
    if (!result.success) {
      setCartError(result.error === 'Insufficient stock' ? `Only ${result.available ?? 0} left available.` : (result.error || 'Could not update quantity'))
      setTimeout(() => setCartError(''), 4000)
    }
  }

  async function validateStock() {
    setValidating(true)
    const ids = items.map(i => i.product_id).join(',')
    const res  = await fetch(`/api/cart/validate?ids=${ids}&b2b=${isB2B}`)
    const data = await res.json()
    const map: Record<string, any> = {}
    ;(data.items || []).forEach((s: any) => { map[s.product_id] = s })

    const issues: StockIssue[] = []
    for (const item of items) {
      const stock = map[item.product_id]
      if (!stock) continue
      if (!stock.still_listed) {
        issues.push({ product_id: item.product_id, name: item.product.name, unit: item.product.unit, requested: item.quantity, available: 0, delisted: true })
      } else if (item.quantity > stock.available) {
        issues.push({ product_id: item.product_id, name: stock.name, unit: stock.unit, requested: item.quantity, available: stock.available, delisted: false })
      }
    }
    setStockIssues(issues)
    setValidating(false)
  }

  function fixIssue(issue: StockIssue) {
    if (issue.available <= 0) removeItem(issue.product_id)
    else handleUpdateQuantity(issue.product_id, issue.available)
    setStockIssues(prev => prev.filter(i => i.product_id !== issue.product_id))
  }

  // Totals
  const subtotal = subtotalCents()
  const gstAmount = isB2B
    ? items.reduce((s, i) => {
        if (i.product.is_gst_free) return s
        const exGst = i.product.wholesale_price ?? Math.round(i.unit_price_cents / 1.1)
        return s + Math.round(exGst * 0.1) * i.quantity
      }, 0)
    : 0
  const subtotalExGst = isB2B
    ? items.reduce((s, i) => s + (i.product.wholesale_price ?? (i.product.is_gst_free ? i.unit_price_cents : Math.round(i.unit_price_cents / 1.1))) * i.quantity, 0)
    : 0

  const hasIssues = stockIssues.length > 0

  if (items.length === 0) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)' }}>
      <div className="card-forest reveal" style={{ padding: '4rem', textAlign: 'center', maxWidth: '26rem' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>🛒</div>
        <h2 className="type-subheading" style={{ color: 'var(--cream)', marginBottom: '1rem' }}>Your cart is empty</h2>
        <p className="type-label" style={{ color: 'var(--sage)', marginBottom: '2rem', lineHeight: 1.8 }}>
          Head to the marketplace to browse this week's produce
        </p>
        <Link href="/marketplace" className="btn btn-cream" style={{ width: '100%' }}>
          Browse marketplace
        </Link>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>

      {/* Cart error toast */}
      {cartError && (
        <div style={{ position: 'fixed', top: '1.25rem', left: '50%', transform: 'translateX(-50%)', zIndex: 500, background: '#7f1d1d', color: '#fca5a5', padding: '0.75rem 1.25rem', borderRadius: '0.75rem', fontSize: '0.85rem', fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', maxWidth: '26rem', textAlign: 'center' }}>
          ⚠ {cartError}
        </div>
      )}

      {/* Nav */}
      <nav style={{ background: 'white', borderBottom: '1px solid var(--olive)', padding: '1rem 2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Link href="/marketplace" className="btn btn-ghost btn-sm">← Continue shopping</Link>
        <h1 className="type-subheading" style={{ color: 'var(--forest)', fontSize: '1.75rem' }}>
          Your cart
          <span style={{ marginLeft: '0.75rem', fontSize: '1rem', color: 'var(--moss)', fontFamily: 'var(--font-body)', fontWeight: 500 }}>
            {totalItems()} {totalItems() === 1 ? 'item' : 'items'}
          </span>
        </h1>
      </nav>

      <div style={{ maxWidth: '68rem', margin: '0 auto', padding: '2.5rem 1.5rem', display: 'grid', gridTemplateColumns: '1fr 22rem', gap: '2rem', alignItems: 'start' }}>

        {/* ── Left: Item list ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>

          {/* Stock warning banner */}
          {hasIssues && (
            <div className="reveal" style={{ padding: '1rem 1.25rem', borderRadius: '1rem', background: '#7f1d1d', border: '1px solid #991b1b' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fca5a5' }}>
                  ⚠ Stock changed since you added some items
                </p>
                <button
                  onClick={() => stockIssues.forEach(fixIssue)}
                  style={{ fontSize: '0.72rem', fontWeight: 700, color: '#fca5a5', background: 'rgba(252,165,165,0.15)', border: '1px solid rgba(252,165,165,0.3)', borderRadius: '6px', padding: '0.2rem 0.7rem', cursor: 'pointer' }}
                >
                  Fix all
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {stockIssues.map(issue => (
                  <div key={issue.product_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                    <p style={{ fontSize: '0.78rem', color: '#fca5a5' }}>
                      <strong>{issue.name}</strong> —{' '}
                      {issue.delisted ? 'no longer available this week' : `only ${issue.available} ${issue.unit} left (you have ${issue.requested})`}
                    </p>
                    <button
                      onClick={() => fixIssue(issue)}
                      style={{ flexShrink: 0, fontSize: '0.7rem', fontWeight: 700, color: '#fca5a5', background: 'rgba(252,165,165,0.15)', border: '1px solid rgba(252,165,165,0.3)', borderRadius: '6px', padding: '0.2rem 0.7rem', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      {issue.available <= 0 ? 'Remove' : `Reduce to ${issue.available}`}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {validating && (
            <div style={{ padding: '0.75rem 1rem', borderRadius: '0.75rem', background: 'var(--olive)', fontSize: '0.8rem', color: 'var(--moss)' }}>
              Checking stock availability…
            </div>
          )}

          {/* Items */}
          {items.map((item, idx) => {
            const hasIssue   = stockIssues.some(s => s.product_id === item.product_id)
            const isGstFree  = item.product.is_gst_free
            const exGstUnit  = item.product.wholesale_price ?? (isGstFree ? item.unit_price_cents : Math.round(item.unit_price_cents / 1.1))
            const displayUnit = isB2B ? exGstUnit : item.unit_price_cents
            const lineTotal   = displayUnit * item.quantity
            const maxStock    = isB2B ? item.product.b2b_available : item.product.b2c_available
            const imgUrl      = item.product.image_url || (Array.isArray(item.product.image_urls) ? item.product.image_urls[0] : null)

            return (
              <div
                key={item.product_id}
                className="card reveal"
                style={{
                  display: 'flex', gap: '1.25rem', padding: '1.25rem', alignItems: 'flex-start',
                  animationDelay: `${idx * 40}ms`,
                  border: hasIssue ? '1.5px solid #991b1b' : undefined,
                  opacity: hasIssue ? 0.85 : 1,
                }}
              >
                {/* Thumbnail */}
                <div style={{ width: '4.5rem', height: '4.5rem', borderRadius: '0.75rem', overflow: 'hidden', flexShrink: 0, background: 'var(--olive)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem' }}>
                  {imgUrl
                    ? <img src={imgUrl} alt={item.product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : EMOJI[item.product.category] || '🌿'
                  }
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--forest)', marginBottom: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.product.name}
                  </p>
                  <p style={{ fontSize: '0.78rem', color: 'var(--moss)', marginBottom: '0.875rem' }}>
                    {formatPrice(displayUnit)} / {item.product.unit}
                    {isB2B && !isGstFree && <span style={{ opacity: 0.65 }}> · ex-GST</span>}
                    {!isB2B && <span style={{ opacity: 0.65 }}> · inc-GST</span>}
                    {isGstFree && <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', background: 'var(--green-soft)', color: 'var(--green)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 700 }}>GST Free</span>}
                  </p>

                  {/* Quantity stepper */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0', border: '1.5px solid var(--olive)', borderRadius: '99px', overflow: 'hidden' }}>
                      <button
                        onClick={() => handleUpdateQuantity(item.product_id, item.quantity - 1)}
                        style={{ width: '2rem', height: '2rem', border: 'none', background: 'var(--olive)', color: 'var(--forest)', cursor: 'pointer', fontWeight: 700, fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-body)' }}
                      >−</button>
                      <input
                        type="text" inputMode="numeric" value={item.quantity}
                        onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 0) handleUpdateQuantity(item.product_id, v) }}
                        style={{ width: '2.5rem', textAlign: 'center', border: 'none', borderLeft: '1px solid var(--olive)', borderRight: '1px solid var(--olive)', height: '2rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--forest)', background: 'white', outline: 'none' }}
                      />
                      <button
                        onClick={() => handleUpdateQuantity(item.product_id, item.quantity + 1)}
                        style={{ width: '2rem', height: '2rem', border: 'none', background: 'var(--olive)', color: 'var(--forest)', cursor: 'pointer', fontWeight: 700, fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-body)' }}
                      >+</button>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--moss)' }}>{maxStock} available</span>
                  </div>

                  {/* Reservation countdown */}
                  {(() => {
                    const mins = minutesLeft(item.reserved_until)
                    if (mins === null) return null
                    return (
                      <p style={{ fontSize: '0.7rem', color: mins <= 5 ? '#b91c1c' : 'var(--sage-new)', fontWeight: 600, marginTop: '0.5rem' }}>
                        {mins <= 0 ? '⚠ Reservation may have expired — re-check before checkout' : `🔒 Reserved — expires in ${mins} min`}
                      </p>
                    )
                  })()}

                  {/* Per-item note for the grower */}
                  <input
                    type="text"
                    value={item.notes || ''}
                    onChange={e => setItemNotes(item.product_id, e.target.value)}
                    placeholder="Note for the grower (optional)"
                    maxLength={200}
                    style={{ width: '100%', marginTop: '0.6rem', padding: '0.4rem 0.6rem', fontSize: '0.78rem', border: '1px solid var(--olive)', borderRadius: '0.5rem', background: 'white', color: 'var(--forest)', outline: 'none', fontFamily: 'var(--font-body)' }}
                  />
                </div>

                {/* Line total + remove */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem', flexShrink: 0 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', color: 'var(--forest)', letterSpacing: '-0.03em' }}>
                    {formatPrice(lineTotal)}
                  </span>
                  <button
                    onClick={() => removeItem(item.product_id)}
                    style={{ fontSize: '0.72rem', color: 'var(--moss)', background: 'none', border: 'none', cursor: 'pointer', padding: '0.2rem 0', textDecoration: 'underline', fontFamily: 'var(--font-body)' }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── Right: Order summary ── */}
        <div style={{ position: 'sticky', top: '2rem' }}>
          <div className="card-forest reveal" style={{ padding: '2rem' }}>
            <h2 className="type-label-lg" style={{ color: 'var(--sage)', marginBottom: '1.5rem' }}>Order summary</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {isB2B ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="type-label-sm" style={{ color: 'var(--moss)' }}>Subtotal (ex-GST)</span>
                    <span style={{ fontSize: '0.875rem', color: 'var(--cream)', fontWeight: 700 }}>{formatPrice(subtotalExGst)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="type-label-sm" style={{ color: 'var(--moss)' }}>GST (10%)</span>
                    <span style={{ fontSize: '0.875rem', color: 'var(--cream)', fontWeight: 700 }}>{formatPrice(gstAmount)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(204,213,174,0.2)', paddingTop: '0.875rem' }}>
                    <span className="type-label-lg" style={{ color: 'var(--sage)' }}>Total (inc-GST)</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', color: 'var(--cream)', letterSpacing: '-0.03em' }}>{formatPrice(subtotal)}</span>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="type-label-sm" style={{ color: 'var(--moss)' }}>Subtotal (inc-GST)</span>
                    <span style={{ fontSize: '0.875rem', color: 'var(--cream)', fontWeight: 700 }}>{formatPrice(subtotal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(204,213,174,0.2)', paddingTop: '0.875rem' }}>
                    <span className="type-label-lg" style={{ color: 'var(--sage)' }}>Total</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', color: 'var(--cream)', letterSpacing: '-0.03em' }}>{formatPrice(subtotal)}</span>
                  </div>
                </>
              )}
            </div>

            <p className="type-label-sm" style={{ color: 'var(--moss)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
              Delivery fee calculated at checkout based on your collection method.
            </p>

            <button
              onClick={() => router.push('/checkout')}
              disabled={hasIssues}
              className="btn btn-cream"
              style={{ width: '100%', opacity: hasIssues ? 0.5 : 1, cursor: hasIssues ? 'not-allowed' : 'pointer' }}
            >
              {hasIssues ? 'Resolve stock issues to continue' : 'Proceed to checkout →'}
            </button>

            {hasIssues && (
              <p className="type-label-sm" style={{ color: '#fca5a5', textAlign: 'center', marginTop: '0.75rem' }}>
                Fix the stock issues above first
              </p>
            )}
          </div>

          <Link href="/marketplace" style={{ display: 'block', textAlign: 'center', marginTop: '1rem', fontSize: '0.8rem', color: 'var(--moss)', textDecoration: 'none' }}>
            ← Continue shopping
          </Link>
        </div>

      </div>
    </div>
  )
}
