// src/app/api/orders/route.ts
// FIX BUG-01: order_items insert failure now fully rolls back stock + order
// FIX BUG-10: min_order_b2b enforced per item
// FIX BUG-14: B2B buyer with unverified ABN gets explicit error, not silent B2C downgrade

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { createPaymentIntent } from '@/lib/stripe'
import { getBuyerUnitPrice, calculateOrderTotals } from '@/lib/utils/pricing'
import { isMarketOpen } from '@/lib/utils/timezone'
import { z } from 'zod'

const checkoutSchema = z.object({
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).min(1),
  fulfillment_type: z.enum(['direct_delivery', 'hub_pickup']),
  delivery_address: z.string().optional(),
  delivery_suburb: z.string().optional(),
  delivery_state: z.string().optional(),
  delivery_postcode: z.string().optional(),
  hub_id: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const adminSupabase = await createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!isMarketOpen()) {
    return NextResponse.json(
      { error: 'Market is currently closed. Opens Wednesday 8:00 AM AEST.' },
      { status: 400 }
    )
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, abn_verified')
    .eq('id', user.id)
    .single()

  // BUG-14 FIX: B2B buyer with unverified ABN gets explicit error
  if (profile?.role === 'buyer_b2b' && !profile?.abn_verified) {
    return NextResponse.json(
      { error: 'Your ABN is not yet verified. Wholesale purchasing requires a verified ABN. Please check your email or contact support.' },
      { status: 403 }
    )
  }

  const isB2B = profile?.role === 'buyer_b2b' && profile?.abn_verified === true

  const body = await request.json()
  const parsed = checkoutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { items, fulfillment_type, hub_id, delivery_address,
    delivery_suburb, delivery_state, delivery_postcode, notes } = parsed.data

  if (fulfillment_type === 'hub_pickup' && !hub_id) {
    return NextResponse.json({ error: 'Hub ID required for hub pickup' }, { status: 400 })
  }
  if (fulfillment_type === 'direct_delivery' && !delivery_address) {
    return NextResponse.json({ error: 'Delivery address required' }, { status: 400 })
  }

  // Fetch product details first for validation
  const productIds = items.map(i => i.product_id)
  const { data: products } = await supabase
    .from('products')
    .select('id, name, wholesale_price, b2c_markup_pct, is_gst_free, farmer_id, min_order_b2b, is_listed_this_week, is_active')
    .in('id', productIds)

  if (!products || products.length !== productIds.length) {
    return NextResponse.json({ error: 'One or more products not found' }, { status: 404 })
  }

  // Verify all products are still listed and active
  for (const product of products) {
    if (!product.is_active || !product.is_listed_this_week) {
      return NextResponse.json(
        { error: `"${product.name}" is no longer available this week` },
        { status: 409 }
      )
    }
  }

  // BUG-10 FIX: Enforce min_order_b2b per item
  if (isB2B) {
    for (const item of items) {
      const product = products.find(p => p.id === item.product_id)!
      if (item.quantity < product.min_order_b2b) {
        return NextResponse.json(
          { error: `Minimum order for "${product.name}" is ${product.min_order_b2b} ${product.min_order_b2b === 1 ? 'unit' : 'units'}` },
          { status: 400 }
        )
      }
    }
  }

  // Atomic stock check & reservation
  const { data: stockResult, error: stockError } = await adminSupabase
    .rpc('checkout_reserve_stock', {
      p_items: items.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        is_b2b: isB2B,
      })),
    })

  if (stockError || !stockResult?.success) {
    return NextResponse.json(
      { error: stockResult?.error || 'One or more items are out of stock. Please refresh your cart.' },
      { status: 409 }
    )
  }

  // Build order items with prices
  const orderItems = items.map(item => {
    const product = products.find(p => p.id === item.product_id)!
    const unit_price = getBuyerUnitPrice(product, isB2B)
    return {
      product_id: item.product_id,
      farmer_id: product.farmer_id,
      quantity: item.quantity,
      unit_price_cents: unit_price,
      subtotal_cents: unit_price * item.quantity,
      is_b2b: isB2B,
    }
  })

  // Get delivery fee
  let deliveryFeeCents = 0
  if (fulfillment_type === 'direct_delivery') {
    const { data: config } = await supabase
      .from('config').select('value').eq('key', 'delivery_fee_cents').single()
    deliveryFeeCents = parseInt(config?.value || '2000')
  }

  const totals = calculateOrderTotals(orderItems, deliveryFeeCents, isB2B)

  // Create order
  const { data: order, error: orderError } = await adminSupabase
    .from('orders')
    .insert({
      buyer_id: user.id,
      status: 'pending_payment',
      fulfillment_type,
      delivery_address,
      delivery_suburb,
      delivery_state,
      delivery_postcode,
      hub_id,
      subtotal_cents: totals.subtotal,
      delivery_fee_cents: totals.delivery,
      gst_cents: totals.gst,
      total_cents: totals.total,
      buyer_is_b2b: isB2B,
      notes,
    })
    .select()
    .single()

  if (orderError || !order) {
    await adminSupabase.rpc('checkout_release_stock', { p_items: items.map(i => ({ ...i, is_b2b: isB2B })) })
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
  }

  // BUG-01 FIX: Catch order_items insert failure and fully roll back
  const { error: itemsError } = await adminSupabase
    .from('order_items')
    .insert(orderItems.map(item => ({ ...item, order_id: order.id })))

  if (itemsError) {
    // Roll back: release stock AND delete the orphaned order
    await Promise.all([
      adminSupabase.rpc('checkout_release_stock', { p_items: items.map(i => ({ ...i, is_b2b: isB2B })) }),
      adminSupabase.from('orders').delete().eq('id', order.id),
    ])
    return NextResponse.json({ error: 'Failed to create order items. Please try again.' }, { status: 500 })
  }

  // TEST MODE: Skip Stripe and auto-confirm order
  // Set NEXT_PUBLIC_TEST_MODE=true in .env.local to bypass payment
  // Remove this block and restore Stripe before going live
  const testMode = process.env.NEXT_PUBLIC_TEST_MODE === 'true'

  if (testMode) {
    // Auto-confirm without payment
    await adminSupabase
      .from('orders')
      .update({
        status: 'payment_confirmed',
        stripe_payment_intent_id: 'test_mode_bypass',
        stripe_payment_status: 'succeeded',
      })
      .eq('id', order.id)

    return NextResponse.json({
      data: {
        order_id: order.id,
        order_number: order.order_number,
        client_secret: null,
        total_cents: totals.total,
        test_mode: true,
      }
    }, { status: 201 })
  }

  // PRODUCTION: Create Stripe payment intent
  let paymentIntent
  try {
    paymentIntent = await createPaymentIntent({
      amountCents: totals.total,
      orderId: order.id,
      buyerId: user.id,
    })
  } catch (stripeErr) {
    // Roll back everything if Stripe fails
    await Promise.all([
      adminSupabase.rpc('checkout_release_stock', { p_items: items.map(i => ({ ...i, is_b2b: isB2B })) }),
      adminSupabase.from('order_items').delete().eq('order_id', order.id),
      adminSupabase.from('orders').delete().eq('id', order.id),
    ])
    return NextResponse.json({ error: 'Payment setup failed. Please try again.' }, { status: 500 })
  }

  await adminSupabase
    .from('orders')
    .update({ stripe_payment_intent_id: paymentIntent.id })
    .eq('id', order.id)

  return NextResponse.json({
    data: {
      order_id: order.id,
      order_number: order.order_number,
      client_secret: paymentIntent.client_secret,
      total_cents: totals.total,
    }
  }, { status: 201 })
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const farmerOnly = url.searchParams.get('farmer') === 'true'

  if (farmerOnly) {
    // Farmers see orders containing their items
    const { data: farmer } = await supabase.from('farmers').select('id').eq('user_id', user.id).single()
    if (!farmer) return NextResponse.json({ error: 'Not a farmer' }, { status: 403 })

    const { data, error } = await supabase
      .from('order_items')
      .select('order_id, orders(*)')
      .eq('farmer_id', farmer.id)

    const uniqueOrderIds = [...new Set((data || []).map((i: any) => i.order_id))]
    const { data: orders } = await supabase
      .from('orders')
      .select('*, order_items(*, products(name, unit, image_url))')
      .in('id', uniqueOrderIds)
      .order('created_at', { ascending: false })

    return NextResponse.json({ data: orders || [] })
  }

  const { data, error } = await supabase
    .from('orders')
    .select(`*, order_items(*, products(name, unit, image_url), farmers(business_name))`)
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
