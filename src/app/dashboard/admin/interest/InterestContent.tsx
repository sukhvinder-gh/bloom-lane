'use client'
import { useState } from 'react'
import { formatAEST } from '@/lib/utils/timezone'

type Row = {
  id: string
  role: 'grower' | 'buyer'
  full_name: string
  email: string
  phone: string | null
  business_name: string | null
  region: string | null
  notes: string | null
  contacted: boolean
  created_at: string
}

type Tab = 'all' | 'grower' | 'buyer'

function exportCSV(rows: Row[]) {
  const header = ['Role', 'Name', 'Email', 'Phone', 'Business/Farm', 'Region', 'Notes', 'Submitted', 'Contacted']
  const csvRows = rows.map(r => [
    r.role, r.full_name, r.email, r.phone || '', r.business_name || '', r.region || '',
    (r.notes || '').replace(/\n/g, ' '), r.created_at, r.contacted ? 'Yes' : 'No',
  ].map(v => `"${String(v).replace(/"/g, '""')}"`))
  const csv = [header.join(','), ...csvRows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = `interest_registrations_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  URL.revokeObjectURL(url)
}

export default function InterestContent({ initialInterest }: { initialInterest: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initialInterest)
  const [tab, setTab] = useState<Tab>('all')
  const [search, setSearch] = useState('')
  const [updating, setUpdating] = useState<string | null>(null)

  const growerCount = rows.filter(r => r.role === 'grower').length
  const buyerCount = rows.filter(r => r.role === 'buyer').length
  const newCount = rows.filter(r => !r.contacted).length

  const filtered = rows
    .filter(r => tab === 'all' || r.role === tab)
    .filter(r => {
      if (!search) return true
      const q = search.toLowerCase()
      return r.full_name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) ||
        (r.business_name || '').toLowerCase().includes(q) || (r.region || '').toLowerCase().includes(q)
    })

  async function toggleContacted(row: Row) {
    setUpdating(row.id)
    const res = await fetch(`/api/admin/interest/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contacted: !row.contacted }),
    })
    if (res.ok) {
      setRows(rs => rs.map(r => r.id === row.id ? { ...r, contacted: !r.contacted } : r))
    }
    setUpdating(null)
  }

  return (
    <div className="page-pad" style={{ padding: '2.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '0.5rem' }}>
        <div>
          <h1 className="type-heading" style={{ color: 'var(--navy)' }}>Register Interest</h1>
          <p className="type-label" style={{ color: 'var(--moss)' }}>
            People who registered interest as a grower or buyer while public sign-up is paused
          </p>
        </div>
        <button onClick={() => exportCSV(filtered)} disabled={filtered.length === 0} style={{ background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0.625rem 0.875rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          ↓ Export CSV
        </button>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', margin: '1.5rem 0', flexWrap: 'wrap' }}>
        <div><span style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--navy)' }}>{rows.length}</span> <span className="type-label-sm" style={{ color: 'var(--moss)' }}>Total</span></div>
        <div><span style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--navy)' }}>{growerCount}</span> <span className="type-label-sm" style={{ color: 'var(--moss)' }}>Growers</span></div>
        <div><span style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--navy)' }}>{buyerCount}</span> <span className="type-label-sm" style={{ color: 'var(--moss)' }}>Buyers</span></div>
        <div><span style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--amber-new)' }}>{newCount}</span> <span className="type-label-sm" style={{ color: 'var(--moss)' }}>Not yet contacted</span></div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {(['all', 'grower', 'buyer'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding: '0.5rem 1rem', borderRadius: '99px', border: 'none', cursor: 'pointer',
              fontSize: '0.8rem', fontWeight: 700, textTransform: 'capitalize',
              background: tab === t ? 'var(--navy)' : 'var(--surface)',
              color: tab === t ? 'white' : 'var(--text-2)',
            }}>
            {t}
          </button>
        ))}
        <input
          className="input" placeholder="Search name, email, business, region…"
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ marginLeft: 'auto', maxWidth: '20rem', width: '100%' }}
        />
      </div>

      <div className="card reveal" style={{ overflow: 'hidden' }}>
        <div className="table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--offwhite)', borderBottom: '1px solid var(--border-light)' }}>
                {['Role', 'Name', 'Contact', 'Business / Region', 'Notes', 'Submitted', 'Contacted'].map(h => (
                  <th key={h} className="type-label-sm" style={{ padding: '0.875rem 1.25rem', textAlign: 'left', color: 'var(--moss)', letterSpacing: '0.15em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '4rem', textAlign: 'center' }}>
                  <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</p>
                  <p className="type-label" style={{ color: 'var(--moss)' }}>No interest registrations{tab !== 'all' ? ` from ${tab}s` : ''} yet</p>
                </td></tr>
              ) : filtered.map(row => (
                <tr key={row.id} className="table-row">
                  <td style={{ padding: '0.875rem 1.25rem' }}>
                    <span className={row.role === 'grower' ? 'badge badge-sage' : 'badge badge-olive'}>{row.role}</span>
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem', fontWeight: 700, color: 'var(--navy)' }}>{row.full_name}</td>
                  <td style={{ padding: '0.875rem 1.25rem' }}>
                    <p style={{ color: 'var(--navy)', fontSize: '0.85rem' }}><a href={`mailto:${row.email}`} style={{ color: 'inherit' }}>{row.email}</a></p>
                    {row.phone && <p className="type-label-sm" style={{ color: 'var(--moss)' }}>{row.phone}</p>}
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem' }}>
                    <p style={{ color: 'var(--navy)', fontSize: '0.85rem' }}>{row.business_name || '—'}</p>
                    {row.region && <p className="type-label-sm" style={{ color: 'var(--moss)' }}>{row.region}</p>}
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem', color: 'var(--moss)', fontSize: '0.8rem', maxWidth: '16rem' }}>{row.notes || '—'}</td>
                  <td style={{ padding: '0.875rem 1.25rem', color: 'var(--moss)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{formatAEST(row.created_at, 'dd MMM yyyy')}</td>
                  <td style={{ padding: '0.875rem 1.25rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={row.contacted} disabled={updating === row.id} onChange={() => toggleContacted(row)} />
                      <span className="type-label-sm" style={{ color: 'var(--moss)' }}>{row.contacted ? 'Yes' : 'No'}</span>
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
