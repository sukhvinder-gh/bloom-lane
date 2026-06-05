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

  const filtered = disputes.filter(d =>
    filter === 'all' ? true : filter === 'open' ? !d.resolved_at : !!d.resolved_at
  )

  const openCount = disputes.filter(d => !d.resolved_at).length

  const TABS: { id: Filter; label: string }[] = [
    { id: 'open', label: `Open (${openCount})` },
    { id: 'resolved', label: 'Resolved' },
    { id: 'all', label: 'All' },
  ]

  return (
    <div style={{ padding: '2.5rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="type-heading reveal" style={{ color: 'var(--forest)', marginBottom: '0.25rem' }}>Disputes</h1>
        <p className="type-label" style={{ color: 'var(--moss)' }}>Review and resolve buyer disputes within the 6-hour window</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.75rem' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setFilter(t.id)}
            className={`btn btn-sm ${filter === t.id ? 'btn-forest' : 'btn-outline'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="card" style={{ height: '8rem', background: 'var(--olive)' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
          <p style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🎉</p>
          <p className="type-label" style={{ color: 'var(--forest)' }}>No {filter === 'all' ? '' : filter} disputes</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {filtered.map(dispute => {
            const isOpen = !dispute.resolved_at
            return (
              <div key={dispute.id} className="card reveal" style={{ overflow: 'hidden', borderLeft: `4px solid ${isOpen ? 'var(--red, #ef4444)' : 'var(--sage)'}` }}>
                {/* Header */}
                <div style={{ padding: '1rem 1.75rem', background: 'var(--olive)', borderBottom: '1px solid var(--sage)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--forest)', textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
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
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--forest)', letterSpacing: '-0.03em' }}>
                    {formatPrice(dispute.order?.total_cents)}
                  </span>
                </div>

                {/* Reason */}
                <div style={{ padding: '1.25rem 1.75rem', borderBottom: '1px solid var(--olive)' }}>
                  <p className="type-label-sm" style={{ color: 'var(--moss)', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Dispute reason</p>
                  <p style={{ fontSize: '0.9rem', color: 'var(--forest)', lineHeight: 1.6 }}>{dispute.reason}</p>
                </div>

                {/* Resolution note (if resolved) */}
                {!isOpen && dispute.resolution_note && (
                  <div style={{ padding: '1rem 1.75rem', borderBottom: '1px solid var(--olive)', background: '#f0fdf4' }}>
                    <p className="type-label-sm" style={{ color: 'var(--moss)', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Resolution note</p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--forest)' }}>{dispute.resolution_note}</p>
                    <p className="type-label-sm" style={{ color: 'var(--moss)', marginTop: '0.25rem' }}>Resolved {formatAEST(dispute.resolved_at, 'dd MMM yyyy, h:mma')}</p>
                  </div>
                )}

                {/* Actions (only for open disputes) */}
                {isOpen && (
                  <div style={{ padding: '1.25rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
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
                      <button
                        className="btn btn-forest btn-sm"
                        disabled={resolving === dispute.id}
                        onClick={() => resolve(dispute, 'resolved')}
                      >
                        {resolving === dispute.id ? '…' : '✓ Mark Resolved'}
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        disabled={resolving === dispute.id}
                        onClick={() => resolve(dispute, 'refunded')}
                      >
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
