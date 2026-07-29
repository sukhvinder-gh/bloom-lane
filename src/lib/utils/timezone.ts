// src/lib/utils/timezone.ts
// CRITICAL: All DB entries stored as UTC. Convert to AEST/AEDT only at UI layer.
// Australia/Sydney handles both AEST (UTC+10) and AEDT (UTC+11) automatically.

import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz'
import { addHours, isPast, isFuture, format } from 'date-fns'

export const AU_TIMEZONE = 'Australia/Sydney'

/**
 * Get current time in Sydney timezone
 */
export function nowAEST(): Date {
  return toZonedTime(new Date(), AU_TIMEZONE)
}

/**
 * Format a UTC date string for display in AEST/AEDT
 */
export function formatAEST(
  date: string | Date,
  formatStr: string = 'dd MMM yyyy, h:mm a zzz'
): string {
  return formatInTimeZone(
    typeof date === 'string' ? new Date(date) : date,
    AU_TIMEZONE,
    formatStr
  )
}

/**
 * Convert AEST time input to UTC for DB storage
 * e.g. "Tuesday 23:59 AEST" → UTC Date
 */
export function aestToUTC(aestDate: Date): Date {
  return fromZonedTime(aestDate, AU_TIMEZONE)
}

/**
 * Get the Wednesday market window for the current week
 * Returns UTC dates for DB storage
 */
export function getThisWeekMarketWindow(): {
  listingOpens: Date   // Sunday
  listingCloses: Date  // Tuesday 23:59 AEST → UTC
  marketOpens: Date    // Wednesday 08:00 AEST → UTC
  marketCloses: Date   // Wednesday 20:00 AEST → UTC
} {
  const now = new Date()
  const sydneyNow = toZonedTime(now, AU_TIMEZONE)

  // Get Sunday of current week
  const dayOfWeek = sydneyNow.getDay() // 0=Sun
  const sunday = new Date(sydneyNow)
  sunday.setDate(sydneyNow.getDate() - dayOfWeek)
  sunday.setHours(0, 0, 0, 0)

  // Tuesday 23:59 AEST
  const tuesdayClose = new Date(sunday)
  tuesdayClose.setDate(sunday.getDate() + 2)
  tuesdayClose.setHours(23, 59, 0, 0)

  // Wednesday 08:00 AEST
  const wednesdayOpen = new Date(sunday)
  wednesdayOpen.setDate(sunday.getDate() + 3)
  wednesdayOpen.setHours(8, 0, 0, 0)

  // Wednesday 20:00 AEST
  const wednesdayClose = new Date(sunday)
  wednesdayClose.setDate(sunday.getDate() + 3)
  wednesdayClose.setHours(20, 0, 0, 0)

  return {
    listingOpens: fromZonedTime(sunday, AU_TIMEZONE),
    listingCloses: fromZonedTime(tuesdayClose, AU_TIMEZONE),
    marketOpens: fromZonedTime(wednesdayOpen, AU_TIMEZONE),
    marketCloses: fromZonedTime(wednesdayClose, AU_TIMEZONE),
  }
}

/**
 * Is the listing window currently open?
 * Farmers can add/edit inventory during this window
 */
export function isListingWindowOpen(): boolean {
	  return true // TEMP: always open for testing — remove before production
/**
  const { listingOpens, listingCloses } = getThisWeekMarketWindow()
  const now = new Date()
  return now >= listingOpens && now <= listingCloses
  */
}

/**
 * Is the market currently open for buyers?
 */
export function isMarketOpen(): boolean {
	/**
  const { marketOpens, marketCloses } = getThisWeekMarketWindow()
  const now = new Date()
  return now >= marketOpens && now <= marketCloses
  */
   return true // TEMP: always open for testing — remove before production
}

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

/**
 * Is "now" within a weekly recurring window (e.g. "wednesday" 08:00-20:00),
 * evaluated in Sydney time? Pure — no DB access — used by the per-hub/farm
 * market-open check in src/lib/utils/marketWindow.ts.
 */
export function isWithinWeeklyWindow(dayName: string, startTime: string, endTime: string): boolean {
  const targetDay = DAY_NAMES.indexOf(dayName.toLowerCase())
  if (targetDay === -1) return false

  const sydneyNow = toZonedTime(new Date(), AU_TIMEZONE)
  const sunday = new Date(sydneyNow)
  sunday.setDate(sydneyNow.getDate() - sydneyNow.getDay())
  sunday.setHours(0, 0, 0, 0)

  const [openH, openM] = startTime.split(':').map(Number)
  const [closeH, closeM] = endTime.split(':').map(Number)

  const windowOpen = new Date(sunday)
  windowOpen.setDate(sunday.getDate() + targetDay)
  windowOpen.setHours(openH, openM || 0, 0, 0)

  const windowClose = new Date(sunday)
  windowClose.setDate(sunday.getDate() + targetDay)
  windowClose.setHours(closeH, closeM || 0, 0, 0)

  const now = new Date()
  return now >= fromZonedTime(windowOpen, AU_TIMEZONE) && now <= fromZonedTime(windowClose, AU_TIMEZONE)
}

/**
 * Calculate dispute deadline (T + dispute_window_hrs)
 */
export function calculateDisputeDeadline(
  deliveredAt: Date,
  disputeWindowHrs: number = 6
): Date {
  return addHours(deliveredAt, disputeWindowHrs)
}

/**
 * Can buyer still dispute? Returns false after deadline
 */
export function canDispute(disputeDeadline: string | Date | null): boolean {
  if (!disputeDeadline) return false
  return isFuture(
    typeof disputeDeadline === 'string' ? new Date(disputeDeadline) : disputeDeadline
  )
}

/**
 * Time remaining until deadline — for countdown UI
 */
export function timeUntilDeadline(deadline: string | Date): string {
  const deadlineDate = typeof deadline === 'string' ? new Date(deadline) : deadline
  if (isPast(deadlineDate)) return 'Expired'

  const diffMs = deadlineDate.getTime() - Date.now()
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 0) return `${hours}h ${minutes}m remaining`
  return `${minutes}m remaining`
}
