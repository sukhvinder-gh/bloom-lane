// src/lib/inngest/functions.ts
// FIX BUG-06: Tuesday heartbeat logic fixed — was locking UNLISTED (is_active=false) products,
//             now correctly locks ALL listed products when window closes
//
// Payout processing (idempotent — see src/lib/payouts/processOrderPayouts.ts)
// used to live here as an Inngest-triggered function but no longer does; see
// the note at "3. AUTOMATED PAYOUTS" below for why.

import { Inngest } from 'inngest'
import { createAdminClient } from '@/lib/supabase/server'
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
// 3. AUTOMATED PAYOUTS — moved off Inngest.
//
// Used to be triggered here via an 'order/delivered' event. Now called
// directly and synchronously from src/app/api/orders/[id]/ppod/route.ts the
// moment an order is marked delivered (see processOrderPayouts()) — the same
// idempotent, fast-enough logic the manual Admin > Orders > "Generate
// Payouts" button has always called directly, so it doesn't need an
// external event-delivery service (with its own credentials to keep valid)
// in between. The "process-payout" and "expire-dispute" Inngest functions
// that used to live here are gone; expire-dispute's dispute_window_expired
// flag was already unread anywhere else in the app.
// ============================================================

// ============================================================
// 4. CART RESERVATION SWEEP — release stock from abandoned carts
// Cron: every 5 minutes
// ============================================================

export const expireCartReservations = inngest.createFunction(
  { id: 'expire-cart-reservations', name: 'Release Expired Cart Reservations' },
  { cron: '*/5 * * * *' },
  async ({ step }) => {
    const supabase = createAdminClient()

    const released = await step.run('release-expired', async () => {
      const { data, error } = await supabase.rpc('cart_release_expired_reservations')
      if (error) throw new Error(`Failed to release expired reservations: ${error.message}`)
      return data as number
    })

    return { released, at: new Date().toISOString() }
  }
)

export const inngestFunctions = [
  tuesdayHeartbeat,
  wednesdayMarketOpen,
  expireCartReservations,
]
