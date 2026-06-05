// src/app/dashboard/admin/payouts/page.tsx
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatPrice } from '@/lib/utils/pricing'
import { formatAEST } from '@/lib/utils/timezone'

export default async function AdminPayoutsPage() {
  const supabase = await createClient()
  const adminSupabase = await createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: payouts } = await adminSupabase
    .from('payouts')
    .select('*, farmers(business_name, abn)')
    .order('created_at', { ascending: false })
    .limit(100)

  const totalPaid       = (payouts || []).filter(p => p.status === 'paid').reduce((s, p) => s + p.net_amount_cents, 0)
  const totalCommission = (payouts || []).filter(p => p.status === 'paid').reduce((s, p) => s + p.commission_cents, 0)
  const pendingCount    = (payouts || []).filter(p => p.status === 'pending' || p.status === 'processing').length
  const failedCount     = (payouts || []).filter(p => p.status === 'failed').length

  const statusStyle: Record<string, React.CSSProperties> = {
    paid:       { background: '#dcfce7', color: '#166534' },
    processing: { background: '#fef9c3', color: '#854d0e' },
    pending:    { background: '#f1f5f9', color: '#475569' },
    failed:     { background: '#fee2e2', color: '#991b1b' },
  }

  return (
    <div style={{ padding: '2.5rem', fontFamily: 'var(--font-body)' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--forest)', marginBottom: '0.25rem' }}>
        Payouts
      </h1>
      <p style={{ color: 'var(--forest)', opacity: 0.5, marginBottom: '2rem', fontSize: '0.9rem' }}>
        Farmer earnings &amp; platform commission
      </p>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem', marginBottom: '2.5rem' }}>
        {[
          { label: 'Total Paid Out',     value: formatPrice(totalPaid),       bg: 'var(--forest)', color: 'var(--cream)' },
          { label: 'Platform Commission',value: formatPrice(totalCommission),  bg: 'var(--sage)',   color: 'var(--forest)' },
          { label: 'Pending Payouts',    value: pendingCount,                  bg: 'var(--olive)',  color: 'var(--forest)' },
          { label: 'Failed Payouts',     value: failedCount,                   bg: failedCount > 0 ? '#fee2e2' : 'var(--olive)', color: failedCount > 0 ? '#991b1b' : 'var(--forest)' },
        ].map(stat => (
          <div key={stat.label} style={{ background: stat.bg, borderRadius: 'var(--r-card)', padding: '1.5rem' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: stat.color, opacity: 0.7, marginBottom: '0.5rem' }}>{stat.label}</p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Payouts Table */}
      <div style={{ background: 'white', borderRadius: 'var(--r-card)', overflow: 'hidden', border: '1px solid var(--olive)' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--olive)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--forest)' }}>Payout History</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--forest)', opacity: 0.5 }}>{(payouts || []).length} records</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--cream)' }}>
                {['Farmer', 'Gross', 'Commission', 'Net Payout', 'Status', 'Paid At', 'Transfer ID'].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1.25rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--forest)', opacity: 0.6 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(payouts || []).length === 0 ? (
                <tr><td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--forest)', opacity: 0.4 }}>No payouts yet</td></tr>
              ) : (payouts || []).map(payout => (
                <tr key={payout.id} style={{ borderTop: '1px solid var(--olive)' }}>
                  <td style={{ padding: '0.875rem 1.25rem' }}>
                    <p style={{ fontWeight: 700, color: 'var(--forest)', fontSize: '0.875rem' }}>{(payout as any).farmers?.business_name}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--forest)', opacity: 0.5 }}>{(payout as any).farmers?.abn}</p>
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.875rem', color: 'var(--forest)' }}>{formatPrice(payout.gross_amount_cents)}</td>
                  <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.875rem', color: 'var(--forest)' }}>{formatPrice(payout.commission_cents)}</td>
                  <td style={{ padding: '0.875rem 1.25rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--forest)', fontSize: '0.875rem' }}>{formatPrice(payout.net_amount_cents)}</span>
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem' }}>
                    <span style={{ padding: '0.2rem 0.6rem', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 700, ...statusStyle[payout.status] }}>
                      {payout.status}
                    </span>
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.8rem', color: 'var(--forest)', opacity: 0.6 }}>
                    {payout.paid_at ? formatAEST(payout.paid_at, 'dd MMM yy, h:mm a') : '—'}
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.75rem', color: 'var(--forest)', opacity: 0.4, fontFamily: 'monospace' }}>
                    {payout.stripe_transfer_id ? payout.stripe_transfer_id.slice(0, 20) + '...' : '—'}
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
