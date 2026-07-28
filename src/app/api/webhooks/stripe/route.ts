// src/app/api/webhooks/stripe/route.ts
// FIX BUG-09: QR code now stored in Supabase Storage as PNG — not base64 data URI in DB column

import { NextRequest, NextResponse } from 'next/server'
import { constructWebhookEvent } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/server'
import QRCode from 'qrcode'
import { sendPOEmail } from '@/lib/email/sendPOEmail'
import { sendOrderConfirmationEmail } from '@/lib/email/sendOrderConfirmationEmail'

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

      // Create purchase_orders rows (one per farmer) — idempotent via ignoreDuplicates.
      // Growers the buyer chose farm pickup for get pickup_method set here, since
      // POs don't exist until now (order.farm_pickup_farmer_ids is the snapshot
      // taken at checkout).
      try {
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('farmer_id')
          .eq('order_id', orderId)

        const { data: orderRow } = await supabase
          .from('orders')
          .select('farm_pickup_farmer_ids')
          .eq('id', orderId)
          .single()
        const farmPickupIds = new Set((orderRow as any)?.farm_pickup_farmer_ids || [])

        if (orderItems && orderItems.length > 0) {
          const farmerIds = [...new Set(orderItems.map(i => i.farmer_id))]
          await supabase
            .from('purchase_orders')
            .upsert(
              farmerIds.map(farmerId => ({
                order_id: orderId,
                farmer_id: farmerId,
                status: 'pending',
                pickup_method: farmPickupIds.has(farmerId) ? 'farm_pickup' : 'standard',
              })),
              { onConflict: 'order_id,farmer_id', ignoreDuplicates: true }
            )
        }
      } catch (poErr) {
        console.error('[PO] purchase_orders upsert failed for order', orderId, poErr)
      }

      // Send buyer confirmation + per-grower PO emails (non-blocking — webhook must return quickly)
      sendAllOrderEmails(supabase, orderId).catch(err =>
        console.error('[EMAIL] Order emails failed for order', orderId, err)
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

async function sendAllOrderEmails(supabase: ReturnType<typeof createAdminClient>, orderId: string) {
  // Fetch order header + buyer profile
  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('order_number, created_at, grower_fulfillment_date, florist_delivery_date, fulfillment_type, buyer_is_b2b, hub_id, buyer_id, subtotal_cents, gst_cents, delivery_fee_cents, total_cents, delivery_address, delivery_suburb, delivery_state')
    .eq('id', orderId)
    .single()
  if (orderErr || !order) { console.error('[EMAIL] Order fetch failed:', orderErr); return }

  // Fetch hub address if hub_pickup
  let hubAddress: string | null = null
  if (order.fulfillment_type === 'hub_pickup' && (order as any).hub_id) {
    const { data: zone } = await supabase
      .from('delivery_zones')
      .select('hub_address, hub_suburb, hub_state')
      .eq('id', (order as any).hub_id)
      .single()
    if (zone) hubAddress = [zone.hub_address, zone.hub_suburb, zone.hub_state].filter(Boolean).join(', ')
  }

  // Fetch all items with farmer + product info
  const { data: items, error: itemsErr } = await supabase
    .from('order_items')
    .select('id, farmer_id, quantity, unit_price_cents, subtotal_cents, is_b2b, gst_applied, gst_cents, products(name, unit, is_gst_free)')
    .eq('order_id', orderId)
  if (itemsErr || !items || items.length === 0) { console.error('[EMAIL] Items fetch failed:', itemsErr); return }

  // Fetch buyer profile — needed for both the confirmation email and to show
  // who placed the order on each grower's PO
  const { data: buyerProfile } = await supabase
    .from('profiles')
    .select('full_name, business_name, email')
    .eq('id', (order as any).buyer_id)
    .single()

  // --- 1. Buyer order confirmation ---
  if (buyerProfile?.email) {
    try {
      await sendOrderConfirmationEmail({
        order_number: order.order_number,
        created_at: order.created_at,
        buyer_email: buyerProfile.email,
        buyer_name: buyerProfile.full_name || 'Valued Customer',
        fulfillment_type: order.fulfillment_type,
        delivery_address: (order as any).delivery_address,
        delivery_suburb: (order as any).delivery_suburb,
        delivery_state: (order as any).delivery_state,
        subtotal_cents: (order as any).subtotal_cents,
        gst_cents: (order as any).gst_cents ?? 0,
        delivery_fee_cents: (order as any).delivery_fee_cents ?? 0,
        total_cents: (order as any).total_cents,
        items: items.map(i => ({
          product_name: (i as any).products?.name ?? '',
          product_unit: (i as any).products?.unit ?? '',
          quantity: i.quantity,
          subtotal_cents: i.subtotal_cents,
          is_gst_free: (i as any).products?.is_gst_free ?? false,
        })),
      })
      console.log('[EMAIL] Buyer confirmation sent to', buyerProfile.email)
    } catch (err) {
      console.error('[EMAIL] Buyer confirmation failed for order', order.order_number, err)
    }
  } else {
    console.warn('[EMAIL] No buyer email found for order', order.order_number)
  }

  // --- 2. Per-grower PO emails ---
  const byFarmer = new Map<string, typeof items>()
  for (const item of items) {
    const existing = byFarmer.get(item.farmer_id) || []
    existing.push(item)
    byFarmer.set(item.farmer_id, existing)
  }

  const farmerIds = [...byFarmer.keys()]
  const { data: farmers } = await supabase
    .from('farmers')
    .select('id, business_name, abn, email, suburb, state, commission_rate, gst_registered')
    .in('id', farmerIds)
  if (!farmers) { console.error('[EMAIL] Farmers fetch failed'); return }

  await Promise.allSettled(
    farmers.map(async farmer => {
      if (!farmer.email) { console.warn('[EMAIL] No email for farmer', farmer.id); return }
      const farmerItems = byFarmer.get(farmer.id) || []
      try {
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
          farmer_gst_registered: (farmer as any).gst_registered ?? false,
          buyer_business_name: buyerProfile?.business_name ?? null,
          buyer_full_name: buyerProfile?.full_name ?? null,
          buyer_email: buyerProfile?.email ?? null,
          commission_rate: farmer.commission_rate ?? 0.10,
          items: farmerItems.map(i => ({
            id: i.id,
            quantity: i.quantity,
            unit_price_cents: i.unit_price_cents,
            subtotal_cents: i.subtotal_cents,
            product_name: (i as any).products?.name ?? '',
            product_unit: (i as any).products?.unit ?? '',
            gst_applied: (i as any).gst_applied ?? false,
            gst_cents: (i as any).gst_cents ?? 0,
          })),
        })
        console.log('[EMAIL] PO sent to farmer', farmer.email)
      } catch (err) {
        console.error('[EMAIL] PO email failed for farmer', farmer.email, err)
      }
    })
  )
}