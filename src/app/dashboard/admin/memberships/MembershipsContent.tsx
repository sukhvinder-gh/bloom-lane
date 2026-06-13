'use client'
import { useState, useEffect } from 'react'

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
  weekly: 'Weekly', monthly: 'Monthly', seasonal: 'Seasonal',
  annual: 'Annual', free: 'Free',
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  active:    { bg: 'var(--green-soft)',  color: 'var(--green)' },
  pending:   { bg: 'var(--amber-soft)',  color: 'var(--amber-new)' },
  expired:   { bg: 'var(--terra-soft)',  color: 'var(--terracotta)' },
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

export default function MembershipsContent() {
  const [tab, setTab] = useState<'grower' | 'florist'>('grower')
  const [rows, setRows] = useState<MemberRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  async function load(type: 'grower' | 'florist') {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/memberships?type=${type}`)
      const data = await res.json()
      setRows(data.rows ?? [])
    } catch { setRows([]) } finally { setLoading(false) }
  }

  useEffect(() => { load(tab) }, [tab])

  const filtered = rows.filter(r =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.email.toLowerCase().includes(search.toLowerCase())
  )

  const counts = {
    active:  rows.filter(r => r.status === 'active').length,
    pending: rows.filter(r => r.status === 'pending').length,
    expired: rows.filter(r => r.status === 'expired').length,
  }

  return (
    <div style={{ padding: '2rem 2.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 700, color: 'var(--navy)', marginBottom: '0.25rem' }}>Memberships</h1>
        <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>All active and past membership subscriptions</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0' }}>
        {(['grower', 'florist'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setSearch('') }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '0.625rem 1.25rem',
              fontSize: '0.9rem', fontWeight: tab === t ? 700 : 500,
              color: tab === t ? 'var(--navy)' : 'var(--text-3)',
              borderBottom: tab === t ? '2px solid var(--navy)' : '2px solid transparent',
              marginBottom: '-1px', transition: 'all 0.15s',
            }}
          >
            {t === 'grower' ? 'Growers' : 'Florists'}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, auto) 1fr', gap: '0.75rem', marginBottom: '1.5rem', alignItems: 'start' }}>
        {[
          { label: 'Active', count: counts.active, color: 'var(--green)', bg: 'var(--green-soft)' },
          { label: 'Pending', count: counts.pending, color: 'var(--amber-new)', bg: 'var(--amber-soft)' },
          { label: 'Expired', count: counts.expired, color: 'var(--terracotta)', bg: 'var(--terra-soft)' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}22`, borderRadius: '10px', padding: '0.875rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, color: s.color, lineHeight: 1 }}>{loading ? '—' : s.count}</span>
            <span style={{ fontSize: '0.8rem', color: s.color, fontWeight: 600 }}>{s.label}</span>
          </div>
        ))}
        {/* Search */}
        <div style={{ marginLeft: 'auto' }}>
          <input
            type="search"
            placeholder="Search name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ padding: '0.625rem 1rem', borderRadius: '8px', border: '1px solid var(--border-light)', fontSize: '0.875rem', color: 'var(--text-1)', background: 'var(--surface)', outline: 'none', width: '240px' }}
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>Loading…</p>
      ) : filtered.length === 0 ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '4rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-3)', fontSize: '0.875rem' }}>{search ? 'No results for that search.' : `No ${tab} memberships yet.`}</p>
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: '12px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-light)', background: 'var(--bg)' }}>
                {(tab === 'grower'
                  ? ['Name / Business', 'Email', 'Plan', 'Billing', 'Amount', 'Status', 'Expires']
                  : ['Name', 'Email', 'Plan', 'Billing', 'Amount', 'Status', 'Joined']
                ).map(h => (
                  <th key={h} style={{ padding: '0.75rem 1.25rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-3)', textTransform: 'uppercase' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const s = STATUS_STYLE[r.status] ?? STATUS_STYLE.cancelled
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '0.875rem 1.25rem', fontWeight: 600, color: 'var(--text-1)' }}>{r.name}</td>
                    <td style={{ padding: '0.875rem 1.25rem', color: 'var(--text-3)', fontSize: '0.8rem' }}>{r.email}</td>
                    <td style={{ padding: '0.875rem 1.25rem' }}>
                      <span style={{ background: 'var(--bloom-soft)', color: 'var(--navy)', fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.625rem', borderRadius: '6px' }}>
                        {PLAN_LABELS[r.plan] ?? r.plan}
                      </span>
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem', color: 'var(--text-2)' }}>
                      {r.billing_period ? BILLING_LABELS[r.billing_period] ?? r.billing_period : '—'}
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem', fontWeight: 600, color: 'var(--text-1)' }}>
                      {fmtPrice(r.amount_cents)}
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem' }}>
                      <span style={{ background: s.bg, color: s.color, fontSize: '0.72rem', fontWeight: 700, padding: '0.2rem 0.625rem', borderRadius: '99px', textTransform: 'capitalize', display: 'inline-block' }}>
                        {r.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.875rem 1.25rem', color: 'var(--text-3)', fontSize: '0.8rem' }}>
                      {tab === 'grower' ? fmt(r.expires_at) : fmt(r.created_at)}
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
