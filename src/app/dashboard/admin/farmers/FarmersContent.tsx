'use client'
import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { formatAEST } from '@/lib/utils/timezone'

type FilterVal = 'all' | 'pending_approval' | 'approved' | 'suspended'
type SortKey   = 'business_name' | 'status' | 'created_at' | 'commission_rate'
type SortDir   = 'asc' | 'desc'

const STATUS_BADGE: Record<string, string> = {
  pending_approval: 'badge badge-amber',
  approved:         'badge badge-sage',
  suspended:        'badge badge-red',
}
const STATUS_LABEL: Record<string, string> = {
  pending_approval: '⏳ Pending',
  approved:         '✓ Approved',
  suspended:        '✕ Suspended',
}

export default function FarmersContent() {
  const searchParams = useSearchParams()
  const rawFilter    = searchParams.get('filter') || 'all'
  const normalise    = (f: string): FilterVal => f === 'pending' ? 'pending_approval' : f as FilterVal

  const [farmers,   setFarmers]   = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState<FilterVal>(normalise(rawFilter))
  const [actioning, setActioning] = useState<string | null>(null)
  const [search,    setSearch]    = useState('')
  const [sortKey,   setSortKey]   = useState<SortKey>('created_at')
  const [sortDir,   setSortDir]   = useState<SortDir>('desc')
  const [openMenu,  setOpenMenu]  = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenu(null)
    }
    if (openMenu) document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [openMenu])

  useEffect(() => {
    setLoading(true)
    const param = filter === 'all' ? '' : `?filter=${filter}`
    fetch(`/api/admin/farmers${param}`)
      .then(r => r.json())
      .then(d => { setFarmers(Array.isArray(d) ? d : d.data || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [filter])

  async function updateStatus(id: string, status: 'approved' | 'suspended') {
    setActioning(id)
    await fetch('/api/admin/farmers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ farmerId: id, status }),
    })
    setFarmers(fs => fs.map(f => f.id === id ? { ...f, status } : f))
    setActioning(null)
    setOpenMenu(null)
  }

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(k); setSortDir('asc') }
  }

  function sortIcon(k: SortKey) {
    if (sortKey !== k) return <span style={{ opacity: 0.3, marginLeft: '0.3rem' }}>↕</span>
    return <span style={{ marginLeft: '0.3rem' }}>{sortDir === 'asc' ? '▲' : '▼'}</span>
  }

  const pendingCount = farmers.filter(f => f.status === 'pending_approval').length

  const displayed = farmers
    .filter(f =>
      !search ||
      f.business_name?.toLowerCase().includes(search.toLowerCase()) ||
      f.profiles?.email?.toLowerCase().includes(search.toLowerCase()) ||
      f.abn?.includes(search)
    )
    .sort((a, b) => {
      let av: any = a[sortKey]
      let bv: any = b[sortKey]
      if (sortKey === 'created_at')     { av = new Date(av).getTime(); bv = new Date(bv).getTime() }
      if (sortKey === 'commission_rate') { av = Number(av); bv = Number(bv) }
      if (av == null) return 1
      if (bv == null) return -1
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  const TABS = [
    { value: 'all' as FilterVal,              label: 'All' },
    { value: 'pending_approval' as FilterVal, label: 'Pending' },
    { value: 'approved' as FilterVal,         label: 'Approved' },
    { value: 'suspended' as FilterVal,        label: 'Suspended' },
  ]

  const thBase: React.CSSProperties = {
    padding: '0.875rem 1.25rem', textAlign: 'left',
    color: 'var(--moss)', letterSpacing: '0.15em',
  }
  const thSort: React.CSSProperties = { ...thBase, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }

  const menuItemStyle: React.CSSProperties = {
    width: '100%', display: 'flex', alignItems: 'center', gap: '0.625rem',
    padding: '0.75rem 1rem', fontSize: '0.85rem', background: 'none', border: 'none',
    fontFamily: 'var(--font-body)', cursor: 'pointer', textAlign: 'left',
  }

  return (
    <div className="page-pad" style={{ padding: '2.5rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="type-heading reveal" style={{ color: 'var(--navy)', marginBottom: '0.25rem' }}>Growers</h1>
          <p className="type-label" style={{ color: 'var(--moss)' }}>
            {displayed.length} shown · {farmers.length} registered · {pendingCount} awaiting approval
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t.value} onClick={() => setFilter(t.value)}
              className={`btn btn-sm ${filter === t.value ? 'btn-forest' : 'btn-ghost'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search bar */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ position: 'relative', maxWidth: '22rem' }}>
          <svg style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', width: '0.9rem', height: '0.9rem', color: 'var(--moss)', pointerEvents: 'none' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input className="input" style={{ paddingLeft: '2.25rem', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}
            placeholder="Search name, email or ABN…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Pending alert */}
      {pendingCount > 0 && filter === 'all' && (
        <div className="reveal" style={{ background: 'var(--amber-soft)', border: '1px solid rgba(196,124,43,0.25)', borderRadius: '1rem', padding: '1rem 1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '1.25rem' }}>⚠️</span>
          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--amber-new)', flex: 1 }}>
            {pendingCount} grower {pendingCount === 1 ? 'application needs' : 'applications need'} review
          </p>
          <button onClick={() => setFilter('pending_approval')} className="btn btn-sm btn-forest">Review now</button>
        </div>
      )}

      {/* Table */}
      <div className="card reveal" style={{ overflow: 'visible' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ padding: '1rem 1.25rem', borderTop: i > 0 ? '1px solid var(--border-light)' : undefined, display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ width: '10rem', height: '1rem', borderRadius: '0.5rem', background: 'var(--offwhite)' }} />
                <div style={{ width: '6rem', height: '1rem', borderRadius: '0.5rem', background: 'var(--offwhite)' }} />
              </div>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center' }}>
            <p style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🌱</p>
            <p className="type-label" style={{ color: 'var(--moss)' }}>No growers found</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'var(--offwhite)', borderBottom: '1px solid var(--border-light)' }}>
                  <th className="type-label-sm" onClick={() => toggleSort('business_name')} style={thSort}>Farm{sortIcon('business_name')}</th>
                  <th className="type-label-sm" style={thBase}>ABN</th>
                  <th className="type-label-sm" style={thBase}>Stripe</th>
                  <th className="type-label-sm" onClick={() => toggleSort('commission_rate')} style={thSort}>Commission{sortIcon('commission_rate')}</th>
                  <th className="type-label-sm" onClick={() => toggleSort('status')} style={thSort}>Status{sortIcon('status')}</th>
                  <th className="type-label-sm" onClick={() => toggleSort('created_at')} style={thSort}>Applied{sortIcon('created_at')}</th>
                  <th className="type-label-sm" style={thBase}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map(farmer => (
                  <tr key={farmer.id} className="table-row">
                    <td style={{ padding: '0.875rem 1.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                        <div style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', background: farmer.brand_color || 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--petal)', fontSize: '0.8rem', fontFamily: 'var(--font-display)', flexShrink: 0 }}>
                          {farmer.business_name?.[0]}
                        </div>
                        <div>
                          <p style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '0.875rem' }}>{farmer.business_name}</p>
                          <p className="type-label-sm" style={{ color: 'var(--moss)' }}>{farmer.profiles?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem' }}>
                      <p style={{ fontSize: '0.8rem', color: 'var(--navy)', fontFamily: 'monospace' }}>{farmer.abn || '—'}</p>
                      {farmer.abn && <span className={`badge ${farmer.abn_verified ? 'badge-sage' : 'badge-amber'}`} style={{ marginTop: '0.25rem' }}>{farmer.abn_verified ? '✓ Verified' : '⏳ Unverified'}</span>}
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem' }}>
                      <span className={`badge ${farmer.stripe_onboarding_complete ? 'badge-sage' : 'badge-amber'}`}>
                        {farmer.stripe_onboarding_complete ? '✓ Connected' : '⏳ Pending'}
                      </span>
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem' }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--navy)', letterSpacing: '-0.02em' }}>{Math.round(farmer.commission_rate * 100)}%</span>
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem' }}>
                      <span className={STATUS_BADGE[farmer.status] || 'badge badge-olive'}>
                        {STATUS_LABEL[farmer.status] || farmer.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem' }}>
                      <p className="type-label-sm" style={{ color: 'var(--moss)' }}>{formatAEST(farmer.created_at, 'dd MMM yy')}</p>
                    </td>

                    {/* Three-dot actions */}
                    <td style={{ padding: '0.875rem 1.25rem' }}>
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <button
                          onClick={e => { e.stopPropagation(); setOpenMenu(openMenu === farmer.id ? null : farmer.id) }}
                          disabled={actioning === farmer.id}
                          aria-label="Row actions"
                          style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: openMenu === farmer.id ? 'var(--navy)' : 'var(--offwhite)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', color: openMenu === farmer.id ? 'white' : 'var(--navy)', fontWeight: 700, transition: 'all 0.15s' }}
                        >
                          {actioning === farmer.id ? '…' : '⋮'}
                        </button>

                        {openMenu === farmer.id && (
                          <div ref={menuRef} style={{ position: 'absolute', top: '2.25rem', right: 0, zIndex: 100, background: 'white', borderRadius: '0.75rem', boxShadow: '0 4px 24px rgba(30,37,53,0.14)', border: '1px solid var(--border-light)', minWidth: '12rem', overflow: 'hidden' }}>

                            <Link
                              href={`/dashboard/admin/farmers/${farmer.id}`}
                              onClick={() => setOpenMenu(null)}
                              style={{ ...menuItemStyle, color: 'var(--navy)', textDecoration: 'none', display: 'flex' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'var(--offwhite)')}
                              onMouseLeave={e => (e.currentTarget.style.background = '')}
                            >
                              <span style={{ width: '1.25rem', textAlign: 'center' }}>✏️</span> Edit Profile
                            </Link>

                            {farmer.status === 'approved' && (
                              <Link
                                href={`/growers/${farmer.id}`}
                                target="_blank"
                                onClick={() => setOpenMenu(null)}
                                style={{ ...menuItemStyle, color: 'var(--navy)', textDecoration: 'none', display: 'flex' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--offwhite)')}
                                onMouseLeave={e => (e.currentTarget.style.background = '')}
                              >
                                <span style={{ width: '1.25rem', textAlign: 'center' }}>👤</span> View Profile
                              </Link>
                            )}

                            {farmer.status === 'pending_approval' && (
                              <button
                                onClick={() => updateStatus(farmer.id, 'approved')}
                                style={{ ...menuItemStyle, color: 'var(--sage-new)' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--sage-soft)')}
                                onMouseLeave={e => (e.currentTarget.style.background = '')}
                              >
                                <span style={{ width: '1.25rem', textAlign: 'center' }}>✓</span> Approve
                              </button>
                            )}

                            {farmer.status === 'approved' && (
                              <button
                                onClick={() => updateStatus(farmer.id, 'suspended')}
                                style={{ ...menuItemStyle, color: 'var(--bloom)' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bloom-soft)')}
                                onMouseLeave={e => (e.currentTarget.style.background = '')}
                              >
                                <span style={{ width: '1.25rem', textAlign: 'center' }}>✕</span> Suspend
                              </button>
                            )}

                            {farmer.status === 'suspended' && (
                              <button
                                onClick={() => updateStatus(farmer.id, 'approved')}
                                style={{ ...menuItemStyle, color: 'var(--navy)' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--offwhite)')}
                                onMouseLeave={e => (e.currentTarget.style.background = '')}
                              >
                                <span style={{ width: '1.25rem', textAlign: 'center' }}>↩</span> Reinstate
                              </button>
                            )}

                          </div>
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
    </div>
  )
}
