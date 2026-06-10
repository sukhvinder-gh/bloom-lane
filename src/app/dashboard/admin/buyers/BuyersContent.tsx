'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { formatAEST } from '@/lib/utils/timezone'

type FilterKey = 'all' | 'pending' | 'verified' | 'b2c'
type SortKey   = 'full_name' | 'role' | 'abn_verified' | 'created_at'
type SortDir   = 'asc' | 'desc'

export default function BuyersContent({ initialBuyers }: { initialBuyers: any[] }) {
  const [buyers,    setBuyers]    = useState<any[]>(initialBuyers)
  const [loading,   setLoading]   = useState(false)
  const [filter,    setFilter]    = useState<FilterKey>('all')
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

  async function doAction(userId: string, action: string) {
    setActioning(userId + action)
    const res = await fetch('/api/admin/buyers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, action }),
    })
    if (res.ok) {
      const d = await fetch(`/api/admin/buyers?filter=${filter}`).then(r => r.json())
      setBuyers(d.data || [])
    }
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

  const b2bCount   = buyers.filter(b => b.role === 'buyer_b2b').length
  const b2cCount   = buyers.filter(b => b.role !== 'buyer_b2b').length
  const pendingB2B = buyers.filter(b => b.role === 'buyer_b2b' && !b.abn_verified).length

  const displayed = buyers
    .filter(b => {
      if (filter === 'pending'  && !(b.role === 'buyer_b2b' && !b.abn_verified)) return false
      if (filter === 'verified' && !(b.role === 'buyer_b2b' && b.abn_verified))  return false
      if (filter === 'b2c'      && b.role !== 'buyer_b2c') return false
      if (search && !b.full_name?.toLowerCase().includes(search.toLowerCase()) &&
          !b.email?.toLowerCase().includes(search.toLowerCase()) &&
          !b.business_name?.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    .sort((a, b) => {
      let av: any = a[sortKey]
      let bv: any = b[sortKey]
      if (sortKey === 'created_at')   { av = new Date(av).getTime(); bv = new Date(bv).getTime() }
      if (sortKey === 'abn_verified') { av = av ? 1 : 0; bv = bv ? 1 : 0 }
      if (av == null) return 1
      if (bv == null) return -1
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  const TABS: { key: FilterKey; label: string }[] = [
    { key: 'all',     label: 'All' },
    { key: 'pending', label: '⏳ Pending ABN' },
    { key: 'verified',label: '✓ Verified B2B' },
    { key: 'b2c',     label: 'B2C Retail' },
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
          <h1 className="type-heading reveal" style={{ color: 'var(--navy)', marginBottom: '0.25rem' }}>Buyers</h1>
          <p className="type-label" style={{ color: 'var(--moss)' }}>
            {displayed.length} shown · {buyers.length} total · {b2bCount} B2B wholesale · {b2cCount} B2C retail
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setFilter(t.key)}
              className={`btn btn-sm ${filter === t.key ? 'btn-forest' : 'btn-ghost'}`}>
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
            placeholder="Search name, email or business…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Pending ABN alert */}
      {pendingB2B > 0 && filter === 'all' && (
        <div className="reveal" style={{ background: 'var(--amber-soft)', border: '1px solid rgba(196,124,43,0.25)', borderRadius: '1rem', padding: '1rem 1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '1.25rem' }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700, color: 'var(--amber-new)', fontSize: '0.875rem' }}>{pendingB2B} B2B {pendingB2B === 1 ? 'buyer needs' : 'buyers need'} ABN verification</p>
            <p style={{ color: 'var(--amber-new)', fontSize: '0.8rem', opacity: 0.8 }}>Verify their ABN to unlock wholesale pricing access.</p>
          </div>
          <button onClick={() => setFilter('pending')} className="btn btn-sm btn-forest">Review now</button>
        </div>
      )}

      {/* Table */}
      <div className="card reveal" style={{ overflow: 'visible' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ padding: '1rem 1.25rem', borderTop: i > 0 ? '1px solid var(--border-light)' : undefined, display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ width: '8rem', height: '1rem', borderRadius: '0.5rem', background: 'var(--offwhite)' }} />
                <div style={{ width: '12rem', height: '1rem', borderRadius: '0.5rem', background: 'var(--offwhite)' }} />
              </div>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center' }}>
            <p style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🛒</p>
            <p className="type-label" style={{ color: 'var(--moss)' }}>No buyers found</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: 'var(--offwhite)', borderBottom: '1px solid var(--border-light)' }}>
                  <th className="type-label-sm" onClick={() => toggleSort('full_name')} style={thSort}>Buyer{sortIcon('full_name')}</th>
                  <th className="type-label-sm" style={thBase}>Email</th>
                  <th className="type-label-sm" onClick={() => toggleSort('role')} style={thSort}>Type{sortIcon('role')}</th>
                  <th className="type-label-sm" style={thBase}>ABN</th>
                  <th className="type-label-sm" onClick={() => toggleSort('abn_verified')} style={thSort}>ABN Status{sortIcon('abn_verified')}</th>
                  <th className="type-label-sm" onClick={() => toggleSort('created_at')} style={thSort}>Joined{sortIcon('created_at')}</th>
                  <th className="type-label-sm" style={thBase}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map(buyer => {
                  const isB2B   = buyer.role === 'buyer_b2b'
                  const verified = buyer.abn_verified
                  const busy    = actioning?.startsWith(buyer.id)
                  return (
                    <tr key={buyer.id} className="table-row" style={{ background: isB2B && !verified ? 'rgba(196,124,43,0.03)' : undefined }}>
                      <td style={{ padding: '0.875rem 1.25rem' }}>
                        <p style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '0.875rem' }}>{buyer.full_name}</p>
                        {buyer.business_name && <p className="type-label-sm" style={{ color: 'var(--moss)' }}>{buyer.business_name}</p>}
                      </td>
                      <td style={{ padding: '0.875rem 1.25rem' }}>
                        <p className="type-label" style={{ color: 'var(--moss)' }}>{buyer.email}</p>
                      </td>
                      <td style={{ padding: '0.875rem 1.25rem' }}>
                        <span className={`badge ${isB2B ? 'badge-sage' : 'badge-cream'}`}>{isB2B ? 'B2B Wholesale' : 'B2C Retail'}</span>
                      </td>
                      <td style={{ padding: '0.875rem 1.25rem' }}>
                        <p style={{ fontSize: '0.8rem', color: 'var(--navy)', fontFamily: 'monospace' }}>{buyer.abn || <span style={{ opacity: 0.3 }}>—</span>}</p>
                      </td>
                      <td style={{ padding: '0.875rem 1.25rem' }}>
                        {!isB2B ? (
                          <span className="type-label-sm" style={{ color: 'var(--moss)' }}>N/A</span>
                        ) : verified ? (
                          <span className="badge badge-sage">✓ Verified</span>
                        ) : (
                          <span className="badge badge-amber">⏳ Pending</span>
                        )}
                      </td>
                      <td style={{ padding: '0.875rem 1.25rem' }}>
                        <p className="type-label-sm" style={{ color: 'var(--moss)' }}>{formatAEST(buyer.created_at, 'dd MMM yy')}</p>
                      </td>

                      {/* Three-dot actions */}
                      <td style={{ padding: '0.875rem 1.25rem' }}>
                        <div style={{ position: 'relative', display: 'inline-block' }}>
                          <button
                            onClick={e => { e.stopPropagation(); setOpenMenu(openMenu === buyer.id ? null : buyer.id) }}
                            disabled={!!busy}
                            aria-label="Row actions"
                            style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: openMenu === buyer.id ? 'var(--navy)' : 'var(--offwhite)', border: '1px solid var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem', color: openMenu === buyer.id ? 'white' : 'var(--navy)', fontWeight: 700, transition: 'all 0.15s' }}
                          >
                            {busy ? '…' : '⋮'}
                          </button>

                          {openMenu === buyer.id && (
                            <div ref={menuRef} style={{ position: 'absolute', top: '2.25rem', right: 0, zIndex: 100, background: 'white', borderRadius: '0.75rem', boxShadow: '0 4px 24px rgba(30,37,53,0.14)', border: '1px solid var(--border-light)', minWidth: '13rem', overflow: 'hidden' }}>

                              <Link
                                href={`/dashboard/admin/buyers/${buyer.id}`}
                                onClick={() => setOpenMenu(null)}
                                style={{ ...menuItemStyle, color: 'var(--navy)', textDecoration: 'none', display: 'flex' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--offwhite)')}
                                onMouseLeave={e => (e.currentTarget.style.background = '')}
                              >
                                <span style={{ width: '1.25rem', textAlign: 'center' }}>✏️</span> Edit Profile
                              </Link>

                              {isB2B && !verified && buyer.abn && (
                                <button
                                  onClick={() => doAction(buyer.id, 'verify_abn')}
                                  style={{ ...menuItemStyle, color: 'var(--sage-new)' }}
                                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--sage-soft)')}
                                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                                >
                                  <span style={{ width: '1.25rem', textAlign: 'center' }}>✓</span> Verify ABN
                                </button>
                              )}

                              {isB2B && verified && (
                                <button
                                  onClick={() => doAction(buyer.id, 'revoke_abn')}
                                  style={{ ...menuItemStyle, color: 'var(--bloom)' }}
                                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bloom-soft)')}
                                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                                >
                                  <span style={{ width: '1.25rem', textAlign: 'center' }}>✕</span> Revoke ABN
                                </button>
                              )}

                              {!isB2B && (
                                <button
                                  onClick={() => doAction(buyer.id, 'upgrade_to_b2b')}
                                  style={{ ...menuItemStyle, color: 'var(--navy)' }}
                                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--offwhite)')}
                                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                                >
                                  <span style={{ width: '1.25rem', textAlign: 'center' }}>↑</span> Upgrade to B2B
                                </button>
                              )}

                              {isB2B && (
                                <button
                                  onClick={() => doAction(buyer.id, 'downgrade_to_b2c')}
                                  style={{ ...menuItemStyle, color: 'var(--moss)' }}
                                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--offwhite)')}
                                  onMouseLeave={e => (e.currentTarget.style.background = '')}
                                >
                                  <span style={{ width: '1.25rem', textAlign: 'center' }}>↓</span> Downgrade to B2C
                                </button>
                              )}

                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
