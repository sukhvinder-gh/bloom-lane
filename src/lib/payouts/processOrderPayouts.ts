// src/lib/payouts/processOrderPayouts.ts
//
// Pays every grower on a delivered order, split by farmer, commission
// deducted at each grower's effective rate. Called directly and
// synchronously the moment an order is marked delivered (see
// src/app/api/orders/[id]/mark-delivered/route.ts) — this used to be dispatched as an
// Inngest event instead, but that added a whole external service (with its
// own credentials to keep valid) for something that doesn't need
// asynchronous retry: it's the same idempotent, already-fast logic the
// manual Admin > Orders > "Generate Payouts" button has always called
// directly (see src/app/api/admin/orders/[id]/generate-payouts/route.ts).
// Idempotent — skips any farmer who already has a payout for this order.

import { createAdminClient } from '@/lib/supabase/server'
import { createFarmerPayout } from '@/lib/stripe'
import { calculateFarmerPayout } from '@/lib/utils/pricing'
import { getCommissionRates, effectiveCommissionRate } from '@/lib/utils/commission'
import { resolvePayoutDestination } from '@/lib/utils/payoutDestination'
import { sendPayoutReadyEmail } from '@/lib/email/sendPayoutReadyEmail'

export async function processOrderPayouts(orderId: string) {
  const supabase = createAdminClient()

  const FARMER_SELECT_WITH_HUB = 'stripe_account_id, stripe_onboarding_complete, commission_rate, subscription_type, id, email, business_name, hub_id, hubs(id, stripe_account_id, stripe_onboarding_complete)'
  const FARMER_SELECT_NO_HUB = 'stripe_account_id, stripe_onboarding_complete, commission_rate, subscription_type, id, email, business_name'

  let { data: order, error: orderErr } = await supabase
    .from('orders')
    .select(`*, order_items(*, farmers(${FARMER_SELECT_WITH_HUB}))`)
    .eq('id', orderId)
    .single()

  // Migration 040 (hub payout columns) not applied yet — fall back to
  // paying every grower directly, exactly like before that migration existed.
  if (orderErr && /hub|stripe_account_id|stripe_onboarding_complete/.test(orderErr.message)) {
    ;({ data: order, error: orderErr } = await supabase
      .from('orders')
      .select(`*, order_items(*, farmers(${FARMER_SELECT_NO_HUB}))`)
      .eq('id', orderId)
      .single())
  }

  if (!order) return { skipped: true, reason: 'Order not found' }
  if (['disputed', 'refunded', 'cancelled'].includes(order.status)) {
    return { skipped: true, reason: `Order status is ${order.status} — skipping payout` }
  }

  const farmerItems = (order.order_items || []).reduce((acc: any, item: any) => {
    const farmerId = item.farmer_id
    if (!acc[farmerId]) acc[farmerId] = { items: [], farmer: item.farmers, total: 0 }
    acc[farmerId].items.push(item)
    acc[farmerId].total += item.subtotal_cents
    return acc
  }, {})

  const results = []
  const rates = await getCommissionRates(supabase)

  for (const [farmerId, data] of Object.entries(farmerItems) as any) {
    // Never pay (or re-flag) twice for the same order + farmer.
    const { data: existingPayout } = await supabase
      .from('payouts')
      .select('id, status')
      .eq('farmer_id', farmerId)
      .contains('order_item_ids', data.items.map((i: any) => i.id))
      .in('status', ['pending', 'processing', 'paid'])
      .maybeSingle()

    if (existingPayout) {
      results.push({ farmerId, status: 'already_handled', payoutId: existingPayout.id })
      continue
    }

    const { gross, commission, net } = calculateFarmerPayout(
      data.total,
      effectiveCommissionRate(data.farmer, rates)
    )

    const destination = resolvePayoutDestination(data.farmer || {})

    if (!destination) {
      // Onboarding isn't a gate on selling, so this is an expected, common
      // case, not an error — held as 'pending' (not just skipped) so the
      // money owed is tracked, and paid automatically the moment the
      // grower connects Stripe (see retryPendingPayoutsForFarmer).
      await supabase.from('payouts').insert({
        farmer_id: farmerId,
        order_id: orderId,
        order_item_ids: data.items.map((i: any) => i.id),
        gross_amount_cents: gross,
        commission_cents: commission,
        net_amount_cents: net,
        status: 'pending',
      })

      const email = data.farmer?.email
      const name = data.farmer?.business_name
      if (email) {
        sendPayoutReadyEmail({ to: email, name: name || 'there', netAmountCents: net }).catch(() => {})
      }

      results.push({ farmerId, status: 'pending_no_stripe' })
      continue
    }

    // Insert payout record as 'processing' BEFORE calling Stripe — acts as a
    // lock so a concurrent/retried call can't double-pay the same farmer.
    const payoutRow: Record<string, unknown> = {
      farmer_id: farmerId,
      order_id: orderId,
      order_item_ids: data.items.map((i: any) => i.id),
      gross_amount_cents: gross,
      commission_cents: commission,
      net_amount_cents: net,
      status: 'processing',
    }
    let { data: payoutRecord, error: insertErr } = await supabase
      .from('payouts')
      .insert(destination.hubId ? { ...payoutRow, paid_to_hub_id: destination.hubId } : payoutRow)
      .select('id')
      .single()
    // paid_to_hub_id column not there yet (migration 040 not applied) — still
    // record the payout itself, just without which-hub-received-it detail.
    if (insertErr && destination.hubId && /paid_to_hub_id/.test(insertErr.message)) {
      ;({ data: payoutRecord, error: insertErr } = await supabase.from('payouts').insert(payoutRow).select('id').single())
    }

    if (insertErr || !payoutRecord) {
      results.push({ farmerId, status: 'insert_failed', error: insertErr?.message })
      continue
    }

    try {
      const transfer = await createFarmerPayout({
        stripeAccountId: destination.stripeAccountId,
        netAmountCents: net,
        orderId,
        farmerId,
        hubId: destination.hubId ?? undefined,
      })

      await supabase
        .from('payouts')
        .update({ stripe_transfer_id: transfer.id, status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', payoutRecord.id)

      results.push({ farmerId, status: 'paid', transferId: transfer.id, paidToHub: !!destination.hubId })
    } catch (stripeErr) {
      await supabase.from('payouts').update({ status: 'failed' }).eq('id', payoutRecord.id)
      results.push({ farmerId, status: 'failed', error: String(stripeErr) })
    }
  }

  return { orderId, payouts: results }
}
