// src/lib/utils/membership.ts
//
// Shared gate: "users should not be able to buy or sell until their
// membership has been paid for and approved." Every account that existed
// before migration 028 is grandfathered as active — this only ever blocks
// accounts created after that point that haven't completed a subscription
// (the free tiers count too, since they still require an explicit signup
// step rather than being the default state).

import { createAdminClient } from '@/lib/supabase/server'

export async function hasActiveMembership(userId: string): Promise<boolean> {
  const admin = createAdminClient()

  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('membership_grandfathered')
    .eq('id', userId)
    .single()

  // Fail safe, not closed: if the grandfathering column can't be read (e.g.
  // migration 028 hasn't been applied yet), don't let that outage silently
  // block every buyer/seller on the platform — allow through and log it.
  if (profileErr) {
    console.error('[membership] Could not read membership_grandfathered — allowing through. Has migration 028 been applied?', profileErr.message)
    return true
  }

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
