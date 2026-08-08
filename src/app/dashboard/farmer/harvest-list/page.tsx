'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { PrintButton } from '@/components/PrintButton'
import { AUDateInput } from '@/components/AUDateInput'

function fmtShort(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

type Row = {
  key: string; name: string; unit: string; category: string; qty: number
  order_count: number; item_ids: string[]; notes: string[]
  fully_harvested: boolean; any_harvested: boolean; overdue: boolean
}

function RowCheckbox({ row, busy, onToggle }: { row: Row; busy: boolean; onToggle: () => void }) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !row.fully_harvested && row.any_harvested
  }, [row.fully_harvested, row.any_harvested])
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={row.fully_harvested}
      onChange={onToggle}
      disabled={busy}
      aria-label={`Mark ${row.name} as harvested`}
      style={{ width: '1.5rem', height: '1.5rem', accentColor: 'var(--forest)', cursor: busy ? 'wait' : 'pointer' }}
    />
  )
}

export default function HarvestListPage() {
  const [mode, setMode] = useState<'range' | 'day'>('range')
  // Left null until the server tells us what "this week" actually means —
  // it computes Monday in Sydney time, which the client shouldn't have to
  // (and can't reliably, since the browser's local timezone isn't
  // guaranteed to be Australia/Sydney).
  const [from, setFrom] = useState<string | null>(null)
  const [to, setTo] = useState<string | null>(null)
  const [data, setData] = useState<{ rows: Row[]; order_count: number; unscheduled_order_count: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set())

  async function load(f?: string | null, t?: string | null) {
    setLoading(true)
    const qs = f && t ? `?from=${f}&to=${t}` : ''
    try {
      const res = await fetch(`/api/farmer/harvest-list${qs}`)
      const json = await res.json()
      setData(json.data)
      setFrom(json.data.from)
      setTo(json.data.to)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function resetToThisWeek() {
    setMode('range')
    load()
  }

  async function toggleRow(row: Row) {
    const nextHarvested = !row.fully_harvested
    setBusyKeys(s => new Set(s).add(row.key))
    setData(d => d ? { ...d, rows: d.rows.map(r => r.key === row.key ? { ...r, fully_harvested: nextHarvested, any_harvested: nextHarvested, overdue: nextHarvested ? false : r.overdue } : r) } : d)
    const res = await fetch('/api/farmer/harvest-list', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_ids: row.item_ids, harvested: nextHarvested }),
    })
    if (!res.ok) load(from, to)
    setBusyKeys(s => { const n = new Set(s); n.delete(row.key); return n })
  }

  const rows = data?.rows || []

  return (
    <div className="page-pad" style={{ padding: '2.5rem', maxWidth: '900px', margin: '0 auto' }}>
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <Link href="/dashboard/farmer/orders" className="btn btn-ghost btn-sm">← Orders</Link>
        <span style={{ flex: 1 }} />
        <Link href="/dashboard/farmer/pack-list" className="btn btn-outline btn-sm">📦 Pack List</Link>
        <PrintButton label="Print" />
      </div>

      {/* Date filter */}
      <div className="no-print card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {(['range', 'day'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{ padding: '0.4rem 0.9rem', borderRadius: '99px', border: '1.5px solid var(--olive)', background: mode === m ? 'var(--forest)' : 'white', color: mode === m ? 'white' : 'var(--forest)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, fontFamily: 'var(--font-body)' }}
            >
              {m === 'range' ? 'Date range' : 'Single date'}
            </button>
          ))}
        </div>
        {mode === 'range' ? (
          <>
            <div><label className="label">From</label><AUDateInput className="input" value={from ?? ''} onChange={v => load(v, to)} ariaLabel="From date" /></div>
            <div><label className="label">To</label><AUDateInput className="input" value={to ?? ''} onChange={v => load(from, v)} ariaLabel="To date" /></div>
          </>
        ) : (
          <div><label className="label">Date</label><AUDateInput className="input" value={from ?? ''} onChange={v => load(v, v)} ariaLabel="Date" /></div>
        )}
        <button onClick={resetToThisWeek} className="btn btn-ghost btn-sm">This week</button>
      </div>

      <div style={{ background: 'white', border: '1px solid var(--olive)', borderRadius: '1.5rem', padding: '2.5rem' }}>
        <div style={{ borderBottom: '2px solid var(--forest)', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', color: 'var(--forest)', letterSpacing: '-0.02em' }}>Harvest List</div>
          <p style={{ fontSize: '0.85rem', color: 'var(--moss)', marginTop: '0.25rem' }}>
            totals across {data?.order_count ?? 0} order{(data?.order_count ?? 0) === 1 ? '' : 's'}{from && to ? ` · ${fmtShort(from)}${from !== to ? ` – ${fmtShort(to)}` : ''}` : ''}
          </p>
          {!!data?.unscheduled_order_count && (
            <p className="no-print" style={{ fontSize: '0.78rem', color: '#92400e', marginTop: '0.75rem', background: '#fef9c3', padding: '0.6rem 0.875rem', borderRadius: '0.625rem' }}>
              ⚠ {data.unscheduled_order_count} active order{data.unscheduled_order_count === 1 ? '' : 's'} {data.unscheduled_order_count === 1 ? "doesn't" : "don't"} have a harvest date set yet, so {data.unscheduled_order_count === 1 ? "it isn't" : "they aren't"} shown here — check with admin.
            </p>
          )}
        </div>

        {loading ? (
          <p style={{ color: 'var(--moss)', textAlign: 'center', padding: '3rem 0' }}>Loading…</p>
        ) : rows.length === 0 ? (
          <p style={{ color: 'var(--moss)', textAlign: 'center', padding: '3rem 0' }}>Nothing to harvest in this date range.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--forest)' }}>
                <th className="no-print" style={{ padding: '0.75rem 0.5rem', width: '2.5rem' }} />
                {['Product', 'Total to cut', 'Orders'].map((h, i) => (
                  <th key={h} style={{ padding: '0.75rem', textAlign: i === 0 ? 'left' : 'right', fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--forest)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.key} style={{ borderBottom: '1px solid var(--olive)', background: r.overdue ? '#fee2e2' : 'transparent' }}>
                  <td className="no-print" style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>
                    <RowCheckbox row={r} busy={busyKeys.has(r.key)} onToggle={() => toggleRow(r)} />
                  </td>
                  <td style={{ padding: '1rem 0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--forest)', textDecoration: r.fully_harvested ? 'line-through' : 'none', opacity: r.fully_harvested ? 0.6 : 1 }}>{r.name}</span>
                      {r.overdue && (
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#B91C1C', background: '#FEE2E2', border: '1px solid #FCA5A5', padding: '0.15rem 0.5rem', borderRadius: '99px' }}>
                          ⚠ Not fulfilled
                        </span>
                      )}
                    </div>
                    {r.notes.length > 0 && (
                      <div style={{ marginTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        {r.notes.map((n, i) => (
                          <p key={i} style={{ fontSize: '0.75rem', color: 'var(--moss)', fontStyle: 'italic' }}>📝 {n}</p>
                        ))}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontSize: '1.4rem', fontFamily: 'var(--font-display)', color: 'var(--forest)' }}>
                    {r.qty} <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-body)', color: 'var(--moss)' }}>{r.unit}</span>
                  </td>
                  <td style={{ padding: '1rem 0.75rem', textAlign: 'right', fontSize: '0.85rem', color: 'var(--moss)' }}>{r.order_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
