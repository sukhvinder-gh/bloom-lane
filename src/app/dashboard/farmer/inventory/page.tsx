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

type StatusFilter = 'all' | 'listed' | 'unlisted' | 'archived'
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
  const [selected, setSelected]   = useState<Set<string>>(new Set())
  const [bulkStock, setBulkStock] = useState('')
  const [bulkBusy, setBulkBusy]   = useState(false)
  const [bulkError, setBulkError] = useState('')

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

  const activeProducts   = products.filter(p => p.is_active)
  const archivedProducts = products.filter(p => !p.is_active)
  const listedCount      = activeProducts.filter(p => p.is_listed_this_week).length

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const pool = status === 'archived' ? archivedProducts : activeProducts
    const base = pool.filter(p => {
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
  }, [activeProducts, archivedProducts, search, category, status, sort])

  // Selection resets whenever the visible pool changes, so stale ids from a
  // different tab/filter never get bulk-actioned by accident.
  useEffect(() => { setSelected(new Set()) }, [status])

  function toggleSelected(id: string) {
    setSelected(s => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelected(s => s.size === filtered.length ? new Set() : new Set(filtered.map(p => p.id)))
  }

  const [restoring, setRestoring] = useState<string | null>(null)
  async function restoreOne(id: string) {
    setRestoring(id)
    await fetch(`/api/products/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: true }) })
    setProducts(ps => ps.map(p => p.id === id ? { ...p, is_active: true } : p))
    setRestoring(null)
  }

  async function bulkUpdate(updates: Record<string, any>) {
    setBulkBusy(true)
    setBulkError('')
    const res = await fetch('/api/products/bulk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_ids: [...selected], updates }),
    })
    const result = await res.json()
    if (!res.ok) {
      setBulkError(result.error?.message || result.error || 'Bulk update failed')
      setBulkBusy(false)
      return
    }
    setProducts(ps => ps.map(p => selected.has(p.id) ? { ...p, ...updates } : p))
    setSelected(new Set())
    setBulkStock('')
    setBulkBusy(false)
  }

  return (
    <div className="page-pad" style={{ padding: '2.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div>
          <h1 className="type-heading reveal" style={{ color: 'var(--forest)', marginBottom: '0.375rem' }}>My Inventory</h1>
          <p className="type-label" style={{ color: 'var(--moss)' }}>{listedCount} of {activeProducts.length} listed this week</p>
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
          <p className="type-label-sm" style={{ color: 'var(--forest)', lineHeight: 1.7 }}>Listing window is closed. You can view inventory but cannot toggle listings or stock until Sunday midnight AEST. Archiving is unaffected.</p>
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
            {([
              { id: 'all' as StatusFilter,      label: `All (${activeProducts.length})` },
              { id: 'listed' as StatusFilter,   label: `Listed (${listedCount})` },
              { id: 'unlisted' as StatusFilter, label: `Unlisted (${activeProducts.length - listedCount})` },
              { id: 'archived' as StatusFilter, label: `Archived (${archivedProducts.length})` },
            ]).map((t, i) => (
              <button
                key={t.id}
                onClick={() => setStatus(t.id)}
                style={{
                  padding: '0.65rem 0.875rem',
                  background: status === t.id ? 'var(--forest)' : 'transparent',
                  color: status === t.id ? 'white' : 'var(--moss)',
                  border: 'none',
                  borderLeft: i > 0 ? '1px solid var(--olive)' : 'none',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bulk action toolbar */}
      {selected.size > 0 && (
        <div className="reveal" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', background: 'var(--navy)', color: 'white', borderRadius: '0.75rem', padding: '0.875rem 1.25rem', marginBottom: '1.25rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{selected.size} selected</span>
          <span style={{ flex: 1 }} />

          {status === 'archived' ? (
            <button className="btn btn-cream btn-sm" disabled={bulkBusy} onClick={() => bulkUpdate({ is_active: true })}>
              {bulkBusy ? '…' : '↺ Restore selected'}
            </button>
          ) : (
            <>
              <button className="btn btn-cream btn-sm" disabled={bulkBusy || !listingOpen} onClick={() => bulkUpdate({ is_listed_this_week: true })}>
                {bulkBusy ? '…' : 'Mark listed'}
              </button>
              <button className="btn btn-cream btn-sm" disabled={bulkBusy || !listingOpen} onClick={() => bulkUpdate({ is_listed_this_week: false })}>
                {bulkBusy ? '…' : 'Mark unlisted'}
              </button>
              <input
                type="number"
                min="0"
                placeholder="Set stock"
                value={bulkStock}
                onChange={e => setBulkStock(e.target.value)}
                disabled={!listingOpen}
                style={{ width: '6rem', padding: '0.4rem 0.6rem', borderRadius: '0.5rem', border: 'none', fontSize: '0.8rem' }}
              />
              <button
                className="btn btn-cream btn-sm"
                disabled={bulkBusy || !listingOpen || bulkStock === ''}
                onClick={() => bulkUpdate({ stock_total: parseInt(bulkStock, 10) })}
              >
                {bulkBusy ? '…' : 'Apply stock'}
              </button>
              <button className="btn btn-ghost btn-sm" style={{ color: 'white', borderColor: 'rgba(255,255,255,0.4)' }} disabled={bulkBusy} onClick={() => bulkUpdate({ is_active: false })}>
                {bulkBusy ? '…' : '🗄 Archive selected'}
              </button>
            </>
          )}
        </div>
      )}
      {bulkError && <p style={{ color: 'var(--bloom)', fontSize: '0.8rem', marginBottom: '1rem' }}>{bulkError}</p>}

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
                <th style={{ padding: '1rem 0 1rem 1.25rem', width: '2.25rem' }}>
                  <input type="checkbox" checked={selected.size === filtered.length} onChange={toggleSelectAll} />
                </th>
                {['Product', 'Category', 'Wholesale (ex-GST)', 'B2C Retail (inc-GST)', 'B2B / B2C left', 'Sold', status === 'archived' ? 'Archived' : 'Listed', ''].map(h => (
                  <th key={h} className="type-label-sm" style={{ textAlign: ['Wholesale (ex-GST)', 'B2C Retail (inc-GST)', 'B2B / B2C left', 'Sold'].includes(h) ? 'right' : (h === 'Listed' || h === 'Archived') ? 'center' : 'left', padding: '1rem 1.25rem', color: 'var(--moss)', letterSpacing: '0.15em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} className="table-row" style={!p.is_active ? { opacity: 0.65 } : undefined}>
                  <td style={{ padding: '1rem 0 1rem 1.25rem' }}>
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelected(p.id)} />
                  </td>
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
                  <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                    {(() => {
                      const sold = Math.max(0, (p.stock_total || 0) - (p.b2b_available || 0) - (p.b2c_available || 0))
                      return sold > 0
                        ? <span style={{ fontWeight: 700, color: '#065F46', background: '#D1FAE5', padding: '0.2rem 0.6rem', borderRadius: '99px', fontSize: '0.8rem' }}>{sold} sold</span>
                        : <span style={{ color: 'var(--moss)', opacity: 0.45, fontSize: '0.8rem' }}>—</span>
                    })()}
                  </td>
                  <td style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
                    {p.is_active ? (
                      <button
                        onClick={() => toggleListed(p.id, p.is_listed_this_week)}
                        disabled={!listingOpen || toggling === p.id}
                        className={`toggle ${p.is_listed_this_week ? 'toggle-on' : 'toggle-off'}`}
                        style={!listingOpen ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
                      />
                    ) : (
                      <span style={{ fontSize: '0.8rem' }}>🗄</span>
                    )}
                  </td>
                  <td style={{ padding: '1rem 1.25rem', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                      <Link href={`/dashboard/farmer/inventory/${p.id}`} className="btn btn-ghost btn-sm">Edit</Link>
                      {!p.is_active && (
                        <button className="btn btn-forest btn-sm" disabled={restoring === p.id} onClick={() => restoreOne(p.id)}>
                          {restoring === p.id ? '…' : '↺ Restore'}
                        </button>
                      )}
                    </div>
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
