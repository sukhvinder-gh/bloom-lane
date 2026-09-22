import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

// POST — resume payment on an already-pending coordinator registration fee
// (e.g. the coordinator registered, then left before paying). Issues a
// fresh PaymentIntent for the same subscription, same reasoning as the
// equivalent grower-membership resume endpoint.
export async function POST() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: sub } = await admin
    .from('subscriptions')
    .select('id, amount_cents, status')
    .eq('user_id', user.id)
    .eq('subscriber_type', 'coordinator')
    .eq('plan', 'coordinator')
    .eq('status', 'pending')
    .maybeSingle()

  if (!sub) return NextResponse.json({ error: 'No pending hub registration payment found' }, { status: 404 })

  const { data: hub } = await admin.from('hubs').select('id').eq('coordinator_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle()

  let paymentIntent
  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount: sub.amount_cents,
      currency: 'aud',
      metadata: {
        type: 'coordinator_registration',
        subscription_id: sub.id,
        user_id: user.id,
        hub_id: hub?.id || '',
      },
      automatic_payment_methods: { enabled: true },
    })
  } catch {
    return NextResponse.json({ error: 'Payment setup failed. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ client_secret: paymentIntent.client_secret, amount_cents: sub.amount_cents })
}
