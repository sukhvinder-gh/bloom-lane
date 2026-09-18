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
  // expiry from "now" a second time.
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('id, status, stripe_payment_intent_id')
    .eq('id', subscriptionId)
    .single()

  if (!sub || (sub.status === 'active' && sub.stripe_payment_intent_id === paymentIntent.id)) return

  await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      starts_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      stripe_payment_intent_id: paymentIntent.id,
      updated_at: now.toISOString(),
    })
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
