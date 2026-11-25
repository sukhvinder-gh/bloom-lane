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

/**
 * Grant the free "Grower Listing" tier directly — same end state a grower
 * reaches by submitting the free-plan form at /dashboard/farmer/membership
 * (src/app/api/farmer/subscription/route.ts), just triggered from admin's
 * side (interest-approval) instead of requiring the grower to visit that
 * page themselves before they can list anything. Idempotent: upserts on the
 * same (user_id, subscriber_type, plan) key that route already relies on.
 */
export async function grantFreeGrowerMembership(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
): Promise<{ error: string | null }> {
  const { error: subErr } = await admin
    .from('subscriptions')
    .upsert({
      user_id: userId,
      subscriber_type: 'grower',
      plan: 'wholesale_collection',
      billing_period: 'free',
      status: 'active',
      starts_at: new Date().toISOString(),
      expires_at: null,
      amount_cents: 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,subscriber_type,plan' })

  if (subErr) return { error: subErr.message }

  // Mirrors the subscription onto farmers' own display columns, same as the
  // self-serve route does — keeps GET /api/farmer/subscription consistent.
  await admin
    .from('farmers')
    .update({ subscription_type: 'wholesale_collection', subscription_tier: null, updated_at: new Date().toISOString() })
    .eq('user_id', userId)

  return { error: null }
}
