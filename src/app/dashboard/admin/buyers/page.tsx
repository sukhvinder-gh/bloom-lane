'use client'
import { useState, useEffect } from 'react'
import { formatAEST } from '@/lib/utils/timezone'

export default function AdminBuyersPage() {
  const [buyers, setBuyers]     = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState('all')
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
      // Refresh the list
      const d = await fetch(`/api/admin/buyers?filter=${filter}`).then(r => r.json())
      setBuyers(d.data || [])
    }
    setActioning(null)
  }

  const pendingB2B = buyers.filter(b => b.role === 'buyer_b2b' && !b.abn_verified).length

  return (
    <div style={{ padding: '2.5rem', fontFamily: 'var(--font-body)' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--forest)', marginBottom: '0.25rem' }}>Buyers</h1>
          <p style={{ color: 'var(--forest)', opacity: 0.5, fontSize: '0.9rem' }}>
            {buyers.length} buyers · {pendingB2B > 0 && <span style={{ color: '#b45309', fontWeight: 700 }}>{pendingB2B} B2B pending ABN verification</span>}
          </p>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { key: 'all',     label: 'All' },
            { key: 'pending', label: '⏳ Pending ABN' },
            { key: 'verified',label: '✓ Verified B2B' },
            { key: 'b2c',     label: 'B2C Retail' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              style={{
                padding: '0.4rem 0.875rem', borderRadius: '99px', border: '1.5px solid',
                cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700,
                fontFamily: 'var(--font-body)', transition: 'all 0.15s',
                background: filter === f.key ? 'var(--forest)' : 'transparent',
                borderColor: filter === f.key ? 'var(--forest)' : 'var(--sage)',
                color: filter === f.key ? 'var(--cream)' : 'var(--forest)',
              }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Pending alert */}
      {pendingB2B > 0 && filter === 'all' && (
        <div style={{ background: '#fef9c3', border: '1px solid #fbbf24', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.25rem' }}>⚠️</span>
          <div>
            <p style={{ fontWeight: 700, color: '#92400e', fontSize: '0.875rem' }}>{pendingB2B} B2B {pendingB2B === 1 ? 'buyer needs' : 'buyers need'} ABN verification</p>
            <p style={{ color: '#92400e', fontSize: '0.8rem', opacity: 0.8 }}>Verify their ABN to unlock wholesale pricing access.</p>
          </div>
          <button onClick={() => setFilter('pending')}
            style={{ marginLeft: 'auto', background: '#92400e', color: 'white', padding: '0.4rem 1rem', borderRadius: '0.5rem', border: 'none', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)', flexShrink: 0 }}>
            Review now
          </button>
        </div>
      )}

      {/* Table */}
      <div style={{ background: 'white', borderRadius: 'var(--r-card)', overflow: 'hidden', border: '1px solid var(--olive)' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--forest)', opacity: 0.4 }}>Loading...</div>
        ) : buyers.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--forest)', opacity: 0.4 }}>No buyers found</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--cream)' }}>
                {['Name', 'Email', 'Type', 'ABN', 'ABN Status', 'Joined', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1.25rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--forest)', opacity: 0.6 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {buyers.map(buyer => {
                const isB2B = buyer.role === 'buyer_b2b'
                const abn_verified = buyer.abn_verified
                const busy = actioning?.startsWith(buyer.id)
                return (
                  <tr key={buyer.id} style={{ borderTop: '1px solid var(--olive)', background: isB2B && !abn_verified ? '#fffbeb' : 'white' }}>
                    <td style={{ padding: '0.875rem 1.25rem' }}>
                      <p style={{ fontWeight: 700, color: 'var(--forest)', fontSize: '0.875rem' }}>{buyer.full_name}</p>
                      {buyer.business_name && <p style={{ fontSize: '0.75rem', color: 'var(--forest)', opacity: 0.5 }}>{buyer.business_name}</p>}
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.8rem', color: 'var(--forest)', opacity: 0.7 }}>{buyer.email}</td>
                    <td style={{ padding: '0.875rem 1.25rem' }}>
                      <span style={{
                        padding: '0.2rem 0.625rem', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 700,
                        background: isB2B ? 'var(--olive)' : '#f1f5f9',
                        color: isB2B ? 'var(--forest)' : '#475569',
                        border: isB2B ? '1px solid var(--sage)' : 'none',
                      }}>
                        {isB2B ? 'B2B Wholesale' : 'B2C Retail'}
                      </span>
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.8rem', color: 'var(--forest)', fontFamily: 'monospace' }}>
                      {buyer.abn || <span style={{ opacity: 0.3 }}>—</span>}
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem' }}>
                      {!isB2B ? (
                        <span style={{ fontSize: '0.75rem', color: 'var(--forest)', opacity: 0.4 }}>N/A</span>
                      ) : abn_verified ? (
                        <span style={{ padding: '0.2rem 0.625rem', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 700, background: '#dcfce7', color: '#166534' }}>✓ Verified</span>
                      ) : (
                        <span style={{ padding: '0.2rem 0.625rem', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 700, background: '#fef9c3', color: '#854d0e' }}>⏳ Pending</span>
                      )}
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.75rem', color: 'var(--forest)', opacity: 0.5 }}>
                      {formatAEST(buyer.created_at, 'dd MMM yy')}
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem' }}>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {/* Verify ABN for B2B buyers */}
                        {isB2B && !abn_verified && buyer.abn && (
                          <button onClick={() => doAction(buyer.id, 'verify_abn')} disabled={!!busy}
                            style={{ padding: '0.3rem 0.75rem', background: 'var(--forest)', color: 'var(--cream)', border: 'none', borderRadius: '0.5rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                            {busy ? '...' : 'Verify ABN'}
                          </button>
                        )}
                        {/* Revoke verified ABN */}
                        {isB2B && abn_verified && (
                          <button onClick={() => doAction(buyer.id, 'revoke_abn')} disabled={!!busy}
                            style={{ padding: '0.3rem 0.75rem', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '0.5rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                            {busy ? '...' : 'Revoke'}
                          </button>
                        )}
                        {/* Upgrade B2C to B2B */}
                        {!isB2B && (
                          <button onClick={() => doAction(buyer.id, 'upgrade_to_b2b')} disabled={!!busy}
                            style={{ padding: '0.3rem 0.75rem', background: 'var(--olive)', color: 'var(--forest)', border: '1px solid var(--sage)', borderRadius: '0.5rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                            {busy ? '...' : '↑ B2B'}
                          </button>
                        )}
                        {/* Downgrade B2B to B2C */}
                        {isB2B && (
                          <button onClick={() => doAction(buyer.id, 'downgrade_to_b2c')} disabled={!!busy}
                            style={{ padding: '0.3rem 0.75rem', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '0.5rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                            {busy ? '...' : '↓ B2C'}
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
