// src/app/api/orders/route.ts
// FIX BUG-01: order_items insert failure now fully rolls back stock + order
// FIX BUG-10: min_order_b2b enforced per item
// FIX BUG-14: B2B buyer with unverified ABN gets explicit error, not silent B2C downgrade

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { createPaymentIntent, cancelPaymentIntent } from '@/lib/stripe'
import { getBuyerUnitPrice, getUnitGstCents, gstAppliesToItem, calculateOrderTotals } from '@/lib/utils/pricing'
import { marketStatusForFarmer } from '@/lib/utils/marketWindow'
import { hasActiveMembership } from '@/lib/utils/membership'
import { finalizeOrderPayment } from '@/lib/orders/finalizeOrderPayment'
import { generateOrderNumber } from '@/lib/utils/orderNumber'
import { z } from 'zod'

const checkoutSchema = z.object({
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().int().positive(),
    notes: z.string().max(200).optional(),
  })).min(1),
  fulfillment_type: z.enum(['direct_delivery', 'hub_pickup']),
  delivery_address: z.string().optional(),
  delivery_suburb: z.string().optional(),
  delivery_state: z.string().optional(),
  delivery_postcode: z.string().optional(),
  hub_id: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
  farm_pickup_farmer_ids: z.array(z.string().uuid()).max(50).optional().default([]),
  // farmer_id -> chosen farmer_fulfillment_options.id, for growers with more
  // than one configured delivery slot. Never trusted as-is — validated below
  // against that farmer's real options before it affects price.
  fulfillment_option_selections: z.record(z.string().uuid(), z.string().uuid()).optional().default({}),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const adminSupabase = await createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!(await hasActiveMembership(user.id))) {
    return NextResponse.json({ error: 'An approved membership is required before you can place an order.' }, { status: 403 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, abn_verified, full_name, business_name')
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

  // Release stock from this buyer's own abandoned checkout attempts before
  // reserving more. A pending_payment order holds its stock until Stripe
  // reports success/failure/cancellation via webhook — but a buyer who never
  // finishes paying (navigates away, retries checkout, or is just clicking
  // through to see the form) never triggers any of those, so the reservation
  // was otherwise stuck until someone manually cancelled it. Only ever
  // touches this buyer's own rows, so it can't affect anyone else's order.
  const { data: abandonedOrders } = await adminSupabase
    .from('orders')
    .select('id, stripe_payment_intent_id, order_items(product_id, quantity, is_b2b)')
    .eq('buyer_id', user.id)
    .eq('status', 'pending_payment')
    .not('stripe_payment_intent_id', 'is', null)

  for (const abandoned of abandonedOrders || []) {
    const abandonedItems = (abandoned as any).order_items as { product_id: string; quantity: number; is_b2b: boolean }[]
    if (abandonedItems.length > 0) {
      await adminSupabase.rpc('checkout_release_stock', {
        p_items: abandonedItems.map(i => ({ product_id: i.product_id, quantity: i.quantity, is_b2b: i.is_b2b })),
      })
    }
    if (abandoned.stripe_payment_intent_id) {
      await cancelPaymentIntent(abandoned.stripe_payment_intent_id)
    }
    await adminSupabase.from('orders').update({ status: 'cancelled', stripe_payment_status: 'canceled' }).eq('id', abandoned.id)
  }

  const body = await request.json()
  const parsed = checkoutSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { items, fulfillment_type, hub_id, delivery_address,
    delivery_suburb, delivery_state, delivery_postcode, notes,
    farm_pickup_farmer_ids: requestedFarmPickupIds,
    fulfillment_option_selections: requestedOptionSelections } = parsed.data

  // Fetch product details first for validation
  // farmers(gst_registered, offers_farm_pickup) is joined so GST and farm
  // pickup can both be evaluated per grower, not per product.
  const productIds = items.map(i => i.product_id)
  const { data: products } = await supabase
    .from('products')
    .select('id, name, unit, wholesale_price, b2c_markup_pct, is_gst_free, farmer_id, min_order_b2b, is_listed_this_week, is_active, farmers(business_name, gst_registered, offers_farm_pickup, farmer_fulfillment_options(id, type, cost_cents))')
    .in('id', productIds)

  if (!products || products.length !== productIds.length) {
    return NextResponse.json({ error: 'One or more products not found' }, { status: 404 })
  }

  // Each grower can have their own open window (or the hub's) — if any
  // grower in this cart is currently closed, the whole checkout is blocked
  // rather than allowing a partial order through. Naming exactly who's
  // closed and when they reopen saves the buyer a guessing game — the
  // generic version of this message gave no way to tell which item to
  // remove or when to just try again.
  const distinctFarmerIds = [...new Set(products.map(p => p.farmer_id))]
  const marketStatuses = await Promise.all(distinctFarmerIds.map(fid => marketStatusForFarmer(fid)))
  const closed = distinctFarmerIds
    .map((fid, i) => ({ fid, status: marketStatuses[i] }))
    .filter(f => !f.status.open)

  if (closed.length > 0) {
    const dayLabel = (d: string) => d.charAt(0).toUpperCase() + d.slice(1)
    const farmerName = (fid: string) => (products.find(p => p.farmer_id === fid) as any)?.farmers?.business_name || 'This grower'
    const details = closed.map(({ fid, status }) => {
      const hours = status.windows.map(w => `${dayLabel(w.day)} ${w.open}–${w.close}`).join(', ')
      return hours ? `${farmerName(fid)} (open ${hours})` : farmerName(fid)
    })
    return NextResponse.json(
      { error: `Currently closed for ordering: ${details.join('; ')}. Remove their items from your cart or check back during their listed hours.` },
      { status: 400 }
    )
  }

  // Never trust the client's farm-pickup list — a grower must actually offer
  // it, and must actually have items in this order.
  const farmPickupFarmerIds = [...new Set(
    requestedFarmPickupIds.filter(fid =>
      products.some(p => p.farmer_id === fid && (p as any).farmers?.offers_farm_pickup)
    )
  )]
  const hasPooledItems = products.some(p => !farmPickupFarmerIds.includes(p.farmer_id))

  // Sanitized version of the buyer's fulfillment-slot picks — only entries
  // that survived validation against that farmer's real options, keyed by
  // farmer_id. Delivery entries are added later (they affect price); pickup
  // entries are validated here (day/time only — farm pickup carries no fee).
  const validatedOptionSelections: Record<string, string> = {}
  for (const fid of farmPickupFarmerIds) {
    const product = products.find(p => p.farmer_id === fid)
    const pickupOptions = ((product as any)?.farmers?.farmer_fulfillment_options || []).filter((o: any) => o.type === 'pickup')
    const requestedId = requestedOptionSelections[fid]
    const chosen = (requestedId && pickupOptions.find((o: any) => o.id === requestedId)) || pickupOptions[0]
    if (chosen) validatedOptionSelections[fid] = chosen.id
  }

  if (hasPooledItems) {
    if (fulfillment_type === 'hub_pickup' && !hub_id) {
      return NextResponse.json({ error: 'Hub ID required for hub pickup' }, { status: 400 })
    }
    if (fulfillment_type === 'direct_delivery' && !delivery_address) {
      return NextResponse.json({ error: 'Delivery address required' }, { status: 400 })
    }
    // Delivery pricing is entirely grower-set (see farmer_fulfillment_options)
    // — there's no platform-wide delivery fee to fall back on, so a pooled
    // grower who hasn't configured a delivery option at all simply can't be
    // delivered to. Block the whole checkout rather than silently charging
    // an arbitrary fee on their behalf.
    if (fulfillment_type === 'direct_delivery') {
      const pooledFarmerIds = [...new Set(
        products.filter(p => !farmPickupFarmerIds.includes(p.farmer_id)).map(p => p.farmer_id)
      )]
      const noDeliveryOption = pooledFarmerIds.filter(fid => {
        const product = products.find(p => p.farmer_id === fid)
        const deliveryOptions = ((product as any)?.farmers?.farmer_fulfillment_options || []).filter((o: any) => o.type === 'delivery')
        return deliveryOptions.length === 0
      })
      if (noDeliveryOption.length > 0) {
        const names = noDeliveryOption.map(fid => (products.find(p => p.farmer_id === fid) as any)?.farmers?.business_name || 'This grower')
        return NextResponse.json(
          { error: `${names.join(', ')} ${names.length > 1 ? "haven't" : "hasn't"} set up delivery. Try hub pickup, or remove their items from your cart.` },
          { status: 400 }
        )
      }
    }
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
          { error: `Minimum order for "${product.name}" is ${product.min_order_b2b} ${product.unit}` },
          { status: 400 }
        )
      }
    }
  }

  // Stock is usually already held — the buyer reserved it 60 minutes ago when
  // they added it to their cart (see /api/cart/reserve). Consume those
  // reservations here (delete without releasing, since the order now
  // permanently owns that stock) rather than re-deducting on top of them.
  // Anything without a live reservation (expired, or never reserved — e.g.
  // an older client) falls back to the original atomic check-and-reserve.
  const consumedItems: typeof items = []
  const unreservedItems: typeof items = []
  for (const item of items) {
    const { data: consumed } = await adminSupabase.rpc('cart_consume_reservation', {
      p_user_id: user.id,
      p_product_id: item.product_id,
      p_quantity: item.quantity,
      p_is_b2b: isB2B,
    })
    ;(consumed ? consumedItems : unreservedItems).push(item)
  }

  if (unreservedItems.length > 0) {
    const { data: stockResult, error: stockError } = await adminSupabase
      .rpc('checkout_reserve_stock', {
        p_items: unreservedItems.map(item => ({
          product_id: item.product_id,
          quantity: item.quantity,
          is_b2b: isB2B,
        })),
      })

    if (stockError || !stockResult?.success) {
      // Undo the reservations we already consumed above — the order isn't happening.
      if (consumedItems.length > 0) {
        await adminSupabase.rpc('checkout_release_stock', {
          p_items: consumedItems.map(i => ({ ...i, is_b2b: isB2B })),
        })
      }
      return NextResponse.json(
        { error: stockResult?.error || 'One or more items are out of stock. Please refresh your cart.' },
        { status: 409 }
      )
    }
  }

  // Build order items with prices.
  // GST is snapshotted per line at time of purchase (grower's registration
  // status at checkout), not recomputed later from onboarding data — if the
  // grower's status changes afterwards, past orders must stay accurate.
  const orderItems = items.map(item => {
    const product = products.find(p => p.id === item.product_id)!
    const growerGstRegistered = !!(product as any).farmers?.gst_registered
    const unit_price = getBuyerUnitPrice(product, isB2B, growerGstRegistered)
    const unit_gst = getUnitGstCents(product, isB2B, growerGstRegistered)
    return {
      product_id: item.product_id,
      farmer_id: product.farmer_id,
      quantity: item.quantity,
      unit_price_cents: unit_price,
      subtotal_cents: unit_price * item.quantity,
      is_b2b: isB2B,
      gst_applied: gstAppliesToItem(product, growerGstRegistered),
      gst_cents: unit_gst * item.quantity,
      notes: item.notes || null,
    }
  })

  // Get delivery fee — nothing to deliver if every item is going via farm pickup.
  // Fully grower-set: each pooled grower's own configured delivery cost (set
  // on their storefront) is summed per-grower. No platform-wide fallback —
  // the validation above already guarantees every pooled grower has at least
  // one delivery option by this point.
  let deliveryFeeCents = 0
  if (fulfillment_type === 'direct_delivery' && hasPooledItems) {
    const pooledFarmerIds = [...new Set(
      products.filter(p => !farmPickupFarmerIds.includes(p.farmer_id)).map(p => p.farmer_id)
    )]
    deliveryFeeCents = pooledFarmerIds.reduce((sum, fid) => {
      const product = products.find(p => p.farmer_id === fid)
      const deliveryOptions = ((product as any)?.farmers?.farmer_fulfillment_options || []).filter((o: any) => o.type === 'delivery')
      const requestedId = requestedOptionSelections[fid]
      const chosen = (requestedId && deliveryOptions.find((o: any) => o.id === requestedId)) || deliveryOptions[0]
      validatedOptionSelections[fid] = chosen.id
      return sum + chosen.cost_cents
    }, 0)
  }

  const totals = calculateOrderTotals(orderItems, deliveryFeeCents)

  // Create order
  const { data: order, error: orderError } = await adminSupabase
    .from('orders')
    .insert({
      buyer_id: user.id,
      order_number: generateOrderNumber(profile?.business_name || profile?.full_name),
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
      farm_pickup_farmer_ids: farmPickupFarmerIds,
      fulfillment_option_selections: validatedOptionSelections,
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
    // Auto-confirm without payment, but otherwise finalize exactly like a real
    // successful payment would (via the Stripe webhook) — creates the
    // purchase_orders row per grower and sends the confirmation/PO emails.
    // Without this, test-mode orders were "paid" but invisible to growers:
    // no PO status tracking, no harvest/pack list entry, no buyer<->grower
    // messaging (all gated on a purchase_orders row that only the webhook
    // used to create).
    await finalizeOrderPayment(adminSupabase, order.id, 'test_mode_bypass')

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
    // Must use adminSupabase — orders RLS only allows buyer_id access,
    // farmers are not buyers so regular client returns empty
    const adminSupabase = await createAdminClient()

    const { data: farmer } = await supabase.from('farmers').select('id').eq('user_id', user.id).single()
    if (!farmer) return NextResponse.json({ error: 'Not a farmer' }, { status: 403 })

    // Get all order_item IDs belonging to this farmer
    const { data: farmerItems, error: itemsErr } = await adminSupabase
      .from('order_items')
      .select('order_id')
      .eq('farmer_id', farmer.id)

    if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 })

    const uniqueOrderIds = [...new Set((farmerItems || []).map((i: any) => i.order_id))]

    if (uniqueOrderIds.length === 0) return NextResponse.json({ data: [] })

    // Fetch full orders with only this farmer's items
    const { data: orders, error: ordersErr } = await adminSupabase
      .from('orders')
      .select('*, order_items!inner(*, products(name, unit, image_url)), profiles(full_name, business_name)')
      .in('id', uniqueOrderIds)
      .eq('order_items.farmer_id', farmer.id)
      .order('created_at', { ascending: false })

    if (ordersErr) return NextResponse.json({ error: ordersErr.message }, { status: 500 })
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
