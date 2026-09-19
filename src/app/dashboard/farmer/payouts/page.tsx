// src/app/dashboard/farmer/payouts/page.tsx
import { getSessionUserFromCookie, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatPrice } from '@/lib/utils/pricing'
import { formatAEST } from '@/lib/utils/timezone'
import { getCommissionRates, effectiveCommissionRate } from '@/lib/utils/commission'

export default async function FarmerPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ stripe_error?: string }>
}) {
  const { stripe_error } = await searchParams
  const sessionUser = await getSessionUserFromCookie()
  if (!sessionUser) redirect('/auth/login')

  const adminSupabase = createAdminClient()

  const { data: farmer } = await adminSupabase
    .from('farmers')
    .select('id, business_name, commission_rate, subscription_type, stripe_account_id, stripe_onboarding_complete')
    .eq('user_id', sessionUser.id)
    .single()

  if (!farmer) { return (<div style={{ padding: "3rem", textAlign: "center" }}><p style={{ color: "var(--forest)", opacity: 0.5 }}>No farmer profile found.</p><a href="/dashboard/farmer/storefront" style={{ display: "inline-block", marginTop: "1rem", color: "var(--forest)", fontWeight: 700 }}>Create Profile →</a></div>) }

  const { data: payouts } = await adminSupabase
    .from('payouts')
    .select('*')
    .eq('farmer_id', farmer.id)
    .order('created_at', { ascending: false })

  const totalEarned   = (payouts || []).filter(p => p.status === 'paid').reduce((s, p) => s + p.net_amount_cents, 0)
  const pendingAmount = (payouts || []).filter(p => p.status === 'processing' || p.status === 'pending').reduce((s, p) => s + p.net_amount_cents, 0)
  const totalGross    = (payouts || []).filter(p => p.status === 'paid').reduce((s, p) => s + p.gross_amount_cents, 0)

  const statusStyle: Record<string, React.CSSProperties> = {
    paid:       { background: '#dcfce7', color: '#166534' },
    processing: { background: '#fef9c3', color: '#854d0e' },
    pending:    { background: '#f1f5f9', color: '#475569' },
    failed:     { background: '#fee2e2', color: '#991b1b' },
  }

  return (
    <div className="page-pad" style={{ padding: '2.5rem', fontFamily: 'var(--font-body)' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--forest)', marginBottom: '0.25rem' }}>
        Earnings
      </h1>
      <p style={{ color: 'var(--forest)', opacity: 0.5, marginBottom: '2rem', fontSize: '0.9rem' }}>
        Your payouts after {Math.round(effectiveCommissionRate(farmer, await getCommissionRates(adminSupabase)) * 100)}% platform commission
      </p>

      {stripe_error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '1rem', padding: '1rem 1.25rem', marginBottom: '1.5rem', color: '#991b1b', fontSize: '0.85rem' }}>
          ⚠ Something went wrong setting up Stripe. Please try again, or contact support if it keeps happening.
        </div>
      )}

      {/* Stripe onboarding banner */}
      {!farmer.stripe_onboarding_complete ? (
        <div style={{ background: '#fef9c3', border: '1px solid #fbbf24', borderRadius: '1rem', padding: '1.25rem 1.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '1.5rem', flexShrink: 0 }}>💳</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, color: '#92400e', fontSize: '0.9rem', marginBottom: '0.3rem' }}>
                {farmer.stripe_account_id ? 'Stripe setup incomplete' : 'Connect your bank account'}
              </p>
              <p style={{ color: '#92400e', fontSize: '0.8rem', opacity: 0.8, lineHeight: 1.5 }}>
                {farmer.stripe_account_id
                  ? 'Your Stripe account was created but needs more information before you can receive payouts.'
                  : 'Connect your bank account via Stripe to receive automatic payouts after each delivery. The Green Guild uses Stripe Connect — secure, fast, and free to set up.'}
              </p>
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <a href="/api/stripe/onboarding"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#92400e', color: 'white', padding: '0.5rem 1.25rem', borderRadius: '99px', textDecoration: 'none', fontSize: '0.825rem', fontWeight: 700 }}>
                  {farmer.stripe_account_id ? '→ Continue Setup' : '→ Set Up Payouts'}
                </a>
                <span style={{ fontSize: '0.75rem', color: '#92400e', opacity: 0.7 }}>
                  Powered by Stripe · Takes ~5 minutes
                </span>
              </div>
            </div>
          </div>
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #fbbf24', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            {[
              { step: '1', label: 'Verify identity', done: !!farmer.stripe_account_id },
              { step: '2', label: 'Add bank account', done: false },
              { step: '3', label: 'Start receiving payouts', done: false },
            ].map(s => (
              <div key={s.step} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '1.25rem', height: '1.25rem', borderRadius: '50%', background: s.done ? '#92400e' : 'rgba(146,64,14,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', color: s.done ? 'white' : '#92400e', fontWeight: 700, flexShrink: 0 }}>
                  {s.done ? '✓' : s.step}
                </div>
                <span style={{ fontSize: '0.75rem', color: '#92400e', opacity: s.done ? 1 : 0.6 }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ background: '#dcfce7', border: '1px solid #86efac', borderRadius: '1rem', padding: '1rem 1.5rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontSize: '1.25rem' }}>✅</span>
          <div>
            <p style={{ fontWeight: 700, color: '#166534', fontSize: '0.875rem' }}>Stripe account connected</p>
            <p style={{ color: '#166534', fontSize: '0.8rem', opacity: 0.8 }}>You'll receive payouts automatically after each order's dispute window closes (6 hours post-delivery).</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem', marginBottom: '2.5rem' }}>
        {[
          { label: 'Total Earned (Net)',  value: formatPrice(totalEarned),   bg: 'var(--forest)', color: 'var(--cream)' },
          { label: 'Pending Payout',      value: formatPrice(pendingAmount),  bg: 'var(--sage)',   color: 'var(--forest)' },
          { label: 'Total Gross Sales',   value: formatPrice(totalGross),     bg: 'var(--olive)',  color: 'var(--forest)' },
        ].map(stat => (
          <div key={stat.label} style={{ background: stat.bg, borderRadius: 'var(--r-card)', padding: '1.5rem' }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: stat.color, opacity: 0.7, marginBottom: '0.5rem' }}>{stat.label}</p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Payout table */}
      <div style={{ background: 'white', borderRadius: 'var(--r-card)', overflow: 'hidden', border: '1px solid var(--olive)' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--olive)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--forest)' }}>Payout History</h2>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--cream)' }}>
              {['Date', 'Gross', 'Commission', 'Net (You Get)', 'Status', 'Transfer'].map(h => (
                <th key={h} style={{ padding: '0.75rem 1.25rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--forest)', opacity: 0.6 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(payouts || []).length === 0 ? (
              <tr><td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: 'var(--forest)', opacity: 0.4 }}>
                No payouts yet — payouts are triggered 6 hours after delivery confirmation
              </td></tr>
            ) : (payouts || []).map(payout => (
              <tr key={payout.id} style={{ borderTop: '1px solid var(--olive)' }}>
                <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.8rem', color: 'var(--forest)', opacity: 0.6 }}>
                  {formatAEST(payout.created_at, 'dd MMM yyyy')}
                </td>
                <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.875rem', color: 'var(--forest)' }}>{formatPrice(payout.gross_amount_cents)}</td>
                <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.875rem', color: 'var(--forest)', opacity: 0.6 }}>−{formatPrice(payout.commission_cents)}</td>
                <td style={{ padding: '0.875rem 1.25rem' }}>
                  <span style={{ fontWeight: 700, color: 'var(--forest)' }}>{formatPrice(payout.net_amount_cents)}</span>
                </td>
                <td style={{ padding: '0.875rem 1.25rem' }}>
                  <span style={{ padding: '0.2rem 0.6rem', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 700, ...statusStyle[payout.status] }}>
                    {payout.status}
                  </span>
                </td>
                <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.75rem', color: 'var(--forest)', opacity: 0.4, fontFamily: 'monospace' }}>
                  {payout.stripe_transfer_id ? payout.stripe_transfer_id.slice(0, 18) + '...' : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
