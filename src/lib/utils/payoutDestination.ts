// src/lib/utils/payoutDestination.ts
// Decides where a grower's payout Stripe transfer actually goes: their hub's
// connected account if they belong to one and it's finished onboarding,
// otherwise the grower's own account directly. A hub mid-onboarding (or one
// that never connects) must never block a grower's payout — falling back to
// paying the grower directly is the safe default, not an error case.

export type PayoutFarmer = {
  id: string
  stripe_account_id: string | null
  stripe_onboarding_complete: boolean | null
  hubs?: { id: string; stripe_account_id: string | null; stripe_onboarding_complete: boolean | null } | null
}

export type PayoutDestination = { stripeAccountId: string; hubId: string | null }

export function resolvePayoutDestination(farmer: PayoutFarmer): PayoutDestination | null {
  const hub = farmer.hubs
  if (hub?.stripe_account_id && hub.stripe_onboarding_complete) {
    return { stripeAccountId: hub.stripe_account_id, hubId: hub.id }
  }
  if (farmer.stripe_account_id && farmer.stripe_onboarding_complete) {
    return { stripeAccountId: farmer.stripe_account_id, hubId: null }
  }
  return null
}
