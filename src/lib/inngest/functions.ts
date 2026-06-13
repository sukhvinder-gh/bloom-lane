// src/lib/inngest/functions.ts
// FIX BUG-05: Payout is now idempotent — checks for existing payout before inserting
// FIX BUG-06: Tuesday heartbeat logic fixed — was locking UNLISTED (is_active=false) products,
//             now correctly locks ALL listed products when window closes

import { Inngest } from 'inngest'
import { createAdminClient } from '@/lib/supabase/server'
import { createFarmerPayout } from '@/lib/stripe'
import { calculateFarmerPayout } from '@/lib/utils/pricing'
import { getThisWeekMarketWindow } from '@/lib/utils/timezone'
import { sendWeeklyAvailabilityDigest, sendMarketOpenNotification } from '@/lib/email/sendSubscriptionEmail'

export const inngest = new Inngest({ id: 'agri-marketplace' })

// ============================================================
// 1. TUESDAY HEARTBEAT — Close listing window
// Cron: Tuesday 23:59 AEST = Tuesday 13:59 UTC
// ============================================================

export const tuesdayHeartbeat = inngest.createFunction(
  { id: 'tuesday-heartbeat', name: 'Tuesday Listing Window Heartbeat' },
  { cron: '59 13 * * 2' },
  async ({ step }) => {
    const supabase = createAdminClient()

    // BUG-06 FIX: Lock ALL listed products — removed the .eq('is_active', false)
    // which was incorrectly filtering to only INACTIVE products (opposite of intent)
    await step.run('lock-all-listings', async () => {
      const { error, count } = await supabase
        .from('products')
        .update({ is_listed_this_week: false })
        .eq('is_listed_this_week', true)
        // No is_active filter — we lock ALL listed products regardless of active status
        .select('*')

      if (error) throw new Error(`Failed to lock listings: ${error.message}`)
      return { locked: count, error: null }
    })

    // Record this cycle
    await step.run('record-listing-window', async () => {
      const window = getThisWeekMarketWindow()
      await supabase.from('listing_windows').insert({
        opens_at: window.listingOpens.toISOString(),
        closes_at: window.listingCloses.toISOString(),
        market_opens_at: window.marketOpens.toISOString(),
        market_closes_at: window.marketCloses.toISOString(),
        is_active: false,
      })
    })

    return { success: true, closedAt: new Date().toISOString() }
  }
)

// ============================================================
// 2. WEDNESDAY MARKET OPEN — Notify buyers
// Cron: Wednesday 08:00 AEST = Tuesday 22:00 UTC
// ============================================================

export const wednesdayMarketOpen = inngest.createFunction(
  { id: 'wednesday-market-open', name: 'Wednesday Market Opens' },
  { cron: '0 22 * * 2' },
  async ({ step }) => {
    const supabase = createAdminClient()

    const { notified } = await step.run('notify-buyers-market-open', async () => {
      // Fetch products listed this week
      const { data: products } = await supabase
        .from('products')
        .select('name, unit, wholesale_price_cents, category, farmers(business_name)')
        .eq('is_listed_this_week', true)
        .eq('is_active', true)
        .order('category', { ascending: true })

      if (!products || products.length === 0) return { notified: 0, reason: 'No products listed this week' }

      const productList = products.map((p: any) => ({
        name: p.name,
        farmer: (p.farmers as any)?.business_name || 'Unknown',
        unit: p.unit,
        b2b_price: p.wholesale_price_cents,
        category: p.category ?? '',
      }))

      // Mailing list subscriber IDs — get the full weekly digest
      const { data: mailingListSubs } = await supabase
        .from('subscriptions')
        .select('user_id')
        .eq('plan', 'mailing_list')
        .eq('status', 'active')

      const mailingListIds = new Set((mailingListSubs || []).map((s: any) => s.user_id as string))

      // All active buyers
      const { data: buyers } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('role', ['buyer_b2b', 'buyer_b2c'])

      let notified = 0
      for (const buyer of (buyers || [])) {
        if (!buyer.email) continue
        try {
          if (mailingListIds.has(buyer.id)) {
            await sendWeeklyAvailabilityDigest({
              to: buyer.email,
              name: buyer.full_name || 'Valued Customer',
              products: productList,
            })
          } else {
            await sendMarketOpenNotification({
              to: buyer.email,
              name: buyer.full_name || 'Valued Customer',
              productCount: productList.length,
            })
          }
          notified++
        } catch {
          // One failed send doesn't stop the rest
        }
      }
      return { notified }
    })

    return { marketOpen: true, openedAt: new Date().toISOString(), notified }
  }
)

// ============================================================
// 3. AUTOMATED PAYOUTS — After dispute window expires
// Triggered: order/delivered event
// BUG-05 FIX: Idempotent — checks existing payout record before creating
// ============================================================

