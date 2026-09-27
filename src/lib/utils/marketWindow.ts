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

export type MarketWindow = { day: string; open: string; close: string }

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

/** Validates/normalises a client-supplied list of windows. Returns an error string on bad input. */
export function sanitizeMarketWindows(input: unknown): MarketWindow[] | string {
  if (!Array.isArray(input)) return 'market_windows must be a list'
  const out: MarketWindow[] = []
  for (const w of input) {
    const day = String(w?.day ?? '').toLowerCase()
    const open = String(w?.open ?? '')
    const close = String(w?.close ?? '')
    // Fully blank rows (added but never filled in) are just dropped.
    if (!day && !open && !close) continue
    if (!DAYS.includes(day) || !TIME_RE.test(open) || !TIME_RE.test(close)) {
      return 'Each ordering window needs a day, an opening time and a closing time'
    }
    if (open >= close) return `The ${day} ordering window must close after it opens`
    out.push({ day, open, close })
  }
  return out
}

/**
 * A hub's windows: the market_windows list if it has one, otherwise the
 * legacy single open-day/open/close columns as a one-item list. Empty means
 * no schedule (always open).
 */
export function hubMarketWindows(hub: any): MarketWindow[] {
  if (Array.isArray(hub?.market_windows) && hub.market_windows.length > 0) {
    return hub.market_windows.filter((w: any) => w?.day && w?.open && w?.close)
  }
  if (hub?.market_open_day && hub?.market_open_time && hub?.market_close_time) {
    return [{ day: hub.market_open_day, open: hub.market_open_time, close: hub.market_close_time }]
  }
  return []
}

/**
 * Same resolution as isMarketOpenForFarmer (farm override -> hub schedule ->
 * unconfigured/always-open), but also returns the actual windows so a caller
 * can tell a buyer *when* a closed grower reopens instead of just that
 * they're closed.
 */
export async function marketStatusForFarmer(farmerId: string): Promise<{ open: boolean; windows: MarketWindow[] }> {
  const admin = createAdminClient()

  const { data: farmer } = await admin
    .from('farmers')
    .select('hub_id, market_open_day_override, market_open_time_override, market_close_time_override')
    .eq('id', farmerId)
    .single()

  if (farmer?.market_open_day_override && farmer?.market_open_time_override && farmer?.market_close_time_override) {
    const windows = [{ day: farmer.market_open_day_override, open: farmer.market_open_time_override, close: farmer.market_close_time_override }]
    return { open: isWithinWeeklyWindow(windows[0].day, windows[0].open, windows[0].close), windows }
  }

  if (farmer?.hub_id) {
    // select('*'), not a named list: market_windows may not exist yet if
    // migration 037 hasn't been applied, and naming an unknown column makes
    // the whole query fail instead of falling back to the legacy columns.
    const { data: hub } = await admin
      .from('hubs')
      .select('*')
      .eq('id', farmer.hub_id)
      .single()

    const windows = hubMarketWindows(hub)
    if (windows.length > 0) {
      return { open: windows.some(w => isWithinWeeklyWindow(w.day, w.open, w.close)), windows }
    }
  }

  return { open: true, windows: [] }
}

export async function isMarketOpenForFarmer(farmerId: string): Promise<boolean> {
  return (await marketStatusForFarmer(farmerId)).open
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
      .select('*')
      .eq('id', farmer.hub_id)
      .single()

    // With several windows, the next one to close is the relevant deadline.
    const closes = hubMarketWindows(hub)
      .map(w => nextWeeklyOccurrence(w.day, w.close))
      .filter((d): d is Date => d !== null)
    if (closes.length > 0) return new Date(Math.min(...closes.map(d => d.getTime())))
  }

  return null
}
