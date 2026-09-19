// src/app/api/webhooks/stripe/route.ts
// FIX BUG-09: QR code now stored in Supabase Storage as PNG — not base64 data URI in DB column

import { NextRequest, NextResponse } from 'next/server'
import { constructWebhookEvent } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/server'
import { finalizeOrderPayment } from '@/lib/orders/finalizeOrderPayment'
import { finalizeGrowerSubscriptionPayment } from '@/lib/subscriptions/finalizeGrowerSubscriptionPayment'
import { finalizeCoordinatorRegistrationPayment } from '@/lib/subscriptions/finalizeCoordinatorRegistrationPayment'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event
  try {
    event = constructWebhookEvent(body, signature)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const eventType = event.type as string

  switch (eventType) {
    case 'payment_intent.succeeded': {
      const pi = event.data.object as any

      // Grower Hub Membership payments share this same event type but
      // aren't an order — route them to their own finalizer instead.
      if (pi.metadata?.type === 'grower_subscription') {
        await finalizeGrowerSubscriptionPayment(supabase, pi)
        break
      }
      if (pi.metadata?.type === 'coordinator_registration') {
        await finalizeCoordinatorRegistrationPayment(supabase, pi)
        break
      }

      const orderId = pi.metadata?.order_id

      if (!orderId) {
        console.error('payment_intent.succeeded missing order_id in metadata')
        break
      }

      await finalizeOrderPayment(supabase, orderId, pi.id)

      break
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object as any
      const orderId = pi.metadata?.order_id

      if (!orderId) break

      const { data: orderItems } = await supabase
        .from('order_items')
        .select('product_id, quantity, is_b2b')
        .eq('order_id', orderId)

      if (orderItems && orderItems.length > 0) {
        const { error: releaseErr } = await supabase.rpc('checkout_release_stock', {
          p_items: orderItems.map(item => ({
            product_id: item.product_id,
            quantity: item.quantity,
            is_b2b: item.is_b2b,
          }))
        })
        if (releaseErr) console.error('Stock release on payment_failed error:', releaseErr)
      }

      await supabase
        .from('orders')
        .update({ status: 'cancelled', stripe_payment_status: 'failed' })
        .eq('id', orderId)

      break
    }

    case 'payment_intent.canceled': {
      const pi = event.data.object as any
      const orderId = pi.metadata?.order_id
      if (!orderId) break

      const { data: orderItems } = await supabase
        .from('order_items').select('product_id, quantity, is_b2b').eq('order_id', orderId)

      if (orderItems && orderItems.length > 0) {
        await supabase.rpc('checkout_release_stock', {
          p_items: orderItems.map(i => ({ product_id: i.product_id, quantity: i.quantity, is_b2b: i.is_b2b }))
        })
      }
      await supabase.from('orders').update({ status: 'cancelled', stripe_payment_status: 'canceled' }).eq('id', orderId)
      break
    }

    // Stripe has no transfer.paid/transfer.failed events — a Transfer to a
    // connected account's balance is synchronous, so transfer.created IS the
    // success signal (if the API call that created it succeeded, the funds
    // moved). transfer.reversed is the real "something went wrong after the
    // fact" signal, e.g. the connected account couldn't accept the funds.
    case 'transfer.created': {
      const transfer = event.data.object as any
      if (transfer.metadata?.order_id && transfer.metadata?.farmer_id) {
        await supabase
          .from('payouts')
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .eq('stripe_transfer_id', transfer.id)
      }
      break
    }

    case 'transfer.reversed': {
      const transfer = event.data.object as any
      await supabase
        .from('payouts')
        .update({ status: 'failed' })
        .eq('stripe_transfer_id', transfer.id)
      break
    }

    default:
      console.log(`Unhandled Stripe event: ${eventType}`)
  }

  return NextResponse.json({ received: true })
}