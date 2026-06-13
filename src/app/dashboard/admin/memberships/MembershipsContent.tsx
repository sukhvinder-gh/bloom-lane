'use client'
import { useState, useEffect, useRef } from 'react'

type MemberRow = {
  id: string
  user_id: string
  name: string
  email: string
  plan: string
  billing_period: string | null
  status: string
  starts_at: string | null
  expires_at: string | null
  amount_cents: number | null
  created_at: string
}

const PLAN_LABELS: Record<string, string> = {
  hub_membership: 'Hub Membership',
  wholesale_collection: 'Wholesale Collection',
  mailing_list: 'Florist Mailing List',
  personal_shopper: 'Personal Shopper',
  coordinator: 'Coordinator',
}
const BILLING_LABELS: Record<string, string> = {
  weekly: 'Weekly', monthly: 'Monthly', seasonal: 'Seasonal', annual: 'Annual', free: 'Free',
}
const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  active:    { bg: 'var(--green-soft)',   color: 'var(--green)' },
  pending:   { bg: 'var(--amber-soft)',   color: 'var(--amber-new)' },
  expired:   { bg: 'var(--terra-soft)',   color: 'var(--terracotta)' },
  cancelled: { bg: 'var(--border-light)', color: 'var(--text-3)' },
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Australia/Sydney' })
}
function fmtPrice(cents: number | null) {
  if (cents == null) return '—'
  if (cents === 0) return 'Free'
  return `$${(cents / 100).toFixed(2)}`
}
function daysUntil(iso: string | null) {
  if (!iso) return null
  const diff = new Date(iso).getTime() - Date.now()
  return Math.ceil(diff / 86400000)
}

