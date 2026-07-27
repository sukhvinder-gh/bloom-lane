'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const FLOWER_TYPES = [
  { id: '', label: 'All types' },
  { id: 'flowers_cut',   label: '✿ Cut Flowers' },
  { id: 'flowers_dried', label: '🌾 Dried' },
  { id: 'flowers_native',label: '🌼 Natives' },
  { id: 'foliage',       label: '🍃 Foliage' },
  { id: 'vegetables',    label: '🥦 Vegetables' },
  { id: 'herbs',         label: '🌿 Herbs' },
  { id: 'fruit',         label: '🍓 Fruit' },
  { id: 'eggs',          label: '🥚 Eggs' },
  { id: 'honey',         label: '🍯 Honey' },
  { id: 'other',         label: '📦 Other' },
]

const SUSTAINABILITY_OPTIONS = [
  'Organic', 'Spray-free', 'Regenerative', 'Composting',
  'Rainwater harvesting', 'Solar powered', 'No pesticides',
]

export default function GrowersPage() {
  const router = useRouter()
  const [growers, setGrowers]       = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [region, setRegion]         = useState('')
  const [flowerType, setFlowerType] = useState('')
  const [sustain, setSustain]       = useState('')
  const [regions, setRegions]       = useState<string[]>([])
  const [openMenu, setOpenMenu]     = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    if (openMenu) document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [openMenu])

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (region)     params.set('region', region)
    if (sustain)    params.set('sustainability', sustain)
    if (flowerType) params.set('flower_type', flowerType)

    fetch(`/api/growers?${params}`)
      .then(r => r.json())
      .then(d => {
        const data = d.data || []
        setGrowers(data)
        const uniqueRegions = [...new Set(data.map((g: any) => g.region).filter(Boolean))] as string[]
        setRegions(uniqueRegions.sort())
        setLoading(false)
      })
  }, [region, flowerType, sustain])

  const filtered = growers.filter(g =>
    !search ||
    g.business_name.toLowerCase().includes(search.toLowerCase()) ||
    g.suburb?.toLowerCase().includes(search.toLowerCase()) ||
    g.region?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)' }}>

      {/* Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 40, background: 'rgba(255,247,249,0.9)', backdropFilter: 'blur(16px)', borderBottom: '1px solid var(--border-light)', padding: '1rem 2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', textDecoration: 'none', flexShrink: 0 }}>
          <div style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', color: 'var(--cream)', fontSize: '1rem' }}>T</div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--navy)', fontWeight: 600 }}>The Green Guild</span>
        </Link>
        <div style={{ flex: 1, position: 'relative' }}>
          <svg style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: 'var(--moss)', pointerEvents: 'none' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input className="input" style={{ paddingLeft: '2.5rem', paddingTop: '0.6rem', paddingBottom: '0.6rem' }} placeholder="Search growers or regions…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: '0.625rem', flexShrink: 0 }}>
          <Link href="/marketplace" className="btn btn-ghost btn-sm">Marketplace</Link>
          <Link href="/dashboard" className="btn btn-forest btn-sm">Dashboard</Link>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ background: 'var(--navy)', padding: '3rem 2rem', textAlign: 'center' }}>
        <h1 className="type-heading" style={{ color: 'white', marginBottom: '0.5rem' }}>Browse Growers</h1>
        <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '1rem', maxWidth: '40rem', margin: '0 auto' }}>
          Discover Australian flower growers, their practices, and seasonal offerings — before you place an order.
        </p>
      </div>

      <div style={{ display: 'flex', maxWidth: '80rem', margin: '0 auto', padding: '2rem', gap: '2rem', alignItems: 'flex-start' }}>

        {/* Sidebar filters — desktop */}
        <aside className="desktop-only" style={{ width: '14rem', flexShrink: 0, position: 'sticky', top: '5rem' }}>
          <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* Region */}
            <div>
              <p className="type-label-sm" style={{ color: 'var(--moss)', marginBottom: '0.5rem' }}>Region</p>
              <select className="input" style={{ fontSize: '0.85rem' }} value={region} onChange={e => setRegion(e.target.value)}>
                <option value="">All regions</option>
                {regions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {/* Flower type */}
            <div>
              <p className="type-label-sm" style={{ color: 'var(--moss)', marginBottom: '0.5rem' }}>Flower / Product Type</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                {FLOWER_TYPES.map(f => (
                  <button key={f.id} onClick={() => setFlowerType(f.id)}
                    className={`nav-item${flowerType === f.id ? ' active' : ''}`}
                    style={{ textAlign: 'left', fontSize: '0.8rem' }}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sustainability */}
            <div>
              <p className="type-label-sm" style={{ color: 'var(--moss)', marginBottom: '0.5rem' }}>Sustainability</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <button onClick={() => setSustain('')}
                  className={`nav-item${sustain === '' ? ' active' : ''}`}
                  style={{ textAlign: 'left', fontSize: '0.8rem' }}>All practices</button>
                {SUSTAINABILITY_OPTIONS.map(s => (
                  <button key={s} onClick={() => setSustain(sustain === s ? '' : s)}
                    className={`nav-item${sustain === s ? ' active' : ''}`}
                    style={{ textAlign: 'left', fontSize: '0.8rem' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

          </div>
        </aside>

        {/* Mobile filter strip */}
        <div className="mobile-only" style={{ display: 'none', gap: '0.5rem', overflowX: 'auto', WebkitOverflowScrolling: 'touch', marginBottom: '1rem', flexShrink: 0, width: '100%' }}>
          {FLOWER_TYPES.slice(1).map(f => (
            <button key={f.id} onClick={() => setFlowerType(flowerType === f.id ? '' : f.id)}
              style={{ flexShrink: 0, padding: '0.375rem 0.875rem', borderRadius: '99px', border: `1.5px solid ${flowerType === f.id ? 'var(--navy)' : 'var(--border)'}`, background: flowerType === f.id ? 'var(--navy)' : 'white', color: flowerType === f.id ? 'white' : 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Grower grid */}
        <main style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
            <h2 className="type-subheading" style={{ color: 'var(--navy)' }}>
              {loading ? '…' : `${filtered.length} grower${filtered.length !== 1 ? 's' : ''}`}
            </h2>
            {(region || flowerType || sustain) && (
              <button onClick={() => { setRegion(''); setFlowerType(''); setSustain('') }}
                className="btn btn-ghost btn-sm">Clear filters</button>
            )}
          </div>

          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(17rem, 1fr))', gap: '1.25rem' }}>
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="card" style={{ height: '14rem' }} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="card" style={{ padding: '4rem', textAlign: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🌱</div>
              <p className="type-subheading" style={{ color: 'var(--navy)', marginBottom: '0.5rem' }}>No growers found</p>
              <p className="type-label" style={{ color: 'var(--moss)' }}>Try adjusting your filters</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(17rem, 1fr))', gap: '1.25rem' }}>
              {filtered.map((grower, i) => (
                <div key={grower.id} style={{ position: 'relative' }}>

                  {/* Three-dot menu button */}
                  <button
                    onClick={e => { e.preventDefault(); e.stopPropagation(); setOpenMenu(openMenu === grower.id ? null : grower.id) }}
                    style={{ position: 'absolute', top: '0.625rem', right: '0.625rem', zIndex: 10, width: '2rem', height: '2rem', borderRadius: '50%', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(4px)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', color: 'var(--navy)', lineHeight: 1, fontWeight: 700 }}
                    aria-label="Actions"
                  >
                    ⋮
                  </button>

                  {/* Dropdown */}
                  {openMenu === grower.id && (
                    <div ref={menuRef} style={{ position: 'absolute', top: '2.75rem', right: '0.625rem', zIndex: 50, background: 'white', borderRadius: '0.75rem', boxShadow: '0 4px 24px rgba(30,37,53,0.14)', border: '1px solid var(--border-light)', minWidth: '11rem', overflow: 'hidden' }}>
                      {[
                        { icon: '👤', label: 'View Profile',      href: `/growers/${grower.id}` },
                        { icon: '🛒', label: 'Shop Marketplace',   href: '/marketplace' },
                        { icon: '📋', label: 'See Their Products', href: `/growers/${grower.id}#products` },
                      ].map(action => (
                        <button
                          key={action.label}
                          onClick={e => { e.stopPropagation(); setOpenMenu(null); router.push(action.href) }}
                          style={{ width: '100%', padding: '0.75rem 1rem', background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '0.625rem', fontSize: '0.85rem', color: 'var(--navy)', fontFamily: 'var(--font-body)', cursor: 'pointer', textAlign: 'left' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--offwhite)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >
                          <span style={{ width: '1.25rem', textAlign: 'center' }}>{action.icon}</span>
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Card */}
                  <Link href={`/growers/${grower.id}`} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
                    <div className={`card card-hover reveal reveal-d${(i % 3) + 1}`} style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>
                      {/* Banner */}
                      <div style={{ height: '5rem', background: grower.brand_color || 'var(--navy)', flexShrink: 0, position: 'relative' }}>
                        {grower.banner_url && <img src={grower.banner_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      </div>

                      <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div>
                          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--navy)', marginBottom: '0.2rem' }}>{grower.business_name}</h3>
                          <p className="type-label-sm" style={{ color: 'var(--moss)' }}>
                            📍 {[grower.region, grower.suburb, grower.state].filter(Boolean).join(', ')}
                          </p>
                        </div>

                        {grower.bio && (
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {grower.bio}
                          </p>
                        )}

                        {grower.sustainability?.length > 0 && (
                          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                            {grower.sustainability.slice(0, 3).map((s: string) => (
                              <span key={s} className="badge badge-sage" style={{ fontSize: '0.65rem' }}>{s}</span>
                            ))}
                          </div>
                        )}

                        {grower.seasonal_specialties?.length > 0 && (
                          <p className="type-label-sm" style={{ color: 'var(--moss)', marginTop: 'auto' }}>
                            🌸 {grower.seasonal_specialties.slice(0, 2).join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
