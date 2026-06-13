'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils/pricing'

const CATEGORY_LABELS: Record<string, string> = {
  flowers_cut:   '✿ Cut Flowers',
  flowers_dried: '🌾 Dried Flowers',
  foliage:       '🍃 Foliage',
  vegetables:    '🥦 Vegetables',
  herbs:         '🌿 Herbs',
  fruit:         '🍓 Fruit',
  eggs:          '🥚 Eggs',
  honey:         '🍯 Honey',
  other:         '📦 Other',
}

type StatusFilter = 'all' | 'listed' | 'unlisted'

export default function AdminInventoryPage() {
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [category, setCategory] = useState('all')
  const [status, setStatus]     = useState<StatusFilter>('all')
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/inventory')
      .then(r => r.json())
      .then(d => setProducts(d.data || []))
      .catch(() => {})
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

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return products.filter(p => {
      if (category !== 'all' && p.category !== category) return false
      if (status === 'listed'   && !p.is_listed_this_week) return false
      if (status === 'unlisted' &&  p.is_listed_this_week) return false
      if (q) {
        const growerName = (p.farmers?.business_name || '').toLowerCase()
        const hub        = (p.farmers?.hubs?.name || '').toLowerCase()
        if (!p.name.toLowerCase().includes(q) && !growerName.includes(q) && !hub.includes(q)) return false
      }
      return true
    })
  }, [products, search, category, status])

  const listedCount  = products.filter(p => p.is_listed_this_week).length
  const growerCount  = new Set(products.map(p => p.farmer_id)).size

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

      {/* Summary stats */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.875rem', marginBottom: '2rem' }}>
          {[
            { label: 'Total products', value: products.length, color: 'var(--navy)' },
            { label: 'Listed this week', value: listedCount, color: '#065F46' },
            { label: 'Growers with stock', value: growerCount, color: 'var(--moss)' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '1rem 1.25rem' }}>
              <p style={{ fontSize: '1.75rem', fontFamily: 'var(--font-display)', color: s.color, fontWeight: 700, lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginTop: '0.25rem' }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center' }}>
        <input
          className="input"
          placeholder="Search product, grower, or hub…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: '1 1 220px', minWidth: '180px', maxWidth: '300px' }}
        />
        <select
          className="input"
          value={category}
          onChange={e => setCategory(e.target.value)}
          style={{ flex: '0 0 auto' }}
        >
          <option value="all">All categories</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <div style={{ display: 'flex', border: '1px solid var(--olive)', borderRadius: '0.625rem', overflow: 'hidden', flexShrink: 0 }}>
          {(['all', 'listed', 'unlisted'] as StatusFilter[]).map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              style={{
                padding: '0.45rem 0.875rem',
                background: status === s ? 'var(--forest)' : 'white',
                color: status === s ? 'white' : 'var(--moss)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
                fontFamily: 'var(--font-body)',
                borderRight: s !== 'unlisted' ? '1px solid var(--olive)' : 'none',
              }}
            >
              {s === 'all' ? 'All' : s === 'listed' ? 'Listed' : 'Unlisted'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card" style={{ height: '4.5rem', padding: '1rem' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
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
              const farmer  = p.farmers
              const hub     = farmer?.hubs
              const thumb   = p.image_url || (p.image_urls && p.image_urls[0])

              return (
                <div
                  key={p.id}
                  className="card"
                  style={{ padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}
                >
                  {/* Thumbnail */}
                  {thumb ? (
                    <img src={thumb} alt={p.name}
                      style={{ width: '3rem', height: '3rem', borderRadius: '0.5rem', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: '3rem', height: '3rem', borderRadius: '0.5rem', background: 'var(--green-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', flexShrink: 0 }}>
                      {CATEGORY_LABELS[p.category]?.split(' ')[0] || '🌿'}
                    </div>
                  )}

                  {/* Product info */}
                  <div style={{ flex: '2 1 160px', minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.name}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--moss)' }}>
                      {CATEGORY_LABELS[p.category] || p.category} · {p.unit}
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
                    <p style={{ fontSize: '0.72rem', color: 'var(--moss)' }}>
                      {p.stock_total} {p.unit}s
                    </p>
                  </div>

                  {/* Listed toggle */}
                  <div style={{ flex: '0 0 auto' }}>
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
                      }}
                    >
                      {toggling === p.id ? '…' : p.is_listed_this_week ? '✓ Listed' : 'Unlisted'}
                    </button>
                  </div>

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
