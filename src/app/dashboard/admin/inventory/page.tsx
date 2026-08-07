'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils/pricing'

const CATEGORY_LABELS: Record<string, string> = {
  flowers_cut:   'Cut Flowers',
  flowers_dried: 'Dried Flowers',
  flowers_native:'Australian Natives',
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
  flowers_native:'🌼',
  foliage:       '🍃',
  vegetables:    '🥦',
  herbs:         '🌿',
  fruit:         '🍓',
  eggs:          '🥚',
  honey:         '🍯',
  other:         '📦',
}

type StatusFilter = 'all' | 'listed' | 'unlisted'
type SortOption   = 'newest' | 'name_asc' | 'grower_asc' | 'price_asc' | 'price_desc' | 'stock_asc' | 'stock_desc'

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest',     label: 'Recently added' },
  { value: 'name_asc',   label: 'Name A–Z' },
  { value: 'grower_asc', label: 'Grower A–Z' },
  { value: 'price_asc',  label: 'Price ↑' },
  { value: 'price_desc', label: 'Price ↓' },
  { value: 'stock_asc',  label: 'Stock ↑' },
  { value: 'stock_desc', label: 'Stock ↓' },
]

export default function AdminInventoryPage() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch]     = useState('')
  const [category, setCategory] = useState('all')
  const [farm, setFarm]         = useState('all')
  const [status, setStatus]     = useState<StatusFilter>('all')
  const [sort, setSort]         = useState<SortOption>('name_asc')
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/inventory')
      .then(async r => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || `Request failed (${r.status})`)
        setProducts(d.data || [])
      })
      .catch(err => setLoadError(err.message || 'Could not load inventory'))
      .finally(() => setLoading(false))
  }, [])

  async function toggleListed(p: any) {
    setToggling(p.id)
    const next = !p.is_listed_this_week
    const res  = await fetch('/api/admin/inventory', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: p.id, farmerId: p.farmer_id, is_listed_this_week: next }),
    })
    if (res.ok) {
      setProducts(ps => ps.map(x => x.id === p.id ? { ...x, is_listed_this_week: next } : x))
    }
    setToggling(null)
  }

  // "Farm" options combine each grower's own name with, where they belong to
  // one, their hub — so admins can scope the list down to either level.
  const farmOptions = useMemo(() => {
    const names = new Set<string>()
    for (const p of products) {
      if (p.farmers?.business_name) names.add(p.farmers.business_name)
    }
    return [...names].sort()
  }, [products])

  const hubOptions = useMemo(() => {
    const names = new Set<string>()
    for (const p of products) {
      if (p.farmers?.hubs?.name) names.add(p.farmers.hubs.name)
    }
    return [...names].sort()
  }, [products])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()

    const base = products.filter(p => {
      if (category !== 'all' && p.category !== category) return false
      if (farm !== 'all') {
        const isFarmMatch = p.farmers?.business_name === farm
        const isHubMatch   = p.farmers?.hubs?.name === farm
        if (!isFarmMatch && !isHubMatch) return false
      }
      if (status === 'listed'   && !p.is_listed_this_week) return false
      if (status === 'unlisted' &&  p.is_listed_this_week) return false
      if (q) {
        const growerName = (p.farmers?.business_name || '').toLowerCase()
        const hub        = (p.farmers?.hubs?.name || '').toLowerCase()
        if (!p.name.toLowerCase().includes(q) && !growerName.includes(q) && !hub.includes(q)) return false
      }
      return true
    })

    return [...base].sort((a, b) => {
      switch (sort) {
        case 'name_asc':   return a.name.localeCompare(b.name)
        case 'grower_asc': return (a.farmers?.business_name || '').localeCompare(b.farmers?.business_name || '')
        case 'price_asc':  return a.wholesale_price - b.wholesale_price
        case 'price_desc': return b.wholesale_price - a.wholesale_price
        case 'stock_asc':  return a.stock_total - b.stock_total
        case 'stock_desc': return b.stock_total - a.stock_total
        default:           return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })
  }, [products, search, category, farm, status, sort])

  const listedCount = products.filter(p => p.is_listed_this_week).length
  const growerCount = new Set(products.map(p => p.farmer_id)).size

  return (
    <div className="page-pad" style={{ padding: '2.5rem', maxWidth: '68rem' }}>

      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--navy)', marginBottom: '0.25rem' }}>
          All Inventory
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--moss)' }}>
          Every product across all growers — toggle listing status or click a grower to manage their catalogue
        </p>
      </div>

      {/* Load error banner */}
      {loadError && (
        <div style={{ padding: '1rem 1.25rem', borderRadius: '0.75rem', background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B', fontSize: '0.85rem', fontWeight: 600, marginBottom: '1.5rem' }}>
          ⚠ Couldn't load inventory: {loadError}
        </div>
      )}

      {/* Summary stats */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.875rem', marginBottom: '2rem' }}>
          {[
            { label: 'Total products',    value: products.length, color: 'var(--navy)' },
            { label: 'Listed this week',  value: listedCount,     color: '#065F46' },
            { label: 'Growers with stock',value: growerCount,     color: 'var(--moss)' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '1rem 1.25rem' }}>
              <p style={{ fontSize: '1.75rem', fontFamily: 'var(--font-display)', color: s.color, fontWeight: 700, lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Compact filter toolbar */}
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
            placeholder="Search product, grower or hub…"
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

        {/* Farm / Hub */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0 0.875rem', borderRight: '1px solid var(--olive)', flexShrink: 0 }}>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Farm/Hub</span>
          <select
            value={farm}
            onChange={e => setFarm(e.target.value)}
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '0.825rem', color: 'var(--navy)', cursor: 'pointer', fontFamily: 'var(--font-body)', padding: '0.65rem 0', maxWidth: '10rem' }}
          >
            <option value="all">All</option>
            {farmOptions.length > 0 && (
              <optgroup label="Farms">
                {farmOptions.map(f => <option key={f} value={f}>{f}</option>)}
              </optgroup>
            )}
            {hubOptions.length > 0 && (
              <optgroup label="Hubs">
                {hubOptions.map(h => <option key={h} value={h}>{h}</option>)}
              </optgroup>
            )}
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

      {/* Product list */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card" style={{ height: '4.5rem', padding: '1rem' }} />
          ))}
        </div>
      ) : loadError ? null : filtered.length === 0 ? (
        <div className="card" style={{ padding: '4rem', textAlign: 'center' }}>
          <p style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📦</p>
          <p style={{ color: 'var(--moss)', fontSize: '0.9rem' }}>
            {products.length === 0 ? 'No products in the system yet.' : 'No products match your filters.'}
          </p>
        </div>
      ) : (
        <>
          <p style={{ fontSize: '0.775rem', color: 'var(--text-3)', marginBottom: '0.75rem' }}>
            Showing {filtered.length} of {products.length} products
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {filtered.map(p => {
              const farmer = p.farmers
              const hub    = farmer?.hubs
              const thumb  = p.image_url || (p.image_urls && p.image_urls[0])

              return (
                <div
                  key={p.id}
                  className="card"
                  style={{ padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}
                >
                  {/* Thumbnail */}
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={p.name}
                      style={{ width: '3rem', height: '3rem', borderRadius: '0.5rem', objectFit: 'cover', flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{
                      width: '3rem', height: '3rem', borderRadius: '0.5rem',
                      background: 'var(--green-soft)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.4rem', flexShrink: 0,
                    }}>
                      {CATEGORY_EMOJI[p.category] || '🌿'}
                    </div>
                  )}

                  {/* Product info */}
                  <div style={{ flex: '2 1 160px', minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--moss)' }}>
                      {CATEGORY_EMOJI[p.category]} {CATEGORY_LABELS[p.category] || p.category} · {p.unit}
                    </p>
                  </div>

                  {/* Grower info */}
                  <div style={{ flex: '2 1 140px', minWidth: 0 }}>
                    <Link
                      href={`/dashboard/admin/farmers/${farmer?.id}/inventory`}
                      style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--forest)', textDecoration: 'none' }}
                    >
                      {farmer?.business_name || 'Unknown grower'}
                    </Link>
                    {hub && (
                      <p style={{ fontSize: '0.72rem', color: 'var(--moss)', marginTop: '0.1rem' }}>
                        🏛 {hub.name}{hub.region ? ` · ${hub.region}` : ''}
                      </p>
                    )}
                  </div>

                  {/* Price + stock */}
                  <div style={{ flex: '0 0 auto', textAlign: 'right', minWidth: '6rem' }}>
                    <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--navy)' }}>
                      {formatPrice(p.wholesale_price)}
                    </p>
                    <p style={{ fontSize: '0.72rem', color: p.stock_total <= 5 ? '#B91C1C' : 'var(--moss)' }}>
                      {p.stock_total} {p.unit}s{p.stock_total <= 5 ? ' ⚠' : ''}
                    </p>
                  </div>

                  {/* Listed toggle */}
                  <button
                    onClick={() => toggleListed(p)}
                    disabled={toggling === p.id}
                    style={{
                      padding: '0.3rem 0.875rem',
                      borderRadius: '99px',
                      border: `1.5px solid ${p.is_listed_this_week ? '#6EE7B7' : 'var(--olive)'}`,
                      background: p.is_listed_this_week ? '#D1FAE5' : 'white',
                      color: p.is_listed_this_week ? '#065F46' : 'var(--moss)',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      cursor: toggling === p.id ? 'default' : 'pointer',
                      opacity: toggling === p.id ? 0.5 : 1,
                      fontFamily: 'var(--font-body)',
                      transition: 'all 0.15s',
                      flexShrink: 0,
                    }}
                  >
                    {toggling === p.id ? '…' : p.is_listed_this_week ? '✓ Listed' : 'Unlisted'}
                  </button>

                  {/* Edit link */}
                  <Link
                    href={`/dashboard/admin/farmers/${farmer?.id}/inventory`}
                    className="btn btn-ghost btn-sm"
                    style={{ flexShrink: 0 }}
                  >
                    Edit
                  </Link>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
