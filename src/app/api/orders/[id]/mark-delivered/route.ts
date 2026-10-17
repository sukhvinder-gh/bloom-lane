// src/app/api/orders/[id]/mark-delivered/route.ts
//
// Replaces the old photo-proof-of-delivery upload as the farmer's one-click
// "this item is delivered" action — same effects (flips the order to
// 'delivered' once every farmer's items are marked, triggers payouts, issues
// the QR code), just without requiring a photo. Reuses order_items'
// ppod_timestamp column as the per-item "delivered" marker instead of
// ppod_url, so it stays compatible with any pre-existing rows that already
// have both set from the old photo flow.

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'
import { processOrderPayouts } from '@/lib/payouts/processOrderPayouts'
import QRCode from 'qrcode'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params

  const supabase = await createSupabaseServerClient()
  const adminSupabase = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: farmer } = await supabase
    .from('farmers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!farmer) return NextResponse.json({ error: 'Farmer accounts only' }, { status: 403 })

  const { data: order } = await adminSupabase
    .from('orders')
    .select('status, fulfillment_type')
    .eq('id', orderId)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  if (!['payment_confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery'].includes(order.status)) {
    return NextResponse.json(
      { error: `Cannot mark delivered for order with status: ${order.status}` },
      { status: 400 }
    )
  }

  const body = await request.json()
  const orderItemId = body?.order_item_id as string

  if (!orderItemId) return NextResponse.json({ error: 'order_item_id required' }, { status: 400 })

  const { data: orderItem } = await adminSupabase
    .from('order_items')
    .select('id, farmer_id, ppod_timestamp')
    .eq('id', orderItemId)
    .eq('order_id', orderId)
    .eq('farmer_id', farmer.id)
    .single()

  if (!orderItem) {
    return NextResponse.json({ error: 'Order item not found or does not belong to your farm' }, { status: 403 })
  }

  if (orderItem.ppod_timestamp) {
    return NextResponse.json({ error: 'Already marked delivered for this item' }, { status: 409 })
  }

  const deliveredAt = new Date().toISOString()

  await adminSupabase
    .from('order_items')
    .update({ ppod_timestamp: deliveredAt })
    .eq('id', orderItemId)

  const { data: allOrderItems } = await adminSupabase
    .from('order_items')
    .select('id, ppod_timestamp')
    .eq('order_id', orderId)

  const itemsWithStatus = (allOrderItems || []).map(item =>
    item.id === orderItemId ? { ...item, ppod_timestamp: deliveredAt } : item
  )
  const allDelivered = itemsWithStatus.length > 0 && itemsWithStatus.every(item => item.ppod_timestamp)

  if (allDelivered) {
    const { data: updatedOrder } = await adminSupabase
      .from('orders')
      .update({ status: 'delivered' })
      .eq('id', orderId)
      .in('status', ['payment_confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery'])
      .select('id, status')
      .single()

    if (updatedOrder) {
      // Best-effort, same reasoning as the old PPOD route: a Stripe hiccup
      // must not block marking the order delivered, but is worth logging
      // loudly since it means this order's payout didn't fire.
      try {
        await processOrderPayouts(orderId)
      } catch (payoutErr) {
        console.error('[mark-delivered] processOrderPayouts failed for order', orderId, payoutErr)
      }

      try {
        const qrBuffer = await QRCode.toBuffer(
          JSON.stringify({ order_id: orderId, verified: true }),
          { type: 'png', width: 300 }
        )
        const qrPath = `qr/${orderId}.png`
        const adminStorage = adminSupabase.storage.from('delivery-photos')
        await adminStorage.upload(qrPath, qrBuffer, { contentType: 'image/png', upsert: true })
        const { data: { publicUrl: qrUrl } } = adminStorage.getPublicUrl(qrPath)
        await adminSupabase.from('orders').update({ qr_code_url: qrUrl }).eq('id', orderId)
      } catch (qrErr) {
        console.error('QR generation failed (non-blocking):', qrErr)
      }
    }
  }

  return NextResponse.json({
    data: {
      delivered_at: deliveredAt,
      all_delivered: allDelivered,
    }
  })
}
