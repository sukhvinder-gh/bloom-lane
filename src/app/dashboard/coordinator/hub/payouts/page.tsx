'use client'
import { useEffect, useState } from 'react'
import { formatPrice } from '@/lib/utils/pricing'
import { formatAEST } from '@/lib/utils/timezone'

type Payout = {
  id: string
  farmer_id: string
  gross_amount_cents: number
  commission_cents: number
  net_amount_cents: number
  status: 'pending' | 'processing' | 'paid' | 'failed'
  stripe_transfer_id: string | null
  paid_at: string | null
  created_at: string
  farmers: { business_name: string | null } | null
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  paid:       { bg: '#D1FAE5', color: '#065F46', label: '✓ Paid' },
  processing: { bg: '#FEF3C7', color: '#92400E', label: '⏳ Processing' },
  pending:    { bg: '#F1EFE8', color: '#5F5E5A', label: '— Pending' },
  failed:     { bg: '#FEE2E2', color: '#B91C1C', label: '✕ Failed' },
}

export default function CoordinatorHubPayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/coordinator/hub/payouts')
      .then(r => r.json())
      .then(d => setPayouts(d.data || []))
      .finally(() => setLoading(false))
  }, [])

  const totalReceived = payouts.filter(p => p.status === 'paid').reduce((s, p) => s + p.net_amount_cents, 0)
  const pendingAmount = payouts.filter(p => p.status === 'processing' || p.status === 'pending').reduce((s, p) => s + p.net_amount_cents, 0)

  if (loading) return (
    <div className="page-pad" style={{ padding: '2.5rem', color: 'var(--moss)' }}>Loading…</div>
  )

  return (
    <div className="page-pad" style={{ padding: '2.5rem', maxWidth: '60rem' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--forest)', marginBottom: '0.25rem' }}>Hub Payouts</h1>
      <p style={{ fontSize: '0.875rem', color: 'var(--moss)', marginBottom: '2rem' }}>
        Payouts your hub has received on behalf of its growers — each still owes that grower their share, this only tracks what Stripe has sent to your hub's account.
      </p>

      <div className="mg-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.25rem', marginBottom: '2.5rem' }}>
        <div style={{ background: 'var(--forest)', borderRadius: 'var(--r-card)', padding: '1.5rem' }}>
          <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--cream)', opacity: 0.7, marginBottom: '0.5rem' }}>Total Received</p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: 'var(--cream)' }}>{formatPrice(totalReceived)}</p>
        </div>
        <div style={{ background: 'var(--sage)', borderRadius: 'var(--r-card)', padding: '1.5rem' }}>
          <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--forest)', opacity: 0.7, marginBottom: '0.5rem' }}>Pending</p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: 'var(--forest)' }}>{formatPrice(pendingAmount)}</p>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: 'var(--r-card)', overflow: 'hidden', border: '1px solid var(--olive)' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--olive)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--forest)' }}>Payout History</h2>
        </div>
        <div className="table-wrap">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--cream)' }}>
              {['Date', 'Grower', 'Gross', 'Commission', 'Net', 'Status', 'Transfer'].map(h => (
                <th key={h} style={{ padding: '0.75rem 1.25rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--forest)', opacity: 0.6 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {payouts.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: 'var(--forest)', opacity: 0.4 }}>
                No payouts to your hub yet
              </td></tr>
            ) : payouts.map(payout => {
              const s = STATUS_STYLE[payout.status] || STATUS_STYLE.pending
              return (
                <tr key={payout.id} style={{ borderTop: '1px solid var(--olive)' }}>
                  <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.8rem', color: 'var(--forest)', opacity: 0.6 }}>
                    {formatAEST(payout.created_at, 'dd MMM yyyy')}
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.875rem', color: 'var(--forest)', fontWeight: 600 }}>
                    {payout.farmers?.business_name || '—'}
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.875rem', color: 'var(--forest)' }}>{formatPrice(payout.gross_amount_cents)}</td>
                  <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.875rem', color: 'var(--forest)', opacity: 0.6 }}>−{formatPrice(payout.commission_cents)}</td>
                  <td style={{ padding: '0.875rem 1.25rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--forest)' }}>{formatPrice(payout.net_amount_cents)}</span>
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem' }}>
                    <span style={{ padding: '3px 10px', borderRadius: '99px', fontSize: '0.7rem', fontWeight: 700, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>{s.label}</span>
                  </td>
                  <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.72rem', color: 'var(--moss)', fontFamily: 'monospace' }}>
                    {payout.stripe_transfer_id ? payout.stripe_transfer_id.slice(0, 18) + '…' : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
