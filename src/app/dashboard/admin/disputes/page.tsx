'use client'
import { useState, useEffect } from 'react'
import { formatPrice } from '@/lib/utils/pricing'
import { formatAEST } from '@/lib/utils/timezone'

type Filter = 'open' | 'resolved' | 'all'

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('open')
  const [resolving, setResolving] = useState<string | null>(null)
  const [noteMap, setNoteMap] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/admin/disputes').then(r => r.json()).then(d => {
      setDisputes(d.data || [])
      setLoading(false)
    })
  }, [])

  async function resolve(dispute: any, newOrderStatus: string) {
    setResolving(dispute.id)
    await fetch('/api/admin/disputes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dispute_id: dispute.id,
        order_id: dispute.order?.id,
        resolution_note: noteMap[dispute.id] || null,
        new_order_status: newOrderStatus,
      }),
    })
    setDisputes(ds => ds.map(d => d.id === dispute.id
      ? { ...d, resolved_at: new Date().toISOString(), resolution_note: noteMap[dispute.id] || null, order: { ...d.order, status: newOrderStatus } }
      : d
    ))
    setResolving(null)
  }

  const openCount     = disputes.filter(d => !d.resolved_at).length
  const resolvedCount = disputes.filter(d => !!d.resolved_at).length
  const filtered = disputes.filter(d =>
    filter === 'all' ? true : filter === 'open' ? !d.resolved_at : !!d.resolved_at
  )

  const TABS: { id: Filter; label: string }[] = [
    { id: 'open',     label: `Open (${openCount})` },
    { id: 'resolved', label: `Resolved (${resolvedCount})` },
    { id: 'all',      label: 'All' },
  ]

  return (
    <div style={{ padding: '2.5rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="type-heading reveal" style={{ color: 'var(--navy)', marginBottom: '0.25rem' }}>Disputes</h1>
        <p className="type-label" style={{ color: 'var(--moss)' }}>Review and resolve buyer disputes within the 6-hour window</p>
      </div>

      {/* Alert banner */}
      {openCount > 0 && (
        <div className="reveal" style={{ background: '#fce8ed', border: '1px solid rgba(232,93,122,0.25)', borderRadius: '1rem', padding: '1rem 1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '1.25rem' }}>🚨</span>
          <p style={{ fontWeight: 700, color: 'var(--bloom)', fontSize: '0.875rem', flex: 1 }}>
            {openCount} open {openCount === 1 ? 'dispute requires' : 'disputes require'} attention
          </p>
          <button onClick={() => setFilter('open')} className="btn btn-sm" style={{ background: 'var(--bloom)', color: 'white', border: 'none' }}>Review now</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.75rem' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setFilter(t.id)}
            className={`btn btn-sm ${filter === t.id ? 'btn-forest' : 'btn-ghost'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card" style={{ height: '10rem', background: 'var(--offwhite)' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card reveal" style={{ padding: '4rem', textAlign: 'center' }}>
          <p style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🎉</p>
          <p className="type-label" style={{ color: 'var(--moss)' }}>No {filter === 'all' ? '' : filter} disputes</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {filtered.map((dispute, i) => {
            const isOpen = !dispute.resolved_at
            return (
              <div key={dispute.id} className={`card reveal reveal-d${(i % 3) + 1}`} style={{ overflow: 'hidden', borderLeft: `3px solid ${isOpen ? 'var(--bloom)' : 'var(--sage-new)'}` }}>
                {/* Header */}
                <div style={{ padding: '1rem 1.5rem', background: 'var(--offwhite)', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.2rem' }}>
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
                        {dispute.order?.order_number}
                      </p>
                      <span className={`badge ${isOpen ? 'badge-red' : 'badge-sage'}`}>
                        {isOpen ? '🚨 Open' : '✓ Resolved'}
                      </span>
                    </div>
                    <p className="type-label-sm" style={{ color: 'var(--moss)' }}>
                      Raised by {dispute.raised_by_profile?.full_name || dispute.raised_by_profile?.email} · {formatAEST(dispute.created_at, 'dd MMM yyyy, h:mma')}
                    </p>
                  </div>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--navy)', letterSpacing: '-0.03em' }}>
                    {formatPrice(dispute.order?.total_cents)}
                  </span>
                </div>

                {/* Reason */}
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: filtered.length > 0 ? '1px solid var(--border-light)' : undefined }}>
                  <p className="type-label-sm" style={{ color: 'var(--moss)', marginBottom: '0.5rem' }}>Dispute Reason</p>
                  <p style={{ fontSize: '0.9rem', color: 'var(--navy)', lineHeight: 1.6 }}>{dispute.reason}</p>
                </div>

                {/* Resolved note */}
                {!isOpen && dispute.resolution_note && (
                  <div style={{ padding: '1rem 1.5rem', background: 'var(--sage-soft)', borderBottom: '1px solid var(--border-light)' }}>
                    <p className="type-label-sm" style={{ color: 'var(--sage-new)', marginBottom: '0.375rem' }}>Resolution Note</p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--navy)' }}>{dispute.resolution_note}</p>
                    <p className="type-label-sm" style={{ color: 'var(--moss)', marginTop: '0.375rem' }}>Resolved {formatAEST(dispute.resolved_at, 'dd MMM yyyy, h:mma')}</p>
                  </div>
                )}

                {/* Actions */}
                {isOpen && (
                  <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                    <div>
                      <label className="label">Resolution note (optional)</label>
                      <textarea
                        className="input"
                        placeholder="e.g. Confirmed with grower — partial refund issued for damaged stems"
                        rows={2}
                        value={noteMap[dispute.id] || ''}
                        onChange={e => setNoteMap(m => ({ ...m, [dispute.id]: e.target.value }))}
                        style={{ resize: 'vertical' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <button className="btn btn-forest btn-sm" disabled={resolving === dispute.id} onClick={() => resolve(dispute, 'resolved')}>
                        {resolving === dispute.id ? '…' : '✓ Mark Resolved'}
                      </button>
                      <button className="btn btn-ghost btn-sm" disabled={resolving === dispute.id} onClick={() => resolve(dispute, 'refunded')}>
                        {resolving === dispute.id ? '…' : '↩ Mark Refunded'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
