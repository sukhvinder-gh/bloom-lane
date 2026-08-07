import { getSessionUserFromCookie, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import Link from 'next/link'

// Required registration sequence for growers: account details → membership
// (+ payment) → storefront → inventory. Inventory is the last, sale-facing
// step, so it's the one that actually needs to block on the earlier steps —
// visiting it before they're done previously just meant a confusing 403 the
// moment they tried to save a product, instead of a clear next step.
export default async function InventoryLayout({ children }: { children: ReactNode }) {
  const sessionUser = await getSessionUserFromCookie()
  if (!sessionUser) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: farmer } = await admin
    .from('farmers')
    .select('id, status')
    .eq('user_id', sessionUser.id)
    .maybeSingle()

  // No account details yet — storefront creation is where the farmers row
  // (business name, ABN, address) actually gets created.
  if (!farmer) redirect('/dashboard/farmer/storefront')

  if (farmer.status !== 'approved') {
    return (
      <div className="page-pad" style={{ padding: '2.5rem', maxWidth: '42rem' }}>
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <p style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</p>
          <h2 style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--forest)', marginBottom: '0.5rem' }}>
            {farmer.status === 'suspended' ? 'Account suspended' : 'Pending admin approval'}
          </h2>
          <p style={{ color: 'var(--moss)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            {farmer.status === 'suspended'
              ? 'Your farmer account is suspended. Contact The Green Guild to resolve this before listing products.'
              : "An admin is reviewing your application. You'll be able to list products once your account is approved."}
          </p>
          <Link href="/dashboard/farmer" className="btn btn-forest">Back to Overview</Link>
        </div>
      </div>
    )
  }

  // Membership: 'pending' (e.g. Hub Membership awaiting payment) still
  // counts as "selected" for now, since subscription payment isn't wired
  // up yet — the free Grower Listing tier activates as 'active' immediately.
  const { data: profile } = await admin.from('profiles').select('membership_grandfathered').eq('id', sessionUser.id).single()
  let membershipStarted = !!profile?.membership_grandfathered
  if (!membershipStarted) {
    const { data: sub } = await admin
      .from('subscriptions')
      .select('id')
      .eq('user_id', sessionUser.id)
      .eq('subscriber_type', 'grower')
      .in('status', ['active', 'pending'])
      .limit(1)
      .maybeSingle()
    membershipStarted = !!sub
  }

  if (!membershipStarted) {
    return (
      <div className="page-pad" style={{ padding: '2.5rem', maxWidth: '42rem' }}>
        <div className="card" style={{ padding: '2.5rem', textAlign: 'center' }}>
          <p style={{ fontSize: '2rem', marginBottom: '1rem' }}>🎫</p>
          <h2 style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--forest)', marginBottom: '0.5rem' }}>Set up your membership first</h2>
          <p style={{ color: 'var(--moss)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            Choose Hub Membership or the free Grower Listing before listing products for sale.
          </p>
          <Link href="/dashboard/farmer/membership" className="btn btn-forest">Set Up Membership →</Link>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
