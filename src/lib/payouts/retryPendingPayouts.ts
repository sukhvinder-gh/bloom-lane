// src/lib/payouts/retryPendingPayouts.ts
//
// A grower can sell before they've connected Stripe — onboarding isn't a
// gate on listing/selling, only on actually being paid. When their sale is
// ready but they have no working Stripe destination yet, the payout is held
// as a 'pending' row instead of just being dropped (see finalizePayout in
// src/lib/inngest/functions.ts) and they're emailed to connect one.
//
// This is the other half of that: called the moment a grower finishes
// Stripe onboarding (src/app/dashboard/farmer/stripe/complete), so the
// payout that was waiting on them fires immediately, rather than sitting
// there until the next unrelated sale happens to retrigger it.

import { createAdminClient } from '@/lib/supabase/server'
import { createFarmerPayout } from '@/lib/stripe'
import { resolvePayoutDestination } from '@/lib/utils/payoutDestination'

export async function retryPendingPayoutsForFarmer(
  supabase: ReturnType<typeof createAdminClient>,
  farmerId: string
): Promise<{ retried: number; paid: number }> {
  const { data: pending } = await supabase
    .from('payouts')
    .select('id, net_amount_cents, order_id')
    .eq('farmer_id', farmerId)
    .eq('status', 'pending')
    .is('stripe_transfer_id', null)

  if (!pending || pending.length === 0) return { retried: 0, paid: 0 }

  // select('*'), not a named list — hubs/stripe columns may not exist yet if
  // migration 040 hasn't been applied; falls back to the farmer's own account only.
  let { data: farmer, error } = await supabase
    .from('farmers')
    .select('id, stripe_account_id, stripe_onboarding_complete, hub_id, hubs(id, stripe_account_id, stripe_onboarding_complete)')
    .eq('id', farmerId)
    .single()
  if (error) {
    ;({ data: farmer } = await supabase
      .from('farmers')
      .select('id, stripe_account_id, stripe_onboarding_complete')
      .eq('id', farmerId)
      .single())
  }
  if (!farmer) return { retried: pending.length, paid: 0 }

  const destination = resolvePayoutDestination(farmer as any)
  if (!destination) return { retried: pending.length, paid: 0 }

  let paid = 0
  for (const payout of pending) {
    try {
      const transfer = await createFarmerPayout({
        stripeAccountId: destination.stripeAccountId,
        netAmountCents: payout.net_amount_cents,
        orderId: payout.order_id || '',
        farmerId,
        hubId: destination.hubId ?? undefined,
      })
      const update: Record<string, unknown> = { stripe_transfer_id: transfer.id, status: 'paid', paid_at: new Date().toISOString() }
      if (destination.hubId) update.paid_to_hub_id = destination.hubId
      let { error: updateErr } = await supabase.from('payouts').update(update).eq('id', payout.id)
      if (updateErr && destination.hubId && /paid_to_hub_id/.test(updateErr.message)) {
        delete update.paid_to_hub_id
        await supabase.from('payouts').update(update).eq('id', payout.id)
      }
      paid++
    } catch (err) {
      console.error('[retryPendingPayouts] transfer failed for payout', payout.id, err)
      await supabase.from('payouts').update({ status: 'failed' }).eq('id', payout.id)
    }
  }

  return { retried: pending.length, paid }
}
