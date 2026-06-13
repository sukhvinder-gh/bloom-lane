'use client'
import { useState, useEffect } from 'react'
import { formatPrice } from '@/lib/utils/pricing'

const CATEGORY_EMOJI: Record<string, string> = {
  flowers_cut: '🌸', flowers_dried: '🌾', foliage: '🍃', vegetables: '🥦',
  herbs: '🌿', fruit: '🍓', eggs: '🥚', honey: '🍯', other: '📦',
}
const CATEGORY_LABEL: Record<string, string> = {
  flowers_cut: 'Cut Flowers', flowers_dried: 'Dried Flowers', foliage: 'Foliage',
  vegetables: 'Vegetables', herbs: 'Herbs', fruit: 'Fruit', eggs: 'Eggs', honey: 'Honey', other: 'Other',
}

const PERIODS = [
  { value: '7d',  label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '1y',  label: 'This year' },
  { value: 'all', label: 'All time' },
]

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export default function FarmerReportsPage() {
  const [period, setPeriod] = useState('90d')
  const [data, setData]     = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/farmer/reports?period=${period}`)
      .then(r => r.json())
      .then(d => { setData(d.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [period])

  const s = data?.summary || {}
  const weeks: any[] = data?.by_week || []
  const products: any[] = data?.by_product || []
  const maxGross = Math.max(...weeks.map((w: any) => w.gross), 1)

  return (
    <div style={{ padding: '2.5rem', fontFamily: 'var(--font-body)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.75rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--forest)', marginBottom: '0.2rem' }}>Sales Insights</h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--moss)' }}>Your revenue, orders, and product performance</p>
        </div>

        {/* Period selector */}
        <div style={{ display: 'flex', background: 'var(--olive)', borderRadius: '99px', padding: '0.2rem', gap: '0.15rem' }}>
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              style={{
                padding: '0.375rem 0.875rem', borderRadius: '99px', border: 'none', cursor: 'pointer',
                fontSize: '0.775rem', fontWeight: 600, fontFamily: 'var(--font-body)',
                background: period === p.value ? 'var(--forest)' : 'transparent',
                color: period === p.value ? 'white' : 'var(--moss)',
                transition: 'all 0.15s',
              }}
            >{p.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(11rem, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          {Array.from({ length: 4 }).map((_, i) => <div key={i} style={{ height: '6rem', borderRadius: '1rem', background: 'var(--olive)' }} />)}
        </div>
      ) : !data ? (
        <div className="card" style={{ padding: '4rem', textAlign: 'center' }}>
          <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</p>
          <p style={{ color: 'var(--moss)' }}>No sales data yet. Orders will appear here once buyers purchase your products.</p>
        </div>
      ) : (
        <>
          {/* Summary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(11rem, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            {[
              { label: 'Total orders',    value: s.total_orders,             fmt: (v: number) => String(v),         icon: '📦', color: 'var(--forest)' },
              { label: 'Gross revenue',   value: s.gross_revenue,            fmt: formatPrice,                      icon: '💰', color: 'var(--forest)' },
              { label: 'Net revenue',     value: s.net_revenue,              fmt: formatPrice,                      icon: '✅', color: '#065F46' },
              { label: 'Commission paid', value: s.commission,               fmt: formatPrice,                      icon: '🏛', color: 'var(--moss)' },
              { label: 'GST collected',   value: s.gst_amount,              fmt: formatPrice,                      icon: '🧾', color: 'var(--moss)' },
            ].map(stat => (
              <div key={stat.label} className="card" style={{ padding: '1.25rem' }}>
                <p style={{ fontSize: '1.5rem', marginBottom: '0.375rem' }}>{stat.icon}</p>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: stat.color, fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em' }}>
                  {stat.fmt(stat.value || 0)}
                </p>
                <p style={{ fontSize: '0.72rem', color: 'var(--moss)', marginTop: '0.35rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  {stat.label}
                </p>
                {stat.label === 'Net revenue' && s.commission_rate && (
                  <p style={{ fontSize: '0.68rem', color: 'var(--moss)', opacity: 0.6, marginTop: '0.15rem' }}>
                    After {Math.round(s.commission_rate * 100)}% commission
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Revenue over time */}
          {weeks.length > 0 && (
            <div className="card" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--forest)', marginBottom: '1.25rem' }}>Revenue by week</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', minWidth: '32rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--olive)' }}>
                      {['Week', 'Orders', 'Gross revenue', 'Net revenue', 'Bar'].map((h, i) => (
                        <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: i >= 2 ? 'right' : 'left', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--moss)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...weeks].reverse().map(w => (
                      <tr key={w.week} style={{ borderBottom: '1px solid var(--olive)' }}>
                        <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600, color: 'var(--forest)' }}>
                          {fmt(w.week)}
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem', color: 'var(--moss)' }}>{w.orders}</td>
                        <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', color: 'var(--forest)', fontWeight: 600 }}>{formatPrice(w.gross)}</td>
                        <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', color: '#065F46', fontWeight: 600 }}>{formatPrice(w.net)}</td>
                        <td style={{ padding: '0.6rem 0.75rem', width: '8rem' }}>
                          <div style={{ height: '0.5rem', borderRadius: '99px', background: 'var(--olive)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${Math.round((w.gross / maxGross) * 100)}%`, background: 'var(--forest)', borderRadius: '99px', transition: 'width 0.4s ease' }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Product performance */}
          {products.length > 0 && (
            <div className="card" style={{ padding: '1.5rem' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--forest)', marginBottom: '1.25rem' }}>Product performance</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', minWidth: '28rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--olive)' }}>
                      {['Product', 'Category', 'Units sold', 'Times ordered', 'Gross revenue', 'Net revenue'].map((h, i) => (
                        <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: i >= 2 ? 'right' : 'left', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--moss)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p: any, i: number) => (
                      <tr key={p.product_id} style={{ borderBottom: '1px solid var(--olive)', background: i % 2 === 0 ? 'white' : 'var(--offwhite, #fafaf7)' }}>
                        <td style={{ padding: '0.7rem 0.75rem', fontWeight: 600, color: 'var(--forest)' }}>{p.name}</td>
                        <td style={{ padding: '0.7rem 0.75rem' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: 'var(--moss)' }}>
                            {CATEGORY_EMOJI[p.category]} {CATEGORY_LABEL[p.category] || p.category}
                          </span>
                        </td>
                        <td style={{ padding: '0.7rem 0.75rem', textAlign: 'right', color: 'var(--forest)' }}>{p.qty}</td>
                        <td style={{ padding: '0.7rem 0.75rem', textAlign: 'right', color: 'var(--moss)' }}>{p.orders}</td>
                        <td style={{ padding: '0.7rem 0.75rem', textAlign: 'right', fontWeight: 600, color: 'var(--forest)' }}>{formatPrice(p.gross)}</td>
                        <td style={{ padding: '0.7rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#065F46' }}>{formatPrice(p.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--olive)', background: 'var(--olive)' }}>
                      <td colSpan={4} style={{ padding: '0.6rem 0.75rem', fontWeight: 700, color: 'var(--forest)', fontSize: '0.78rem' }}>Total</td>
                      <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 700, color: 'var(--forest)' }}>{formatPrice(s.gross_revenue)}</td>
                      <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#065F46' }}>{formatPrice(s.net_revenue)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {products.length === 0 && weeks.length === 0 && (
            <div className="card" style={{ padding: '4rem', textAlign: 'center' }}>
              <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🌱</p>
              <p style={{ color: 'var(--moss)' }}>No orders found for this period.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
