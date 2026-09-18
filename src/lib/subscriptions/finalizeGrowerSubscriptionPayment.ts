// src/lib/subscriptions/finalizeGrowerSubscriptionPayment.ts
// Activates a grower's Hub Membership once its PaymentIntent succeeds.
// Hub Membership is a fixed-term purchase, not a recurring Stripe
// subscription — expires_at is set once here and the farmer must return to
// pay again after it lapses (see disable_expired_subscriptions(), which
// reads this same expires_at / farmers.subscription_expires_at pair).

import { createAdminClient } from '@/lib/supabase/server'
import { addMonths, addYears } from 'date-fns'
import { sendSubscriptionConfirmation } from '@/lib/email/sendSubscriptionEmail'

function expiryFor(billingPeriod: string, from: Date): Date {
  if (billingPeriod === 'annual') return addYears(from, 1)
  if (billingPeriod === 'seasonal') return addMonths(from, 3)
  return addMonths(from, 1)
}

export async function finalizeGrowerSubscriptionPayment(
  supabase: ReturnType<typeof createAdminClient>,
  paymentIntent: { id: string; amount: number; metadata?: Record<string, string> }
) {
  const subscriptionId = paymentIntent.metadata?.subscription_id
  const userId = paymentIntent.metadata?.user_id
  const billingPeriod = paymentIntent.metadata?.billing_period || 'monthly'

  if (!subscriptionId || !userId) {
    console.error('grower_subscription payment_intent.succeeded missing subscription_id/user_id in metadata')
    return
  }

  const now = new Date()
  const expiresAt = expiryFor(billingPeriod, now)

  // Idempotent against webhook retries — a subscription already activated
  // by this same PaymentIntent is left alone rather than re-extending the
  // expiry from "now" a second time. select('*'), not a named column list —
  // stripe_payment_intent_id may not exist yet if migration 036 hasn't been
  // applied, and naming an unknown column explicitly makes the whole query
  // fail instead of just omitting it, which would otherwise silently skip
  // activation entirely.
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .single()

  if (!sub || (sub.status === 'active' && sub.stripe_payment_intent_id === paymentIntent.id)) return

  // Activation itself must never be blocked by the audit column below —
  // if stripe_payment_intent_id doesn't exist yet (migration not applied),
  // a single combined update would fail entirely and leave a paid grower
  // stuck on 'pending'. Kept as two calls so that can't happen.
  await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      starts_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('id', subscriptionId)

  await supabase
    .from('subscriptions')
    .update({ stripe_payment_intent_id: paymentIntent.id })
    .eq('id', subscriptionId)

  const { data: farmer } = await supabase
    .from('farmers')
    .update({ subscription_expires_at: expiresAt.toISOString() })
    .eq('user_id', userId)
    .select('gst_registered')
    .single()

  const { data: profile } = await supabase.from('profiles').select('email, full_name').eq('id', userId).single()
  if (profile?.email) {
    sendSubscriptionConfirmation({
      to: profile.email,
      name: profile.full_name || 'Grower',
      plan: 'hub_membership',
      billing: billingPeriod,
      amount_cents: paymentIntent.amount,
      gst_registered: !!farmer?.gst_registered,
    }).catch(() => {})
  }
}
