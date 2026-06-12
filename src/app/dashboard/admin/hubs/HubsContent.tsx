'use client'
import { useState } from 'react'
import { formatAEST } from '@/lib/utils/timezone'

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending:  { bg: '#FEF3C7', color: '#92400E' },
  active:   { bg: '#D1FAE5', color: '#065F46' },
  inactive: { bg: '#F1EFE8', color: '#5F5E5A' },
}

export default function HubsContent({ initialHubs }: { initialHubs: any[] }) {
  const [hubs, setHubs]       = useState<any[]>(initialHubs)
  const [updating, setUpdating] = useState<string | null>(null)

  async function setStatus(id: string, status: 'active' | 'inactive' | 'pending') {
    setUpdating(id)
    const res = await fetch('/api/admin/hubs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    if (res.ok) setHubs(hs => hs.map(h => h.id === id ? { ...h, status } : h))
    setUpdating(null)
  }

  const pending  = hubs.filter(h => h.status === 'pending')
  const active   = hubs.filter(h => h.status === 'active')
  const inactive = hubs.filter(h => h.status === 'inactive')

  return (
    <div className="page-pad" style={{ padding: '2.5rem' }}>
      <h1 className="type-heading reveal" style={{ color: 'var(--forest)', marginBottom: '0.25rem' }}>Hubs & Groups</h1>
      <p className="type-label" style={{ color: 'var(--moss)', marginBottom: '2rem' }}>{hubs.length} hub{hubs.length !== 1 ? 's' : ''} registered</p>

      {pending.length > 0 && (
        <div style={{ padding: '1rem 1.5rem', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
          <span style={{ fontSize: '1.25rem' }}>⏳</span>
          <div>
            <p style={{ fontWeight: 700, color: '#92400E', fontSize: '0.875rem', marginBottom: '0.25rem' }}>{pending.length} hub{pending.length > 1 ? 's' : ''} awaiting approval</p>
            <p style={{ fontSize: '0.8rem', color: '#92400E', opacity: 0.8 }}>Review and activate below to allow growers to join.</p>
          </div>
        </div>
      )}

      <div className="card reveal" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: 'var(--olive)', borderBottom: '1px solid var(--sage)' }}>
              {['Hub / Group', 'Region', 'Coordinator', 'Registered', 'Status', 'Actions'].map(h => (
                <th key={h} className="type-label-sm" style={{ padding: '1rem 1.25rem', textAlign: 'left', color: 'var(--moss)', letterSpacing: '0.15em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hubs.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--moss)', opacity: 0.5 }}>No hubs registered yet</td></tr>
            ) : hubs.map(hub => {
              const st = STATUS_STYLE[hub.status] || STATUS_STYLE.inactive
              return (
                <tr key={hub.id} className="table-row">
                  <td style={{ padding: '0.875rem 1.25rem' }}>
                    <p style={{ fontWeight: 700, color: 'var(--forest)' }}>{hub.name}</p>
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem', color: 'var(--moss)' }}>{hub.region || '—'}</td>
                  <td style={{ padding: '0.875rem 1.25rem' }}>
                    <p style={{ fontWeight: 600, color: 'var(--forest)', fontSize: '0.85rem' }}>{hub.profiles?.full_name || '—'}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--moss)' }}>{hub.profiles?.email || ''}</p>
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.8rem', color: 'var(--moss)', whiteSpace: 'nowrap' }}>
                    {formatAEST(hub.created_at, 'dd MMM yyyy')}
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem' }}>
                    <span style={{ padding: '3px 10px', borderRadius: '99px', fontSize: '0.7rem', fontWeight: 700, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
                      {hub.status.charAt(0).toUpperCase() + hub.status.slice(1)}
                    </span>
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {hub.status !== 'active' && (
                        <button
                          onClick={() => setStatus(hub.id, 'active')}
                          disabled={updating === hub.id}
                          className="btn btn-sm btn-forest"
                          style={{ fontSize: '0.75rem' }}
                        >
                          {updating === hub.id ? '…' : 'Activate'}
                        </button>
                      )}
                      {hub.status === 'active' && (
                        <button
                          onClick={() => setStatus(hub.id, 'inactive')}
                          disabled={updating === hub.id}
                          className="btn btn-sm btn-ghost"
                          style={{ fontSize: '0.75rem', color: 'var(--bloom)' }}
                        >
                          {updating === hub.id ? '…' : 'Deactivate'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
