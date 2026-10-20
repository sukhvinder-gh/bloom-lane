// Human-readable order numbers — the old 'ORD-' + random UUID chunk gave
// buyers/growers/admin nothing to recognise at a glance. This swaps in the
// buyer's own initials plus the order's placed-at time (Sydney, to the
// minute), so "ORD-JOHN-2610171435" reads as "John, 17 Oct 2:35pm" instead
// of an opaque hex string.
import { formatAEST } from './timezone'

// Avoids 0/O and 1/I so a misread character can't be guessed wrong.
const SUFFIX_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomSuffix(length: number): string {
  let out = ''
  for (let i = 0; i < length; i++) out += SUFFIX_CHARS[Math.floor(Math.random() * SUFFIX_CHARS.length)]
  return out
}

export function generateOrderNumber(buyerName: string | null | undefined): string {
  const initials = (buyerName || '').replace(/[^a-zA-Z]/g, '').toUpperCase().padEnd(4, 'X').slice(0, 4)
  const stamp = formatAEST(new Date(), 'yyMMddHHmm')
  // The 2-char random suffix is the real uniqueness guarantee (order_number
  // is UNIQUE) — initials+minute alone could collide if the same buyer
  // places two orders inside the same minute.
  return `ORD-${initials}-${stamp}-${randomSuffix(2)}`
}
