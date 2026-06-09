'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { formatAEST } from '@/lib/utils/timezone'

type FilterVal = 'all' | 'pending_approval' | 'approved' | 'suspended'

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
  const rawFilter = searchParams.get('filter') || 'all'
  const normalise = (f: string): FilterVal => f === 'pending' ? 'pending_approval' : f as FilterVal

  const [farmers, setFarmers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterVal>(normalise(rawFilter))
  const [actioning, setActioning] = useState<string | null>(null)

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
  }

  const pendingCount = farmers.filter(f => f.status === 'pending_approval').length

  const TABS = [
    { value: 'all' as FilterVal,              label: 'All' },
    { value: 'pending_approval' as FilterVal, label: 'Pending' },
    { value: 'approved' as FilterVal,         label: 'Approved' },
    { value: 'suspended' as FilterVal,        label: 'Suspended' },
  ]

  return (
    <div className="page-pad" style={{ padding: '2.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="type-heading reveal" style={{ color: 'var(--navy)', marginBottom: '0.25rem' }}>Growers</h1>
          <p className="type-label" style={{ color: 'var(--moss)' }}>{farmers.length} registered · {pendingCount} awaiting approval</p>
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
      <div className="card reveal" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ padding: '1rem 1.25rem', borderTop: i > 0 ? '1px solid var(--border-light)' : undefined, display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ width: '10rem', height: '1rem', borderRadius: '0.5rem', background: 'var(--offwhite)' }} />
                <div style={{ width: '6rem', height: '1rem', borderRadius: '0.5rem', background: 'var(--offwhite)' }} />
              </div>
            ))}
          </div>
        ) : farmers.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center' }}>
            <p style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🌱</p>
            <p className="type-label" style={{ color: 'var(--moss)' }}>No growers found</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--offwhite)', borderBottom: '1px solid var(--border-light)' }}>
                {['Farm', 'ABN', 'Stripe', 'Commission', 'Status', 'Applied', 'Actions'].map(h => (
                  <th key={h} className="type-label-sm" style={{ padding: '0.875rem 1.25rem', textAlign: 'left', color: 'var(--moss)', letterSpacing: '0.15em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {farmers.map(farmer => (
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
                  <td style={{ padding: '0.875rem 1.25rem' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <Link href={`/dashboard/admin/farmers/${farmer.id}`} className="btn btn-ghost btn-sm">Edit</Link>
                      {farmer.status === 'pending_approval' && (
                        <button onClick={() => updateStatus(farmer.id, 'approved')} disabled={actioning === farmer.id} className="btn btn-forest btn-sm">
                          {actioning === farmer.id ? '…' : '✓ Approve'}
                        </button>
                      )}
                      {farmer.status === 'approved' && (
                        <button onClick={() => updateStatus(farmer.id, 'suspended')} disabled={actioning === farmer.id} className="btn btn-sm" style={{ background: 'var(--bloom-soft)', color: 'var(--bloom)', border: 'none' }}>
                          {actioning === farmer.id ? '…' : 'Suspend'}
                        </button>
                      )}
                      {farmer.status === 'suspended' && (
                        <button onClick={() => updateStatus(farmer.id, 'approved')} disabled={actioning === farmer.id} className="btn btn-outline btn-sm">
                          {actioning === farmer.id ? '…' : 'Reinstate'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