export const processPayoutAfterDispute = inngest.createFunction(
  {
    id: 'process-payout',
    name: 'Process Farmer Payout After Dispute Window',
    retries: 3,
  },
  { event: 'order/delivered' },
  async ({ event, step }) => {
    const { orderId, disputeWindowHrs = 6 } = event.data

    // Wait for dispute window
    await step.sleep('wait-for-dispute-window', `${disputeWindowHrs}h`)

    const supabase = createAdminClient()

    // Check order status — skip if disputed or already refunded
    const { data: order } = await supabase
      .from('orders')
      .select('*, order_items(*, farmers(stripe_account_id, stripe_onboarding_complete, commission_rate, id))')
      .eq('id', orderId)
      .single()

    if (!order) return { skipped: true, reason: 'Order not found' }

    if (['disputed', 'refunded', 'cancelled'].includes(order.status)) {
      return { skipped: true, reason: `Order status is ${order.status} — skipping payout` }
    }

    // Group items by farmer
    const farmerItems = (order.order_items || []).reduce((acc: any, item: any) => {
      const farmerId = item.farmer_id
      if (!acc[farmerId]) {
        acc[farmerId] = { items: [], farmer: item.farmers, total: 0 }
      }
      acc[farmerId].items.push(item)
      acc[farmerId].total += item.subtotal_cents
      return acc
    }, {})

    const payouts = await step.run('execute-payouts', async () => {
      const results = []

      for (const [farmerId, data] of Object.entries(farmerItems) as any) {
        if (!data.farmer?.stripe_account_id || !data.farmer?.stripe_onboarding_complete) {
          results.push({ farmerId, status: 'skipped_no_stripe' })
          continue
        }

        // BUG-05 FIX: Idempotency check — never pay twice for same order + farmer
        const { data: existingPayout } = await supabase
          .from('payouts')
          .select('id, status')
          .eq('farmer_id', farmerId)
          .contains('order_item_ids', data.items.map((i: any) => i.id))
          .in('status', ['processing', 'paid'])
          .maybeSingle()

        if (existingPayout) {
          results.push({ farmerId, status: 'already_paid', payoutId: existingPayout.id })
          continue
        }

        const { gross, commission, net } = calculateFarmerPayout(
          data.total,
          data.farmer.commission_rate
        )

        // Insert payout record as 'processing' BEFORE calling Stripe
        // This acts as a distributed lock — if Inngest retries, idempotency check above catches it
        const { data: payoutRecord, error: insertErr } = await supabase
          .from('payouts')
          .insert({
            farmer_id: farmerId,
            order_item_ids: data.items.map((i: any) => i.id),
            gross_amount_cents: gross,
            commission_cents: commission,
            net_amount_cents: net,
            status: 'processing',
          })
          .select('id')
          .single()

        if (insertErr || !payoutRecord) {
          results.push({ farmerId, status: 'insert_failed', error: insertErr?.message })
          continue
        }

        try {
          const transfer = await createFarmerPayout({
            stripeAccountId: data.farmer.stripe_account_id,
            netAmountCents: net,
            orderId,
            farmerId,
          })

          await supabase
            .from('payouts')
            .update({
              stripe_transfer_id: transfer.id,
              status: 'paid',
              paid_at: new Date().toISOString(),
            })
            .eq('id', payoutRecord.id)

          results.push({ farmerId, status: 'paid', transferId: transfer.id })
        } catch (stripeErr) {
          await supabase
            .from('payouts')
            .update({ status: 'failed' })
            .eq('id', payoutRecord.id)

          results.push({ farmerId, status: 'failed', error: String(stripeErr) })
        }
      }

      return results
    })

    return { orderId, payouts }
  }
)

// ============================================================
// 4. DISPUTE EXPIRY — Set dispute_deadline timestamp
// This is now informational only — the real guard is the DB trigger
// setting dispute_deadline on status=delivered change
// ============================================================

export const expireDisputeWindow = inngest.createFunction(
  { id: 'expire-dispute', name: 'Expire Dispute Window' },
  { event: 'order/delivered' },
  async ({ event, step }) => {
    const { orderId, disputeWindowHrs = 6 } = event.data

    await step.sleep('wait-for-window', `${disputeWindowHrs}h`)

    const supabase = createAdminClient()
    await step.run('mark-dispute-expired', async () => {
      // Only update if order is still 'delivered' (not disputed/refunded)
      await supabase
        .from('orders')
        .update({ dispute_window_expired: true })
        .eq('id', orderId)
        .eq('status', 'delivered')
    })

    return { orderId, expired: true }
  }
)

export const inngestFunctions = [
  tuesdayHeartbeat,
  wednesdayMarketOpen,
  processPayoutAfterDispute,
  expireDisputeWindow,
]
