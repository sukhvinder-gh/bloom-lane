// src/lib/orders/defaultFulfillmentDate.ts
//
// Auto-derives a "grower fulfils by" date so this is never a manual
// per-order admin task — previously grower_fulfillment_date was only ever
// set by an admin hand-editing each order, so any order they hadn't gotten
// to yet sat with no date at all, permanently invisible from the date-scoped
// harvest/pack lists.

import { createAdminClient } from '@/lib/supabase/server'
import { nextMarketCloseForFarmer } from '@/lib/utils/marketWindow'

const FALLBACK_LEAD_DAYS = 2

export async function computeDefaultFulfillmentDate(
  supabase: ReturnType<typeof createAdminClient>,
  farmerIds: string[]
): Promise<Date> {
  const closeDates = await Promise.all(farmerIds.map(id => nextMarketCloseForFarmer(id)))
  const scheduled = closeDates.filter((d): d is Date => d !== null)

  if (scheduled.length > 0) {
    // Latest of every included farm's own configured close time — never
    // asks a farmer to fulfil before their own market/window has closed.
    return new Date(Math.max(...scheduled.map(d => d.getTime())))
  }

  // Nothing configured (still the common case — hub/farm schedules are
  // opt-in) — fall back to a flat lead time from now, itself a one-time
  // admin setting (Admin > Config), not a per-order decision.
  const { data: cfg } = await supabase
    .from('config').select('value').eq('key', 'default_harvest_lead_days').maybeSingle()
  const leadDays = parseInt(cfg?.value || '') || FALLBACK_LEAD_DAYS

  const d = new Date()
  d.setDate(d.getDate() + leadDays)
  return d
}
