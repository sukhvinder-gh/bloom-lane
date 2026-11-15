// Human-readable order numbers — the old 'ORD-' + random UUID chunk gave
// buyers/growers/admin nothing to recognise at a glance. This swaps in the
// buyer's own initials plus the order's placed-at time (Sydney), so
// "ORD-JOHN-171026143512" reads as "John, 17 Oct 2:35:12pm" instead of an
// opaque hex string.
import { formatAEST } from './timezone'

export function generateOrderNumber(buyerName: string | null | undefined): string {
  const initials = (buyerName || '').replace(/[^a-zA-Z]/g, '').toUpperCase().padEnd(4, 'X').slice(0, 4)
  // order_number is UNIQUE in the DB with no insert-retry — ddMMyy (reversed
  // from the old yyMMdd) plus seconds, not just minutes, is what keeps two
  // orders from the same buyer placed close together from colliding.
  const stamp = formatAEST(new Date(), 'ddMMyyHHmmss')
  return `ORD-${initials}-${stamp}`
}