function exportCSV(rows: MemberRow[], type: 'grower' | 'florist') {
  const header = ['Name', 'Email', 'Plan', 'Billing', 'Amount', 'Status', 'Expires', 'Joined']
  const csvRows = rows.map(r => [
    `"${r.name}"`, `"${r.email}"`,
    `"${PLAN_LABELS[r.plan] ?? r.plan}"`,
    r.billing_period ? BILLING_LABELS[r.billing_period] ?? r.billing_period : '',
    r.amount_cents != null ? (r.amount_cents === 0 ? 'Free' : `$${(r.amount_cents / 100).toFixed(2)}`) : '',
    r.status, fmt(r.expires_at), fmt(r.created_at),
  ].join(','))
  const csv = [header.join(','), ...csvRows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `${type}_memberships_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  URL.revokeObjectURL(url)
}

function ActionsMenu({ row, onAction }: { row: MemberRow; onAction: (action: string) => void }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + window.scrollY + 4, right: window.innerWidth - r.right })
    }
    setOpen(o => !o)
  }

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) && btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        style={{ background: 'none', border: '1px solid var(--border-light)', borderRadius: '6px', cursor: 'pointer', padding: '0.3rem 0.6rem', fontSize: '1rem', color: 'var(--text-2)', lineHeight: 1 }}
        title="Actions"
      >
        ⋯
      </button>
      {open && (
        <div ref={menuRef} style={{ position: 'fixed', top: pos.top, right: pos.right, background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.14)', zIndex: 1000, minWidth: '190px', overflow: 'hidden' }}>
          <button onClick={() => { onAction('extend'); setOpen(false) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.75rem 1rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-1)', borderBottom: '1px solid var(--border-light)' }}>
            ⏱ Extend 30 days
          </button>
          <button onClick={() => { onAction('remind'); setOpen(false) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.75rem 1rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-1)', borderBottom: '1px solid var(--border-light)' }}>
            📧 Send reminder email
          </button>
          {row.status !== 'cancelled' && (
            <button onClick={() => { onAction('cancel'); setOpen(false) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.75rem 1rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--terracotta)' }}>
              ✕ Cancel membership
            </button>
          )}
        </div>
      )}
    </>
  )
}

export default function MembershipsContent() {
  const [tab, setTab] = useState<'grower' | 'florist'>('grower')
  const [rows, setRows] = useState<MemberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionState, setActionState] = useState<Record<string, { loading: boolean; msg: string }>>({})

  async function load(type: 'grower' | 'florist') {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/memberships?type=${type}`)
      const data = await res.json()
      setRows(data.rows ?? [])
    } catch { setRows([]) } finally { setLoading(false) }
  }

  useEffect(() => { load(tab) }, [tab])

  async function handleAction(rowId: string, action: string) {
    if (action === 'cancel' && !confirm('Cancel this membership? The grower will lose access.')) return

    setActionState(s => ({ ...s, [rowId]: { loading: true, msg: '' } }))
    try {
      let res: Response
      if (action === 'remind') {
        res = await fetch(`/api/admin/memberships/${rowId}/remind`, { method: 'POST' })
      } else {
        res = await fetch(`/api/admin/memberships/${rowId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, days: 30 }),
        })
      }
      const data = await res.json()
      if (res.ok) {
        const msg = action === 'extend' ? '✓ Extended 30 days' : action === 'cancel' ? '✓ Cancelled' : '✓ Reminder sent'
        setActionState(s => ({ ...s, [rowId]: { loading: false, msg } }))
        if (action !== 'remind') {
          setRows(prev => prev.map(r => r.id === rowId
            ? { ...r, status: data.subscription?.status ?? r.status, expires_at: data.subscription?.expires_at ?? r.expires_at }
            : r))
        }
        setTimeout(() => setActionState(s => ({ ...s, [rowId]: { loading: false, msg: '' } })), 3000)
      } else {
        setActionState(s => ({ ...s, [rowId]: { loading: false, msg: `⚠ ${data.error || 'Failed'}` } }))
        setTimeout(() => setActionState(s => ({ ...s, [rowId]: { loading: false, msg: '' } })), 4000)
      }
    } catch {
      setActionState(s => ({ ...s, [rowId]: { loading: false, msg: '⚠ Network error' } }))
      setTimeout(() => setActionState(s => ({ ...s, [rowId]: { loading: false, msg: '' } })), 4000)
    }
  }

  const filtered = rows.filter(r =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.email.toLowerCase().includes(search.toLowerCase())
  )
  const counts = {
    active:  rows.filter(r => r.status === 'active').length,
    pending: rows.filter(r => r.status === 'pending').length,
    expired: rows.filter(r => r.status === 'expired').length,
  }
  const activeRevenueCents = rows.filter(r => r.status === 'active').reduce((sum, r) => sum + (r.amount_cents ?? 0), 0)
  const expiringSoon = tab === 'grower'
    ? rows.filter(r => r.status === 'active' && r.expires_at && (daysUntil(r.expires_at) ?? 999) <= 7 && (daysUntil(r.expires_at) ?? -1) >= 0)
    : []

  return (
    <div style={{ padding: '2rem 2.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '0.25rem' }}>Memberships</h1>
        <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>All active and past membership subscriptions</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-light)', marginBottom: '1.5rem' }}>
        {(['grower', 'florist'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setSearch('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.625rem 1.25rem', fontSize: '0.9rem', fontWeight: tab === t ? 700 : 500, color: tab === t ? 'var(--navy)' : 'var(--text-3)', borderBottom: tab === t ? '2px solid var(--navy)' : '2px solid transparent', marginBottom: '-1px', transition: 'all 0.15s' }}>
            {t === 'grower' ? 'Growers' : 'Florists'}
          </button>
        ))}
      </div>

      {/* Expiry alert banner — growers only */}
      {tab === 'grower' && !loading && expiringSoon.length > 0 && (
        <div style={{ background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>⚠️</span>
          <div>
            <p style={{ color: '#92400E', fontWeight: 700, fontSize: '0.875rem', marginBottom: '0.375rem' }}>
              {expiringSoon.length} grower membership{expiringSoon.length !== 1 ? 's' : ''} expiring within 7 days
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {expiringSoon.map(r => {
                const d = daysUntil(r.expires_at)
                return (
                  <span key={r.id} style={{ background: 'rgba(146,64,14,0.1)', color: '#92400E', fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.625rem', borderRadius: '6px' }}>
                    {r.name} — {d === 0 ? 'today' : `${d}d`}
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: tab === 'grower' ? 'auto auto auto auto 1fr' : 'auto auto auto 1fr', gap: '0.75rem', marginBottom: '1.5rem', alignItems: 'center' }}>
        {[
          { label: 'Active',  count: counts.active,  color: 'var(--green)',      bg: 'var(--green-soft)' },
          { label: 'Pending', count: counts.pending, color: 'var(--amber-new)',  bg: 'var(--amber-soft)' },
          { label: 'Expired', count: counts.expired, color: 'var(--terracotta)', bg: 'var(--terra-soft)' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}33`, borderRadius: '10px', padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>{loading ? '—' : s.count}</span>
            <span style={{ fontSize: '0.8rem', color: s.color, fontWeight: 600 }}>{s.label}</span>
          </div>
        ))}
        {tab === 'grower' && (
          <div style={{ background: 'var(--bloom-soft)', border: '1px solid var(--bloom-mid)', borderRadius: '10px', padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: 'var(--navy)', lineHeight: 1 }}>
              {loading ? '—' : `$${(activeRevenueCents / 100).toFixed(0)}`}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--navy)', fontWeight: 600 }}>Active value</span>
          </div>
        )}
        {/* Search + Export */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <input type="search" placeholder="Search name or email…" value={search} onChange={e => setSearch(e.target.value)} style={{ padding: '0.625rem 1rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.875rem', color: 'var(--text-1)', background: 'var(--surface)', outline: 'none', width: '210px' }} />
          <button onClick={() => exportCSV(filtered, tab)} disabled={filtered.length === 0} style={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0.625rem 0.875rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            ↓ Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '4rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>{search ? 'No results.' : `No ${tab} memberships yet.`}</p>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-light)', background: 'var(--bg)' }}>
                {['Name / Business', 'Email', 'Plan', 'Billing', 'Amount', 'Status', 'Expires', ''].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1.25rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-3)', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const s = STATUS_STYLE[r.status] ?? STATUS_STYLE.cancelled
                const d = daysUntil(r.expires_at)
                const soonFlag = tab === 'grower' && r.status === 'active' && d != null && d <= 7 && d >= 0
                const aState = actionState[r.id]
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border-light)', background: soonFlag ? 'rgba(251,191,36,0.04)' : 'transparent' }}>
                    <td style={{ padding: '0.875rem 1.25rem', fontWeight: 600, color: 'var(--text-1)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {soonFlag && <span title="Expiring soon" style={{ fontSize: '0.75rem' }}>⚠️</span>}
                        {r.name}
                      </div>
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem', color: 'var(--text-3)', fontSize: '0.8rem' }}>{r.email}</td>
                    <td style={{ padding: '0.875rem 1.25rem' }}>
                      <span style={{ background: 'var(--bloom-soft)', color: 'var(--navy)', fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.625rem', borderRadius: '6px' }}>
                        {PLAN_LABELS[r.plan] ?? r.plan}
                      </span>
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem', color: 'var(--text-2)' }}>{r.billing_period ? BILLING_LABELS[r.billing_period] ?? r.billing_period : '—'}</td>
                    <td style={{ padding: '0.875rem 1.25rem', fontWeight: 600, color: 'var(--text-1)' }}>{fmtPrice(r.amount_cents)}</td>
                    <td style={{ padding: '0.875rem 1.25rem' }}>
                      <span style={{ background: s.bg, color: s.color, fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.625rem', borderRadius: '99px', textTransform: 'capitalize', display: 'inline-block' }}>{r.status}</span>
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem', color: soonFlag ? '#92400E' : 'var(--text-3)', fontSize: '0.8rem', fontWeight: soonFlag ? 700 : 400 }}>{fmt(r.expires_at)}</td>
                    <td style={{ padding: '0.875rem 1.25rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {aState?.loading ? (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>…</span>
                      ) : aState?.msg ? (
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: aState.msg.startsWith('✓') ? 'var(--green)' : 'var(--terracotta)' }}>{aState.msg}</span>
                      ) : tab === 'grower' ? (
                        <ActionsMenu row={r} onAction={action => handleAction(r.id, action)} />
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div style={{ padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border-light)', background: 'var(--bg)' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      )}
    </div>
  )
}
