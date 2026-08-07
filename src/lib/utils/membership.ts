// src/lib/utils/membership.ts
//
// Shared gate: "growers should not be able to sell until their membership
// has been paid for and approved." Buyer accounts are free — buying was
// never meant to require a paid/subscribed membership, so any buyer role
// short-circuits to true here rather than needing a subscriptions row.
// Every farmer account that existed before migration 028 is grandfathered
// as active — this only ever blocks farmer accounts created after that
// point that haven't completed a subscription (the free Grower Listing
// tier counts too, since it still requires an explicit signup step rather
// than being the default state).

import { createAdminClient } from '@/lib/supabase/server'

const FREE_ROLES = new Set(['buyer_b2b', 'buyer_b2c'])

export async function hasActiveMembership(userId: string): Promise<boolean> {
  const admin = createAdminClient()

  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('role, membership_grandfathered')
    .eq('id', userId)
    .single()

  // Fail safe, not closed: if the profile can't be read (e.g. migration 028
  // hasn't been applied yet), don't let that outage silently block every
  // buyer/seller on the platform — allow through and log it.
  if (profileErr) {
    console.error('[membership] Could not read profile — allowing through. Has migration 028 been applied?', profileErr.message)
    return true
  }

  if (profile?.role && FREE_ROLES.has(profile.role)) return true
  if (profile?.membership_grandfathered) return true

  const { data: activeSub } = await admin
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()

  return !!activeSub
}
