import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

// POST — resume payment on an already-pending Hub Membership subscription
// (e.g. the farmer submitted the membership form, then left before paying).
// Issues a fresh PaymentIntent for the same subscription rather than reusing
// a possibly-stale one, same reasoning as the main subscription route.
export async function POST() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: sub } = await admin
    .from('subscriptions')
    .select('id, plan, billing_period, amount_cents, status')
    .eq('user_id', user.id)
    .eq('subscriber_type', 'grower')
    .eq('plan', 'hub_membership')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!sub) return NextResponse.json({ error: 'No pending Hub Membership payment found' }, { status: 404 })

  let paymentIntent
  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount: sub.amount_cents,
      currency: 'aud',
      metadata: {
        type: 'grower_subscription',
        subscription_id: sub.id,
        user_id: user.id,
        billing_period: sub.billing_period || 'monthly',
      },
      automatic_payment_methods: { enabled: true },
    })
  } catch {
    return NextResponse.json({ error: 'Payment setup failed. Please try again.' }, { status: 500 })
  }

  await admin.from('subscriptions').update({ stripe_payment_intent_id: paymentIntent.id }).eq('id', sub.id)

  return NextResponse.json({ client_secret: paymentIntent.client_secret, amount_cents: sub.amount_cents })
}
