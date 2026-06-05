'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { formatAEST } from '@/lib/utils/timezone'

export default function FarmersContent() {
  const searchParams = useSearchParams()

  // Map URL param 'pending' → DB value 'pending_approval'
  const rawFilter = searchParams.get('filter') || 'all'
  const normaliseFilter = (f: string) => f === 'pending' ? 'pending_approval' : f

  const [farmers, setFarmers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState(normaliseFilter(rawFilter))
  const [actioning, setActioning] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    const param = filter === 'all' ? '' : filter

    fetch(`/api/admin/farmers${param ? `?filter=${param}` : ''}`)
  .then(r => {
    console.log('STATUS:', r.status, 'URL:', r.url)
    return r.text() // use text() not json() so we see raw response
  })
  .then(text => {
    console.log('RAW RESPONSE TEXT:', text)
    try {
      const d = JSON.parse(text)
      setFarmers(Array.isArray(d) ? d : d.data || [])
    } catch(e) {
      console.log('JSON PARSE ERROR:', e)
    }
    setLoading(false)
  })
  .catch((err) => { console.log('FETCH ERROR:', err); setLoading(false) })
  }, [filter])

  async function updateStatus(id: string, status: 'approved' | 'suspended') {
    setActioning(id)
    await fetch(`/api/admin/farmers`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ farmerId: id, status })
    })
    setFarmers(fs => fs.map(f => f.id === id ? { ...f, status } : f))
    setActioning(null)
  }

  const statusBadge: Record<string, React.CSSProperties> = {
    pending_approval: { background: '#fef9c3', color: '#854d0e' },
    approved:         { background: '#dcfce7', color: '#166534' },
    suspended:        { background: '#fee2e2', color: '#991b1b' },
  }

  return (
    <div style={{ padding: '2.5rem', fontFamily: 'var(--font-body)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--forest)', marginBottom: '0.25rem' }}>Growers</h1>
          <p style={{ color: 'var(--forest)', opacity: 0.5, fontSize: '0.9rem' }}>{farmers.length} farmers</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {[
            { value: 'all',              label: 'All' },
            { value: 'pending_approval', label: 'Pending' },
            { value: 'approved',         label: 'Approved' },
            { value: 'suspended',        label: 'Suspended' },
          ].map(f => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              style={{ padding: '0.4rem 0.875rem', borderRadius: '99px', border: '1.5px solid', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, fontFamily: 'var(--font-body)', transition: 'all 0.15s',
                background: filter === f.value ? 'var(--forest)' : 'transparent',
                borderColor: filter === f.value ? 'var(--forest)' : 'var(--sage)',
                color: filter === f.value ? 'var(--cream)' : 'var(--forest)',
              }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 'var(--r-card)', overflow: 'hidden', border: '1px solid var(--olive)' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--forest)', opacity: 0.4 }}>Loading...</div>
        ) : farmers.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--forest)', opacity: 0.4 }}>No farmers found</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--cream)' }}>
                {['Farm', 'ABN', 'Stripe', 'Commission', 'Status', 'Applied', 'Actions'].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1.25rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--forest)', opacity: 0.6 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {farmers.map(farmer => (
                <tr key={farmer.id} style={{ borderTop: '1px solid var(--olive)' }}>
                  <td style={{ padding: '0.875rem 1.25rem' }}>
                    <p style={{ fontWeight: 700, color: 'var(--forest)', fontSize: '0.875rem' }}>{farmer.business_name}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--forest)', opacity: 0.5 }}>{farmer.profiles?.email}</p>
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.8rem', color: 'var(--forest)' }}>
                    <span>{farmer.abn}</span>
                    <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', color: farmer.abn_verified ? '#166534' : '#854d0e' }}>
                      {farmer.abn_verified ? '✓' : '⏳'}
                    </span>
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.8rem' }}>
                    <span style={{ color: farmer.stripe_onboarding_complete ? '#166534' : '#854d0e', fontWeight: 700 }}>
                      {farmer.stripe_onboarding_complete ? '✓ Connected' : '⏳ Pending'}
                    </span>
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.8rem', color: 'var(--forest)' }}>
                    {Math.round(farmer.commission_rate * 100)}%
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem' }}>
                    <span style={{ padding: '0.2rem 0.625rem', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 700, ...statusBadge[farmer.status] }}>
                      {farmer.status === 'pending_approval' ? 'Pending' : farmer.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.75rem', color: 'var(--forest)', opacity: 0.5 }}>
                    {formatAEST(farmer.created_at, 'dd MMM yy')}
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {farmer.status === 'pending_approval' && (
                        <button onClick={() => updateStatus(farmer.id, 'approved')} disabled={actioning === farmer.id}
                          style={{ padding: '0.3rem 0.75rem', background: 'var(--forest)', color: 'var(--cream)', border: 'none', borderRadius: '0.5rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                          {actioning === farmer.id ? '...' : 'Approve'}
                        </button>
                      )}
                      {farmer.status === 'approved' && (
                        <button onClick={() => updateStatus(farmer.id, 'suspended')} disabled={actioning === farmer.id}
                          style={{ padding: '0.3rem 0.75rem', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '0.5rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                          {actioning === farmer.id ? '...' : 'Suspend'}
                        </button>
                      )}
                      {farmer.status === 'suspended' && (
                        <button onClick={() => updateStatus(farmer.id, 'approved')} disabled={actioning === farmer.id}
                          style={{ padding: '0.3rem 0.75rem', background: '#dcfce7', color: '#166534', border: 'none', borderRadius: '0.5rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}>
                          {actioning === farmer.id ? '...' : 'Reinstate'}
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