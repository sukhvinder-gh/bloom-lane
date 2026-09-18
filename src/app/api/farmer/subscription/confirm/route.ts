import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { finalizeGrowerSubscriptionPayment } from '@/lib/subscriptions/finalizeGrowerSubscriptionPayment'

// POST — called by the browser right after Stripe confirms payment
// succeeded, so activation doesn't have to wait on the async webhook (which
// can lag a second or more behind, or fail to reach this environment at
// all). Asks Stripe directly for the PaymentIntent's real status rather than
// trusting anything the client claims, then reuses the same finalizer the
// webhook calls — that finalizer is idempotent, so it's safe for both paths
// to run, in either order.
export async function POST() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: sub } = await admin
    .from('subscriptions')
    .select('id, status, stripe_payment_intent_id, amount_cents')
    .eq('user_id', user.id)
    .eq('subscriber_type', 'grower')
    .eq('plan', 'hub_membership')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!sub) return NextResponse.json({ error: 'No Hub Membership subscription found' }, { status: 404 })
  if (sub.status === 'active') return NextResponse.json({ ok: true, subscription: sub })
  if (!sub.stripe_payment_intent_id) return NextResponse.json({ error: 'No payment in progress for this subscription' }, { status: 400 })

  const paymentIntent = await stripe.paymentIntents.retrieve(sub.stripe_payment_intent_id)
  if (paymentIntent.status !== 'succeeded') {
    return NextResponse.json({ ok: false, subscription: sub, paymentStatus: paymentIntent.status })
  }

  await finalizeGrowerSubscriptionPayment(admin, paymentIntent)

  const { data: updated } = await admin.from('subscriptions').select('*').eq('id', sub.id).single()
  return NextResponse.json({ ok: true, subscription: updated })
}
