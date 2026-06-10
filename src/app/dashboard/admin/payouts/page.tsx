import { createAdminClient } from '@/lib/supabase/server'
import { formatPrice } from '@/lib/utils/pricing'
import { formatAEST } from '@/lib/utils/timezone'

const STATUS_BADGE: Record<string, string> = {
  paid:       'badge badge-sage',
  processing: 'badge badge-amber',
  pending:    'badge badge-cream',
  failed:     'badge badge-red',
}
const STATUS_LABEL: Record<string, string> = {
  paid: '✓ Paid', processing: '⏳ Processing', pending: '— Pending', failed: '✕ Failed',
}

export default async function AdminPayoutsPage() {
  const admin = createAdminClient()
  const { data: payouts } = await admin
    .from('payouts')
    .select('*, farmers(business_name, abn)')
    .order('created_at', { ascending: false })
    .limit(100)

  const list = payouts || []
  const paidOut    = list.filter(p => p.status === 'paid').reduce((s, p) => s + p.net_amount_cents, 0)
  const commission = list.filter(p => p.status === 'paid').reduce((s, p) => s + p.commission_cents, 0)
  const pendingN   = list.filter(p => p.status === 'pending' || p.status === 'processing').length
  const failedN    = list.filter(p => p.status === 'failed').length

  const stats = [
    { label: 'Total Paid Out',      value: formatPrice(paidOut),    icon: '💸', bg: 'var(--navy)',    clr: 'var(--petal)' },
    { label: 'Platform Commission', value: formatPrice(commission),  icon: '📊', bg: 'var(--sage-soft)', clr: 'var(--sage-new)' },
    { label: 'Pending Payouts',     value: String(pendingN),         icon: '⏳', bg: 'var(--amber-soft)', clr: 'var(--amber-new)' },
    { label: 'Failed Payouts',      value: String(failedN),          icon: failedN > 0 ? '🚨' : '✓', bg: failedN > 0 ? '#fce8ed' : 'var(--offwhite)', clr: failedN > 0 ? 'var(--bloom)' : 'var(--text-secondary)' },
  ]

  return (
    <div className="page-pad" style={{ padding: '2.5rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 className="type-heading reveal" style={{ color: 'var(--navy)', marginBottom: '0.25rem' }}>Payouts</h1>
        <p className="type-label" style={{ color: 'var(--moss)' }}>Farmer earnings &amp; platform commission</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
        {stats.map((s, i) => (
          <div key={s.label} className={`reveal reveal-d${i + 1}`} style={{ background: s.bg, borderRadius: '2rem', padding: '1.75rem', boxShadow: 'var(--shadow-card)' }}>
            <div style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>{s.icon}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', color: s.clr, letterSpacing: '-0.03em', marginBottom: '0.25rem' }}>{s.value}</div>
            <div className="type-label-sm" style={{ color: s.clr, opacity: 0.7 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card reveal" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="type-label-lg" style={{ color: 'var(--navy)' }}>Payout History</h2>
          <span className="type-label-sm" style={{ color: 'var(--moss)' }}>{list.length} records</span>
        </div>
        <div className="table-wrap">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--offwhite)', borderBottom: '1px solid var(--border-light)' }}>
                {['Farmer', 'Gross', 'Commission', 'Net Payout', 'Status', 'Paid At', 'Transfer ID'].map(h => (
                  <th key={h} className="type-label-sm" style={{ padding: '0.875rem 1.25rem', textAlign: 'left', color: 'var(--moss)', letterSpacing: '0.15em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '4rem', textAlign: 'center' }}>
                  <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💸</p>
                  <p className="type-label" style={{ color: 'var(--moss)' }}>No payouts yet</p>
                </td></tr>
              ) : list.map(payout => (
                <tr key={payout.id} className="table-row">
                  <td style={{ padding: '0.875rem 1.25rem' }}>
                    <p style={{ fontWeight: 700, color: 'var(--navy)', fontSize: '0.875rem' }}>{(payout as any).farmers?.business_name}</p>
                    <p className="type-label-sm" style={{ color: 'var(--moss)', fontFamily: 'monospace' }}>{(payout as any).farmers?.abn}</p>
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem', color: 'var(--navy)', fontSize: '0.875rem' }}>{formatPrice(payout.gross_amount_cents)}</td>
                  <td style={{ padding: '0.875rem 1.25rem', color: 'var(--moss)', fontSize: '0.875rem' }}>{formatPrice(payout.commission_cents)}</td>
                  <td style={{ padding: '0.875rem 1.25rem' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--navy)', letterSpacing: '-0.02em', fontWeight: 700 }}>{formatPrice(payout.net_amount_cents)}</span>
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem' }}>
                    <span className={STATUS_BADGE[payout.status] || 'badge badge-cream'}>{STATUS_LABEL[payout.status] || payout.status}</span>
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem' }}>
                    <p className="type-label-sm" style={{ color: 'var(--moss)' }}>{payout.paid_at ? formatAEST(payout.paid_at, 'dd MMM yy, h:mm a') : '—'}</p>
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--moss)', fontFamily: 'monospace' }}>{payout.stripe_transfer_id ? payout.stripe_transfer_id.slice(0, 18) + '…' : '—'}</p>
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
