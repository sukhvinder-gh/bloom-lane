'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils/pricing'
import { isListingWindowOpen } from '@/lib/utils/timezone'

const CATEGORY_LABELS: Record<string, string> = {
  flowers_cut:   'Cut Flowers',
  flowers_dried: 'Dried Flowers',
  foliage:       'Foliage',
  vegetables:    'Vegetables',
  herbs:         'Herbs',
  fruit:         'Fruit',
  eggs:          'Eggs',
  honey:         'Honey',
  other:         'Other',
}

const CATEGORY_EMOJI: Record<string, string> = {
  flowers_cut:   '🌸',
  flowers_dried: '🌾',
  foliage:       '🍃',
  vegetables:    '🥦',
  herbs:         '🌿',
  fruit:         '🍓',
  eggs:          '🥚',
  honey:         '🍯',
  other:         '📦',
}

type StatusFilter = 'all' | 'listed' | 'unlisted'
type SortOption   = 'newest' | 'name_asc' | 'price_asc' | 'price_desc' | 'stock_asc' | 'stock_desc'

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest',     label: 'Recently added' },
  { value: 'name_asc',   label: 'Name A–Z' },
  { value: 'price_asc',  label: 'Price ↑' },
  { value: 'price_desc', label: 'Price ↓' },
  { value: 'stock_asc',  label: 'Stock ↑' },
  { value: 'stock_desc', label: 'Stock ↓' },
]

export default function FarmerInventoryPage() {
  const [products, setProducts]   = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [listingOpen]             = useState(isListingWindowOpen())
  const [toggling, setToggling]   = useState<string | null>(null)
  const [search, setSearch]       = useState('')
  const [category, setCategory]   = useState('all')
  const [status, setStatus]       = useState<StatusFilter>('all')
  const [sort, setSort]           = useState<SortOption>('newest')

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

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const base = products.filter(p => {
      if (category !== 'all' && p.category !== category) return false
      if (status === 'listed'   && !p.is_listed_this_week) return false
      if (status === 'unlisted' &&  p.is_listed_this_week) return false
      if (q && !p.name.toLowerCase().includes(q)) return false
      return true
    })
    return [...base].sort((a, b) => {
      switch (sort) {
        case 'name_asc':   return a.name.localeCompare(b.name)
        case 'price_asc':  return a.wholesale_price - b.wholesale_price
        case 'price_desc': return b.wholesale_price - a.wholesale_price
        case 'stock_asc':  return a.stock_total - b.stock_total
        case 'stock_desc': return b.stock_total - a.stock_total
        default:           return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })
  }, [products, search, category, status, sort])

  return (
    <div className="page-pad" style={{ padding: '2.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <h1 className="type-heading reveal" style={{ color: 'var(--forest)', marginBottom: '0.375rem' }}>My Inventory</h1>
          <p className="type-label" style={{ color: 'var(--moss)' }}>{listedCount} of {products.length} listed this week</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className={`badge ${listingOpen ? 'badge-sage' : 'badge-olive'}`}>
            {listingOpen && <span className="status-dot status-live" />}
            {listingOpen ? 'Window open' : 'Window closed'}
          </span>
          <Link href="/dashboard/farmer/inventory/bulk-import" className="btn btn-ghost btn-sm">↑ Bulk import</Link>
          <Link href="/dashboard/farmer/inventory/new" className="btn btn-forest btn-sm">+ New product</Link>
        </div>
      </div>

      {!listingOpen && (
        <div className="reveal" style={{ background: 'var(--olive)', border: '1px solid var(--sage)', borderRadius: '1.5rem', padding: '1.25rem 1.75rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '1.5rem' }}>🔒</span>
          <p className="type-label-sm" style={{ color: 'var(--forest)', lineHeight: 1.7 }}>Listing window is closed. You can view inventory but cannot toggle listings until Sunday midnight AEST.</p>
        </div>
      )}

      {/* Compact filter toolbar */}
      {!loading && products.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center',
          background: 'white', border: '1px solid var(--olive)',
          borderRadius: '0.75rem', marginBottom: '1.25rem',
          overflow: 'hidden', flexWrap: 'wrap',
        }}>
          {/* Search */}
          <div style={{ display: 'flex', alignItems: 'center', flex: '1 1 160px', minWidth: '140px', padding: '0 0.875rem', gap: '0.5rem', borderRight: '1px solid var(--olive)' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--moss)', flexShrink: 0 }}>🔍</span>
            <input
              placeholder="Search products…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '0.825rem', color: 'var(--navy)', width: '100%', padding: '0.65rem 0', fontFamily: 'var(--font-body)' }}
            />
          </div>

          {/* Category */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0 0.875rem', borderRight: '1px solid var(--olive)', flexShrink: 0 }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Category</span>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '0.825rem', color: 'var(--navy)', cursor: 'pointer', fontFamily: 'var(--font-body)', padding: '0.65rem 0' }}
            >
              <option value="all">All</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{CATEGORY_EMOJI[k]} {v}</option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0 0.875rem', borderRight: '1px solid var(--olive)', flexShrink: 0 }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Sort</span>
            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortOption)}
              style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '0.825rem', color: 'var(--navy)', cursor: 'pointer', fontFamily: 'var(--font-body)', padding: '0.65rem 0' }}
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Status tabs */}
          <div style={{ display: 'flex', flexShrink: 0 }}>
            {(['all', 'listed', 'unlisted'] as StatusFilter[]).map((s, i) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                style={{
                  padding: '0.65rem 0.875rem',
                  background: status === s ? 'var(--forest)' : 'transparent',
                  color: status === s ? 'white' : 'var(--moss)',
                  border: 'none',
                  borderLeft: i > 0 ? '1px solid var(--olive)' : 'none',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  whiteSpace: 'nowrap',
                }}
              >
                {s === 'all' ? `All (${products.length})` : s === 'listed' ? `Listed (${listedCount})` : `Unlisted (${products.length - listedCount})`}
              </button>
            ))}
          </div>
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
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🔍</p>
          <p style={{ color: 'var(--moss)', fontSize: '0.875rem' }}>No products match your filters.</p>
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
              {filtered.map(p => (
                <tr key={p.id} className="table-row">
                  <td style={{ padding: '1rem 1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                      <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: 'var(--olive)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0, overflow: 'hidden' }}>
                        {p.image_url ? <img src={p.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : CATEGORY_EMOJI[p.category] || '🌿'}
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, color: 'var(--forest)' }}>{p.name}</p>
                        <p className="type-label-sm" style={{ color: 'var(--moss)' }}>per {p.unit} · stock: {p.stock_total}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '1rem 1.25rem' }}>
                    <span className="badge badge-olive">{CATEGORY_EMOJI[p.category]} {CATEGORY_LABELS[p.category] || p.category}</span>
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
