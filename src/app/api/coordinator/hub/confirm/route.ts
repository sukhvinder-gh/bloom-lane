import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { finalizeCoordinatorRegistrationPayment } from '@/lib/subscriptions/finalizeCoordinatorRegistrationPayment'

// POST — called by the browser right after Stripe confirms the registration
// fee, so the coordinator's subscription doesn't have to wait on the async
// webhook. The PaymentIntent is fetched from Stripe and must belong to this
// user and this payment type; nothing the client says about its status is
// trusted. The finalizer is idempotent, so running alongside the webhook is safe.
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { payment_intent_id } = await request.json().catch(() => ({}))
  if (typeof payment_intent_id !== 'string' || !payment_intent_id.startsWith('pi_')) {
    return NextResponse.json({ error: 'payment_intent_id required' }, { status: 400 })
  }

  const pi = await stripe.paymentIntents.retrieve(payment_intent_id)
  if (pi.metadata?.type !== 'coordinator_registration' || pi.metadata?.user_id !== user.id) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  }
  if (pi.status !== 'succeeded') {
    return NextResponse.json({ ok: false, paymentStatus: pi.status })
  }

  await finalizeCoordinatorRegistrationPayment(createAdminClient(), pi)
  return NextResponse.json({ ok: true })
}
