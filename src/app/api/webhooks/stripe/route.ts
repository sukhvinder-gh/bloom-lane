// src/app/api/webhooks/stripe/route.ts
// FIX BUG-09: QR code now stored in Supabase Storage as PNG — not base64 data URI in DB column

import { NextRequest, NextResponse } from 'next/server'
import { constructWebhookEvent } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/server'
import QRCode from 'qrcode'
import { sendPOEmail } from '@/lib/email/sendPOEmail'

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
      const orderId = pi.metadata?.order_id

      if (!orderId) {
        console.error('payment_intent.succeeded missing order_id in metadata')
        break
      }

      let qrCodeUrl: string | null = null
      try {
        const qrBuffer = await QRCode.toBuffer(
          JSON.stringify({ order_id: orderId, verified: true }),
          { type: 'png', width: 300 }
        )
        const qrPath = `qr/${orderId}.png`
        const { error: qrUploadErr } = await supabase.storage
          .from('delivery-photos')
          .upload(qrPath, qrBuffer, { contentType: 'image/png', upsert: true })

        if (!qrUploadErr) {
          const { data: { publicUrl } } = supabase.storage
            .from('delivery-photos')
            .getPublicUrl(qrPath)
          qrCodeUrl = publicUrl
        }
      } catch (qrErr) {
        console.error('QR code generation failed (non-blocking):', qrErr)
      }

      await supabase
        .from('orders')
        .update({
          status: 'payment_confirmed',
          stripe_payment_status: 'succeeded',
          ...(qrCodeUrl ? { qr_code_url: qrCodeUrl } : {}),
        })
        .eq('id', orderId)

      // Send one PO email per grower (non-blocking — webhook must return quickly)
      sendPOEmailsForOrder(supabase, orderId).catch(err =>
        console.error('PO email dispatch failed (non-blocking):', err)
      )

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

    case 'transfer.created':
    case 'transfer.paid': {
      const transfer = event.data.object as any
      if (transfer.metadata?.order_id && transfer.metadata?.farmer_id) {
        await supabase
          .from('payouts')
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .eq('stripe_transfer_id', transfer.id)
      }
      break
    }

    case 'transfer.failed': {
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

async function sendPOEmailsForOrder(supabase: ReturnType<typeof createAdminClient>, orderId: string) {
  // Fetch order header
  const { data: order } = await supabase
    .from('orders')
    .select('order_number, created_at, grower_fulfillment_date, florist_delivery_date, fulfillment_type, buyer_is_b2b, hub_id')
    .eq('id', orderId)
    .single()
  if (!order) return

  // Fetch hub address if hub_pickup
  let hubAddress: string | null = null
  if (order.fulfillment_type === 'hub_pickup' && (order as any).hub_id) {
    const { data: zone } = await supabase
      .from('delivery_zones')
      .select('hub_address, hub_suburb, hub_state')
      .eq('id', (order as any).hub_id)
      .single()
    if (zone) {
      hubAddress = [zone.hub_address, zone.hub_suburb, zone.hub_state].filter(Boolean).join(', ')
    }
  }

  // Fetch all items with farmer + product info
  const { data: items } = await supabase
    .from('order_items')
    .select('id, farmer_id, quantity, unit_price_cents, subtotal_cents, products(name, unit)')
    .eq('order_id', orderId)
  if (!items || items.length === 0) return

  // Group items by farmer_id
  const byFarmer = new Map<string, typeof items>()
  for (const item of items) {
    const existing = byFarmer.get(item.farmer_id) || []
    existing.push(item)
    byFarmer.set(item.farmer_id, existing)
  }

  // Fetch all relevant farmers in one query
  const farmerIds = [...byFarmer.keys()]
  const { data: farmers } = await supabase
    .from('farmers')
    .select('id, business_name, abn, email, suburb, state, commission_rate')
    .in('id', farmerIds)
  if (!farmers) return

  // Send one email per farmer
  await Promise.allSettled(
    farmers.map(async farmer => {
      if (!farmer.email) return
      const farmerItems = byFarmer.get(farmer.id) || []

      await sendPOEmail(farmer.email, {
        order_number: order.order_number,
        created_at: order.created_at,
        grower_fulfillment_date: order.grower_fulfillment_date,
        fulfillment_type: order.fulfillment_type,
        hub_address: hubAddress,
        farmer_business_name: farmer.business_name,
        farmer_abn: farmer.abn,
        farmer_suburb: farmer.suburb,
        farmer_state: farmer.state,
        commission_rate: farmer.commission_rate ?? 0.10,
        items: farmerItems.map(i => ({
          id: i.id,
          quantity: i.quantity,
          unit_price_cents: i.unit_price_cents,
          subtotal_cents: i.subtotal_cents,
          product_name: (i as any).products?.name ?? '',
          product_unit: (i as any).products?.unit ?? '',
        })),
      })
    })
  )
}