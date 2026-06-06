'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils/pricing'
import { isListingWindowOpen } from '@/lib/utils/timezone'

const CATEGORIES: Record<string, string> = { flowers_cut: '✿ Cut Flowers', flowers_dried: '🌾 Dried', foliage: '🍃 Foliage', vegetables: '🥦 Vegetables', herbs: '🌿 Herbs', fruit: '🍓 Fruit', eggs: '🥚 Eggs', honey: '🍯 Honey', other: '📦 Other' }

export default function FarmerInventoryPage() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [listingOpen] = useState(isListingWindowOpen())
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/products?own=true').then(r => r.json()).then(d => { setProducts(d.data || []); setLoading(false) })
  }, [])

  async function toggleListed(id: string, current: boolean) {
    if (!listingOpen) return
    setToggling(id)
    await fetch(`/api/products/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_listed_this_week: !current }) })
    setProducts(ps => ps.map(p => p.id === id ? { ...p, is_listed_this_week: !current } : p))
    setToggling(null)
  }

  const listedCount = products.filter(p => p.is_listed_this_week).length

  return (
    <div className="page-pad" style={{ padding: '2.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <h1 className="type-heading reveal" style={{ color: 'var(--forest)', marginBottom: '0.375rem' }}>My Inventory</h1>
          <p className="type-label" style={{ color: 'var(--moss)' }}>{listedCount} of {products.length} listed this week</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className={`badge ${listingOpen ? 'badge-sage' : 'badge-olive'}`}>
            {listingOpen && <span className="status-dot status-live" />}
            {listingOpen ? 'Window open' : 'Window closed'}
          </span>
          <Link href="/dashboard/farmer/inventory/new" className="btn btn-forest btn-sm">+ New product</Link>
        </div>
      </div>

      {!listingOpen && (
        <div className="reveal" style={{ background: 'var(--olive)', border: '1px solid var(--sage)', borderRadius: '1.5rem', padding: '1.25rem 1.75rem', marginBottom: '1.75rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🔒</span>
          <p className="type-label-sm" style={{ color: 'var(--forest)', lineHeight: 1.7 }}>Listing window is closed. You can view inventory but cannot toggle listings until Sunday midnight AEST.</p>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card" style={{ height: '5rem', background: 'var(--olive)' }} />)}
        </div>
      ) : products.length === 0 ? (
        <div className="card-forest reveal" style={{ padding: '5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1.25rem' }}>🌱</div>
          <h3 className="type-subheading" style={{ color: 'var(--cream)', marginBottom: '1rem' }}>No products yet</h3>
          <p className="type-label" style={{ color: 'var(--moss)', marginBottom: '2rem', lineHeight: 1.8 }}>Add your first product to start selling on the marketplace</p>
          <Link href="/dashboard/farmer/inventory/new" className="btn btn-cream">Add first product</Link>
        </div>
      ) : (
        <div className="card reveal" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'var(--olive)', borderBottom: '1px solid var(--sage)' }}>
                {['Product', 'Category', 'Wholesale (ex-GST)', 'B2C Retail (inc-GST)', 'B2B / B2C left', 'Listed', ''].map(h => (
                  <th key={h} className="type-label-sm" style={{ textAlign: ['Wholesale (ex-GST)', 'B2C Retail (inc-GST)', 'B2B / B2C left'].includes(h) ? 'right' : h === 'Listed' ? 'center' : 'left', padding: '1rem 1.25rem', color: 'var(--moss)', letterSpacing: '0.15em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} className="table-row">
                  <td style={{ padding: '1rem 1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                      <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: 'var(--olive)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0, overflow: 'hidden' }}>
                        {p.image_url ? <img src={p.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : CATEGORIES[p.category]?.[0]}
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, color: 'var(--forest)' }}>{p.name}</p>
                        <p className="type-label-sm" style={{ color: 'var(--moss)' }}>per {p.unit} · stock: {p.stock_total}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '1rem 1.25rem' }}>
                    <span className="badge badge-olive">{CATEGORIES[p.category] || p.category}</span>
                  </td>
                  <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--forest)', letterSpacing: '-0.02em' }}>{formatPrice(p.wholesale_price)}</span>
                    {p.is_gst_free && <span className="badge badge-sage" style={{ display: 'block', marginTop: '0.25rem' }}>GST free</span>}
                  </td>
                  <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--moss)', letterSpacing: '-0.02em' }}>
                      {formatPrice(p.is_gst_free
                        ? Math.round(p.wholesale_price * (1 + (p.b2c_markup_pct || 0.45)))
                        : Math.round(p.wholesale_price * (1 + (p.b2c_markup_pct || 0.45)) * 1.1)
                      )}
                    </span>
                    <p className="type-label-sm" style={{ color: 'var(--moss)', opacity: 0.6, marginTop: '0.15rem' }}>
                      {Math.round((p.b2c_markup_pct || 0.45) * 100)}% markup
                    </p>
                  </td>
                  <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                    <span style={{ fontWeight: 700, color: 'var(--forest)' }}>{p.b2b_available}</span>
                    <span style={{ color: 'var(--moss)' }}> / </span>
                    <span style={{ fontWeight: 700, color: 'var(--moss)' }}>{p.b2c_available}</span>
                  </td>
                  <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                    <button
                      onClick={() => toggleListed(p.id, p.is_listed_this_week)}
                      disabled={!listingOpen || toggling === p.id}
                      className={`toggle ${p.is_listed_this_week ? 'toggle-on' : 'toggle-off'}`}
                      style={!listingOpen ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                    />
                  </td>
                  <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                    <Link href={`/dashboard/farmer/inventory/${p.id}`} className="btn btn-ghost btn-sm">Edit</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
