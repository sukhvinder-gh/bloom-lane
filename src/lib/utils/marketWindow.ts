// src/lib/utils/marketWindow.ts
//
// Per-hub market-open scheduling with a farm-level override. Resolution
// order: farm override -> hub schedule -> stay open. That last fallback is
// deliberate: today, every hub/farm has no schedule configured, so this
// must resolve to "open" for all of them to match current behavior exactly
// — enforcement only activates once a hub or farm actually sets a window,
// the same opt-in rollout shape as the Phase 5 membership gate.

import { createAdminClient } from '@/lib/supabase/server'
import { isWithinWeeklyWindow, nextWeeklyOccurrence } from '@/lib/utils/timezone'

export async function isMarketOpenForFarmer(farmerId: string): Promise<boolean> {
  const admin = createAdminClient()

  const { data: farmer } = await admin
    .from('farmers')
    .select('hub_id, market_open_day_override, market_open_time_override, market_close_time_override')
    .eq('id', farmerId)
    .single()

  if (farmer?.market_open_day_override && farmer?.market_open_time_override && farmer?.market_close_time_override) {
    return isWithinWeeklyWindow(
      farmer.market_open_day_override,
      farmer.market_open_time_override,
      farmer.market_close_time_override
    )
  }

  if (farmer?.hub_id) {
    const { data: hub } = await admin
      .from('hubs')
      .select('market_open_day, market_open_time, market_close_time')
      .eq('id', farmer.hub_id)
      .single()

    if (hub?.market_open_day && hub?.market_open_time && hub?.market_close_time) {
      return isWithinWeeklyWindow(hub.market_open_day, hub.market_open_time, hub.market_close_time)
    }
  }

  return true
}

/**
 * When does this farmer's market next close — i.e. when should they have
 * fulfilled by? Same override resolution as isMarketOpenForFarmer (farm
 * override -> hub schedule -> unconfigured). Returns null when neither the
 * farm nor its hub has a schedule set up yet, so the caller can fall back
 * to a flat lead time instead.
 */
export async function nextMarketCloseForFarmer(farmerId: string): Promise<Date | null> {
  const admin = createAdminClient()

  const { data: farmer } = await admin
    .from('farmers')
    .select('hub_id, market_open_day_override, market_close_time_override')
    .eq('id', farmerId)
    .single()

  if (farmer?.market_open_day_override && farmer?.market_close_time_override) {
    return nextWeeklyOccurrence(farmer.market_open_day_override, farmer.market_close_time_override)
  }

  if (farmer?.hub_id) {
    const { data: hub } = await admin
      .from('hubs')
      .select('market_open_day, market_close_time')
      .eq('id', farmer.hub_id)
      .single()

    if (hub?.market_open_day && hub?.market_close_time) {
      return nextWeeklyOccurrence(hub.market_open_day, hub.market_close_time)
    }
  }

  return null
}
