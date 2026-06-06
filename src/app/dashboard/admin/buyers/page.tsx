'use client'
import { useState, useEffect } from 'react'
import { formatAEST } from '@/lib/utils/timezone'

type FilterKey = 'all' | 'pending' | 'verified' | 'b2c'

export default function AdminBuyersPage() {
  const [buyers, setBuyers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [actioning, setActioning] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/admin/buyers?filter=${filter}`)
      .then(r => r.json())
      .then(d => { setBuyers(d.data || []); setLoading(false) })
  }, [filter])

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
  }

  const b2bCount  = buyers.filter(b => b.role === 'buyer_b2b').length
  const b2cCount  = buyers.filter(b => b.role !== 'buyer_b2b').length
  const pendingB2B = buyers.filter(b => b.role === 'buyer_b2b' && !b.abn_verified).length

  const TABS: { key: FilterKey; label: string }[] = [
    { key: 'all',     label: 'All' },
    { key: 'pending', label: '⏳ Pending ABN' },
    { key: 'verified',label: '✓ Verified B2B' },
    { key: 'b2c',     label: 'B2C Retail' },
  ]

  return (
    <div className="page-pad" style={{ padding: '2.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="type-heading reveal" style={{ color: 'var(--navy)', marginBottom: '0.25rem' }}>Buyers</h1>
          <p className="type-label" style={{ color: 'var(--moss)' }}>{buyers.length} total · {b2bCount} B2B wholesale · {b2cCount} B2C retail</p>
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
      <div className="card reveal" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ padding: '1rem 1.25rem', borderTop: i > 0 ? '1px solid var(--border-light)' : undefined, display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{ width: '8rem', height: '1rem', borderRadius: '0.5rem', background: 'var(--offwhite)' }} />
                <div style={{ width: '12rem', height: '1rem', borderRadius: '0.5rem', background: 'var(--offwhite)' }} />
              </div>
            ))}
          </div>
        ) : buyers.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center' }}>
            <p style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🛒</p>
            <p className="type-label" style={{ color: 'var(--moss)' }}>No buyers found</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--offwhite)', borderBottom: '1px solid var(--border-light)' }}>
                {['Buyer', 'Email', 'Type', 'ABN', 'ABN Status', 'Joined', 'Actions'].map(h => (
                  <th key={h} className="type-label-sm" style={{ padding: '0.875rem 1.25rem', textAlign: 'left', color: 'var(--moss)', letterSpacing: '0.15em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {buyers.map(buyer => {
                const isB2B = buyer.role === 'buyer_b2b'
                const verified = buyer.abn_verified
                const busy = actioning?.startsWith(buyer.id)
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
                    <td style={{ padding: '0.875rem 1.25rem' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {isB2B && !verified && buyer.abn && (
                          <button onClick={() => doAction(buyer.id, 'verify_abn')} disabled={!!busy} className="btn btn-forest btn-sm">
                            {busy ? '…' : '✓ Verify ABN'}
                          </button>
                        )}
                        {isB2B && verified && (
                          <button onClick={() => doAction(buyer.id, 'revoke_abn')} disabled={!!busy} className="btn btn-sm" style={{ background: 'var(--bloom-soft)', color: 'var(--bloom)', border: 'none' }}>
                            {busy ? '…' : 'Revoke'}
                          </button>
                        )}
                        {!isB2B && (
                          <button onClick={() => doAction(buyer.id, 'upgrade_to_b2b')} disabled={!!busy} className="btn btn-outline btn-sm">
                            {busy ? '…' : '↑ Upgrade B2B'}
                          </button>
                        )}
                        {isB2B && (
                          <button onClick={() => doAction(buyer.id, 'downgrade_to_b2c')} disabled={!!busy} className="btn btn-ghost btn-sm">
                            {busy ? '…' : '↓ B2C'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
