'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatPrice } from '@/lib/utils/pricing'

const PERIODS = [
  { value: '7d',  label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '1y',  label: 'This year' },
  { value: 'all', label: 'All time' },
]

type Tab = 'platform' | 'hub'

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

// Mirrors the server's periodStart() so a stat tile's "last N days" label
// links through to a transaction list scoped to the same range it summarised.
function periodToFromDate(period: string): string | null {
  const now = new Date()
  if (period === '7d')  { now.setDate(now.getDate() - 7);  return now.toISOString().slice(0, 10) }
  if (period === '30d') { now.setDate(now.getDate() - 30); return now.toISOString().slice(0, 10) }
  if (period === '90d') { now.setDate(now.getDate() - 90); return now.toISOString().slice(0, 10) }
  if (period === '1y')  { now.setFullYear(now.getFullYear() - 1); return now.toISOString().slice(0, 10) }
  return null
}

// A week row's `week` value is its Monday (see isoWeek() server-side) — the
// row should link to the full Mon–Sun range it summarises, not just one day.
function weekEndDate(weekStart: string): string {
  const d = new Date(weekStart)
  d.setDate(d.getDate() + 6)
  return d.toISOString().slice(0, 10)
}

function StatCard({ icon, label, value, sub, color = 'var(--navy)', href }: { icon: string; label: string; value: string; sub?: string; color?: string; href: string }) {
  return (
    <Link href={href} className="card" style={{ padding: '1.25rem', display: 'block', textDecoration: 'none', transition: 'transform 0.12s ease, box-shadow 0.12s ease' }}>
      <p style={{ fontSize: '1.5rem', marginBottom: '0.375rem' }}>{icon}</p>
      <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em' }}>{value}</p>
      <p style={{ fontSize: '0.72rem', color: 'var(--moss)', marginTop: '0.35rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</p>
      {sub && <p style={{ fontSize: '0.68rem', color: 'var(--moss)', opacity: 0.6, marginTop: '0.15rem' }}>{sub}</p>}
    </Link>
  )
}

export default function AdminReportsPage() {
  const router = useRouter()
  const [tab, setTab]       = useState<Tab>('platform')
  const [period, setPeriod] = useState('90d')
  const [platData, setPlatData] = useState<any>(null)
  const [platLoading, setPlatLoading] = useState(true)

  // Hub tab state
  const [hubs, setHubs]         = useState<any[]>([])
  const [hubId, setHubId]       = useState('')
  const [hubData, setHubData]   = useState<any>(null)
  const [hubLoading, setHubLoading] = useState(false)

  // Load platform data
  useEffect(() => {
    setPlatLoading(true)
    fetch(`/api/admin/reports?period=${period}`)
      .then(r => r.json())
      .then(d => { setPlatData(d.data); setPlatLoading(false) })
      .catch(() => setPlatLoading(false))
  }, [period])

  // Load hubs list
  useEffect(() => {
    fetch('/api/admin/hubs')
      .then(r => r.json())
      .then(d => {
        const list = d.data || []
        setHubs(list)
        if (list.length > 0 && !hubId) setHubId(list[0].id)
      })
  }, [])

  // Load hub data when hubId or period changes
  useEffect(() => {
    if (!hubId) return
    setHubLoading(true)
    setHubData(null)
    fetch(`/api/admin/hubs/${hubId}/reports?period=${period}`)
      .then(r => r.json())
      .then(d => { setHubData(d.data); setHubLoading(false) })
      .catch(() => setHubLoading(false))
  }, [hubId, period])

  const s  = platData?.summary || {}
  const weeks: any[]  = platData?.by_week || []
  const growers: any[] = platData?.grower_performance || []
  const maxGmv = Math.max(...weeks.map((w: any) => w.gmv), 1)

  const hs = hubData?.summary || {}
  const hWeeks: any[] = hubData?.by_week || []
  const hGrowers: any[] = hubData?.grower_performance || []
  const maxHGmv = Math.max(...hWeeks.map((w: any) => w.gmv), 1)

  const thStyle: React.CSSProperties = { padding: '0.5rem 0.75rem', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--moss)' }
  const tdStyle: React.CSSProperties = { padding: '0.65rem 0.75rem', fontSize: '0.82rem', borderBottom: '1px solid var(--olive)' }
  const clickableRowStyle: React.CSSProperties = { cursor: 'pointer' }

  // Every stat tile for the selected period links through to the same
  // range in the transaction ledger it summarised, instead of just being
  // a static number.
  const periodFrom = periodToFromDate(period)
  const invoicesHrefForPeriod = periodFrom ? `/dashboard/admin/invoices?from=${periodFrom}` : '/dashboard/admin/invoices'

  return (
    <div style={{ padding: '2.5rem', fontFamily: 'var(--font-body)', maxWidth: '72rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--navy)', marginBottom: '0.2rem' }}>Reports</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--moss)' }}>Platform sales, commission, and grower performance</p>
        </div>
        <div style={{ display: 'flex', background: 'var(--olive)', borderRadius: '99px', padding: '0.2rem', gap: '0.15rem' }}>
          {PERIODS.map(p => (
            <button key={p.value} onClick={() => setPeriod(p.value)} style={{ padding: '0.375rem 0.875rem', borderRadius: '99px', border: 'none', cursor: 'pointer', fontSize: '0.775rem', fontWeight: 600, fontFamily: 'var(--font-body)', background: period === p.value ? 'var(--forest)' : 'transparent', color: period === p.value ? 'white' : 'var(--moss)', transition: 'all 0.15s' }}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--olive)', marginBottom: '1.75rem', gap: '0' }}>
        {(['platform', 'hub'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '0.625rem 1.25rem', border: 'none', borderBottom: tab === t ? '2px solid var(--forest)' : '2px solid transparent', marginBottom: '-2px', background: 'transparent', cursor: 'pointer', fontWeight: tab === t ? 700 : 500, color: tab === t ? 'var(--forest)' : 'var(--moss)', fontSize: '0.875rem', fontFamily: 'var(--font-body)', transition: 'all 0.15s' }}>
            {t === 'platform' ? '🌿 Platform Reports' : '🏛 Hub Reports'}
          </button>
        ))}
      </div>

      {/* ── PLATFORM TAB ── */}
      {tab === 'platform' && (
        platLoading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(11rem,1fr))', gap: '1rem' }}>
            {Array.from({ length: 7 }).map((_, i) => <div key={i} style={{ height: '6rem', borderRadius: '1rem', background: 'var(--olive)' }} />)}
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(11rem,1fr))', gap: '1rem', marginBottom: '2rem' }}>
              <StatCard icon="💰" label="Total GMV"       value={formatPrice(s.gmv || 0)}            color="var(--navy)" href={invoicesHrefForPeriod} />
              <StatCard icon="🏛" label="Commission (10%)" value={formatPrice(s.commission || 0)}     color="#065F46" href={invoicesHrefForPeriod} />
              <StatCard icon="📦" label="Total orders"    value={String(s.total_orders || 0)}        color="var(--navy)" href="/dashboard/admin/orders" />
              <StatCard icon="🌾" label="Active growers"  value={String(s.active_growers || 0)}      color="var(--moss)" href="/dashboard/admin/farmers" />
              <StatCard icon="👥" label="Active buyers"   value={String(s.active_buyers || 0)}       color="var(--moss)" href="/dashboard/admin/buyers" />
              <StatCard icon="🧾" label="GST revenue"     value={formatPrice(s.gst_revenue || 0)}    color="var(--moss)" sub="Collected on orders" href={invoicesHrefForPeriod} />
              <StatCard icon="🌿" label="Non-GST revenue" value={formatPrice(s.non_gst_revenue || 0)} color="var(--moss)" sub="GST-free products" href={invoicesHrefForPeriod} />
            </div>

            {/* Revenue over time */}
            {weeks.length > 0 && (
              <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--navy)', marginBottom: '0.375rem' }}>Revenue by week</h2>
                <p style={{ fontSize: '0.75rem', color: 'var(--moss)', marginBottom: '1.25rem' }}>
                  Bar length shows each week's GMV relative to the highest-earning week shown below — click a week to see its transactions.
                </p>
                <div style={{ overflowX: 'auto' }}>
                  <div className="table-wrap">
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '36rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--olive)' }}>
                        {['Week', 'Orders', 'GMV', 'Commission', 'Bar'].map((h, i) => (
                          <th key={h} style={{ ...thStyle, textAlign: i >= 2 ? 'right' : 'left' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...weeks].reverse().map(w => (
                        <tr
                          key={w.week}
                          style={clickableRowStyle}
                          onClick={() => router.push(`/dashboard/admin/invoices?from=${w.week}&to=${weekEndDate(w.week)}`)}
                          title={`View transactions for the week of ${fmt(w.week)}`}
                        >
                          <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--navy)' }}>{fmt(w.week)}</td>
                          <td style={{ ...tdStyle, color: 'var(--moss)' }}>{w.orders}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: 'var(--navy)' }}>{formatPrice(w.gmv)}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', color: '#065F46' }}>{formatPrice(w.commission)}</td>
                          <td style={{ ...tdStyle, width: '8rem' }} title={`${Math.round((w.gmv / maxGmv) * 100)}% of the highest week's GMV`}>
                            <div style={{ height: '0.5rem', borderRadius: '99px', background: 'var(--olive)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${Math.round((w.gmv / maxGmv) * 100)}%`, background: 'var(--navy)', borderRadius: '99px' }} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            )}

            {/* Grower performance */}
            {growers.length > 0 && (
              <div className="card" style={{ padding: '1.5rem' }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--navy)', marginBottom: '1.25rem' }}>Grower performance</h2>
                <div style={{ overflowX: 'auto' }}>
                  <div className="table-wrap">
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '30rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--olive)' }}>
                        {['Grower', 'Orders', 'GMV', 'Commission', 'Net payout'].map((h, i) => (
                          <th key={h} style={{ ...thStyle, textAlign: i >= 1 ? 'right' : 'left' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {growers.map((g: any, i: number) => (
                        <tr
                          key={g.farmer_id}
                          style={{ background: i % 2 === 0 ? 'white' : 'var(--offwhite, #fafaf7)', ...clickableRowStyle }}
                          onClick={() => router.push(`/dashboard/admin/farmers/${g.farmer_id}`)}
                          title={`View ${g.business_name}`}
                        >
                          <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--navy)' }}>
                            <Link href={`/dashboard/admin/farmers/${g.farmer_id}`} style={{ color: 'var(--forest)', textDecoration: 'none' }}>
                              {g.business_name}
                            </Link>
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--moss)' }}>{g.orders}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: 'var(--navy)' }}>{formatPrice(g.gmv)}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--moss)' }}>{formatPrice(g.commission)}</td>
                          <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#065F46' }}>{formatPrice(g.net)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            )}

            {!weeks.length && !growers.length && !platLoading && (
              <div className="card" style={{ padding: '4rem', textAlign: 'center' }}>
                <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</p>
                <p style={{ color: 'var(--moss)' }}>No orders found for this period.</p>
              </div>
            )}
          </>
        )
      )}

      {/* ── HUB TAB ── */}
      {tab === 'hub' && (
        <>
          {/* Hub selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--moss)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Hub</label>
            <select
              value={hubId}
              onChange={e => setHubId(e.target.value)}
              className="input"
              style={{ minWidth: '14rem', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}
            >
              {hubs.map(h => <option key={h.id} value={h.id}>{h.name}{h.hub_suburb ? ` · ${h.hub_suburb}` : ''}</option>)}
            </select>
          </div>

          {hubLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(11rem,1fr))', gap: '1rem' }}>
              {Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ height: '6rem', borderRadius: '1rem', background: 'var(--olive)' }} />)}
            </div>
          ) : hubData ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(11rem,1fr))', gap: '1rem', marginBottom: '2rem' }}>
                <StatCard icon="📦" label="Total orders"    value={String(hs.total_orders || 0)}       color="var(--navy)" href={invoicesHrefForPeriod} />
                <StatCard icon="💰" label="Hub GMV"         value={formatPrice(hs.gmv || 0)}           color="var(--navy)" href={invoicesHrefForPeriod} />
                <StatCard icon="🤝" label="B2B (wholesale)" value={formatPrice(hs.b2b_gmv || 0)}       color="var(--forest)" href={invoicesHrefForPeriod} />
                <StatCard icon="🛒" label="B2C (retail)"    value={formatPrice(hs.b2c_gmv || 0)}       color="var(--moss)" href={invoicesHrefForPeriod} />
                <StatCard icon="🧾" label="GST revenue"     value={formatPrice(hs.gst_revenue || 0)}   color="var(--moss)" sub="Taxable products" href={invoicesHrefForPeriod} />
                <StatCard icon="🌿" label="Non-GST revenue" value={formatPrice(hs.non_gst_revenue || 0)} color="var(--moss)" sub="GST-free products" href={invoicesHrefForPeriod} />
              </div>

              {hWeeks.length > 0 && (
                <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--navy)', marginBottom: '0.375rem' }}>Orders by week</h2>
                  <p style={{ fontSize: '0.75rem', color: 'var(--moss)', marginBottom: '1.25rem' }}>
                    Bar length shows each week's GMV relative to the highest-earning week shown below — click a week to see its transactions.
                  </p>
                  <div style={{ overflowX: 'auto' }}>
                    <div className="table-wrap">
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '30rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--olive)' }}>
                          {['Week', 'Orders', 'GMV', 'GST', 'Bar'].map((h, i) => (
                            <th key={h} style={{ ...thStyle, textAlign: i >= 2 ? 'right' : 'left' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...hWeeks].reverse().map(w => (
                          <tr
                            key={w.week}
                            style={clickableRowStyle}
                            onClick={() => router.push(`/dashboard/admin/invoices?from=${w.week}&to=${weekEndDate(w.week)}`)}
                            title={`View transactions for the week of ${fmt(w.week)}`}
                          >
                            <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--navy)' }}>{fmt(w.week)}</td>
                            <td style={{ ...tdStyle, color: 'var(--moss)' }}>{w.orders}</td>
                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: 'var(--navy)' }}>{formatPrice(w.gmv)}</td>
                            <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--moss)' }}>{formatPrice(w.gst)}</td>
                            <td style={{ ...tdStyle, width: '8rem' }} title={`${Math.round((w.gmv / maxHGmv) * 100)}% of the highest week's GMV`}>
                              <div style={{ height: '0.5rem', borderRadius: '99px', background: 'var(--olive)', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${Math.round((w.gmv / maxHGmv) * 100)}%`, background: 'var(--forest)', borderRadius: '99px' }} />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </div>
              )}

              {hGrowers.length > 0 && (
                <div className="card" style={{ padding: '1.5rem' }}>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--navy)', marginBottom: '1.25rem' }}>Hub grower performance</h2>
                  <div style={{ overflowX: 'auto' }}>
                    <div className="table-wrap">
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '28rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--olive)' }}>
                          {['Grower', 'Orders', 'Units', 'GMV'].map((h, i) => (
                            <th key={h} style={{ ...thStyle, textAlign: i >= 1 ? 'right' : 'left' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {hGrowers.map((g: any, i: number) => (
                          <tr
                            key={g.farmer_id}
                            style={{ background: i % 2 === 0 ? 'white' : 'var(--offwhite, #fafaf7)', ...clickableRowStyle }}
                            onClick={() => router.push(`/dashboard/admin/farmers/${g.farmer_id}`)}
                            title={`View ${g.business_name}`}
                          >
                            <td style={{ ...tdStyle, fontWeight: 600 }}>
                              <Link href={`/dashboard/admin/farmers/${g.farmer_id}`} style={{ color: 'var(--forest)', textDecoration: 'none' }}>{g.business_name}</Link>
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--moss)' }}>{g.orders}</td>
                            <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--moss)' }}>{g.items}</td>
                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: 'var(--navy)' }}>{formatPrice(g.gmv)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </div>
                </div>
              )}

              {!hWeeks.length && !hGrowers.length && (
                <div className="card" style={{ padding: '4rem', textAlign: 'center' }}>
                  <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏛</p>
                  <p style={{ color: 'var(--moss)' }}>No orders through {hubData.hub?.name || 'this hub'} for this period.</p>
                </div>
              )}
            </>
          ) : (
            <div className="card" style={{ padding: '4rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--moss)' }}>{hubs.length === 0 ? 'No hubs configured yet.' : 'Select a hub above.'}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
