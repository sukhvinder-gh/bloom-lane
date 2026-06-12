import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/utils/permissions'
import { sendOrderConfirmationEmail } from '@/lib/email/sendOrderConfirmationEmail'
import { sendPOEmail } from '@/lib/email/sendPOEmail'

// POST /api/admin/resend-order-emails
// Body: { order_number: "ORD-XXXXXXXX" }
// Resends buyer confirmation + PO emails to all growers for a given order.
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!isAdminRole(profile?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { order_number, send_to = 'all' } = await request.json()
  if (!order_number) return NextResponse.json({ error: 'order_number required' }, { status: 400 })
  // send_to: 'all' | 'buyer' | 'growers'

  // Fetch order by order_number
  const { data: order, error: orderErr } = await admin
    .from('orders')
    .select('id, order_number, created_at, grower_fulfillment_date, fulfillment_type, hub_id, buyer_id, subtotal_cents, gst_cents, delivery_fee_cents, total_cents, delivery_address, delivery_suburb, delivery_state')
    .eq('order_number', order_number)
    .single()

  if (orderErr || !order) {
    return NextResponse.json({ error: `Order ${order_number} not found` }, { status: 404 })
  }

  // Fetch hub address if hub_pickup
  let hubAddress: string | null = null
  if (order.fulfillment_type === 'hub_pickup' && (order as any).hub_id) {
    const { data: zone } = await admin
      .from('delivery_zones')
      .select('hub_address, hub_suburb, hub_state')
      .eq('id', (order as any).hub_id)
      .single()
    if (zone) hubAddress = [zone.hub_address, zone.hub_suburb, zone.hub_state].filter(Boolean).join(', ')
  }

  // Fetch all order items
  const { data: items, error: itemsErr } = await admin
    .from('order_items')
    .select('id, farmer_id, quantity, unit_price_cents, subtotal_cents, products(name, unit, is_gst_free)')
    .eq('order_id', order.id)

  if (itemsErr || !items || items.length === 0) {
    return NextResponse.json({ error: 'No items found for order' }, { status: 500 })
  }

  // Fetch buyer profile
  const { data: buyerProfile } = await admin
    .from('profiles')
    .select('full_name, email')
    .eq('id', order.buyer_id)
    .single()

  const results: Record<string, string> = {}

  // 1. Buyer order confirmation
  if (send_to !== 'growers' && buyerProfile?.email) {
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
      results[`buyer (${buyerProfile.email})`] = 'OK'
    } catch (err: any) {
      results[`buyer (${buyerProfile.email})`] = `FAIL: ${err.message}`
    }
  } else if (send_to === 'growers') {
    results['buyer'] = 'SKIP: growers-only send'
  } else {
    results['buyer'] = 'SKIP: no email on profile'
  }

  // 2. Per-grower PO emails
  if (send_to === 'buyer') {
    return NextResponse.json({ allOk: Object.values(results).every(v => v === 'OK' || v.startsWith('SKIP')), order_number, results })
  }
  const byFarmer = new Map<string, typeof items>()
  for (const item of items) {
    const existing = byFarmer.get(item.farmer_id) || []
    existing.push(item)
    byFarmer.set(item.farmer_id, existing)
  }

  const farmerIds = [...byFarmer.keys()]
  const { data: farmers } = await admin
    .from('farmers')
    .select('id, business_name, abn, email, suburb, state, commission_rate')
    .in('id', farmerIds)

  await Promise.allSettled(
    (farmers || []).map(async farmer => {
      const key = `grower: ${farmer.business_name} (${farmer.email || 'no email'})`
      if (!farmer.email) { results[key] = 'SKIP: no email'; return }

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
        results[key] = 'OK'
      } catch (err: any) {
        results[key] = `FAIL: ${err.message}`
      }
    })
  )

  const allOk = Object.values(results).every(v => v === 'OK' || v.startsWith('SKIP'))
  return NextResponse.json({ allOk, order_number, results })
}
