// src/app/api/orders/[id]/ppod/route.ts
// FIX BUG-03: allDelivered now checks ALL order items (all farmers), not just this farmer's
// FIX BUG-04: Only fires order/delivered ONCE — guards against already-delivered status
// FIX BUG-09: QR code stored in Supabase Storage, not as base64 in DB column

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
      { error: `Cannot upload PPOD for order with status: ${order.status}` },
      { status: 400 }
    )
  }

  const formData = await request.formData()
  const photo = formData.get('photo') as File | null
  const gpsLat = parseFloat(formData.get('gps_lat') as string) || null
  const gpsLng = parseFloat(formData.get('gps_lng') as string) || null
  const orderItemId = formData.get('order_item_id') as string

  if (!photo) return NextResponse.json({ error: 'Photo required' }, { status: 400 })
  if (!orderItemId) return NextResponse.json({ error: 'order_item_id required' }, { status: 400 })

  if (!photo.type.startsWith('image/')) {
    return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
  }
  if (photo.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Image must be under 10MB' }, { status: 400 })
  }

  const { data: orderItem } = await adminSupabase
    .from('order_items')
    .select('id, farmer_id, ppod_url')
    .eq('id', orderItemId)
    .eq('order_id', orderId)
    .eq('farmer_id', farmer.id)
    .single()

  if (!orderItem) {
    return NextResponse.json({ error: 'Order item not found or does not belong to your farm' }, { status: 403 })
  }

  if (orderItem.ppod_url) {
    return NextResponse.json({ error: 'PPOD already uploaded for this item' }, { status: 409 })
  }

  const ext = photo.type === 'image/png' ? 'png' : 'jpg'
  const filename = `ppod/${orderId}/${orderItemId}-${Date.now()}.${ext}`
  const arrayBuffer = await photo.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error: uploadError } = await adminSupabase
    .storage
    .from('delivery-photos')
    .upload(filename, buffer, { contentType: photo.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: 'Photo upload failed: ' + uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = adminSupabase
    .storage
    .from('delivery-photos')
    .getPublicUrl(filename)

  await adminSupabase
    .from('order_items')
    .update({
      ppod_url: publicUrl,
      ppod_gps_lat: gpsLat,
      ppod_gps_lng: gpsLng,
      ppod_timestamp: new Date().toISOString(),
    })
    .eq('id', orderItemId)

  const { data: allOrderItems } = await adminSupabase
    .from('order_items')
    .select('id, ppod_url')
    .eq('order_id', orderId)

  const itemsWithStatus = (allOrderItems || []).map(item =>
    item.id === orderItemId ? { ...item, ppod_url: publicUrl } : item
  )
  const allDelivered = itemsWithStatus.length > 0 && itemsWithStatus.every(item => item.ppod_url)

  if (allDelivered) {
    const { data: updatedOrder } = await adminSupabase
      .from('orders')
      .update({ status: 'delivered' })
      .eq('id', orderId)
      .in('status', ['payment_confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery'])
      .select('id, status')
      .single()

    if (updatedOrder) {
      // Called directly rather than dispatched as an event — this used to go
      // through Inngest, which added a whole external service (with its own
      // credentials to keep valid) for logic that's already idempotent and
      // fast enough to run inline; it's the same function the manual
      // Admin > Orders > "Generate Payouts" button has always called
      // directly. Best-effort, like the QR generation right below it: a
      // Stripe hiccup must not take down the PPOD upload itself, but is
      // worth logging loudly since it means this order's payout didn't fire.
      try {
        await processOrderPayouts(orderId)
      } catch (payoutErr) {
        console.error('[PPOD] processOrderPayouts failed for order', orderId, payoutErr)
      }

      try {
        const qrBuffer = await QRCode.toBuffer(
          JSON.stringify({ order_id: orderId, verified: true }),
          { type: 'png', width: 300 }
        )
        const qrPath = `qr/${orderId}.png`
        await adminSupabase.storage.from('delivery-photos').upload(qrPath, qrBuffer, {
          contentType: 'image/png', upsert: true,
        })
        const { data: { publicUrl: qrUrl } } = adminSupabase.storage
          .from('delivery-photos').getPublicUrl(qrPath)
        await adminSupabase.from('orders').update({ qr_code_url: qrUrl }).eq('id', orderId)
      } catch (qrErr) {
        console.error('QR generation failed (non-blocking):', qrErr)
      }
    }
  }

  return NextResponse.json({
    data: {
      ppod_url: publicUrl,
      timestamp: new Date().toISOString(),
      all_delivered: allDelivered,
    }
  })
}