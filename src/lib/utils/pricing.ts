// src/lib/utils/pricing.ts
// All pricing logic lives here. Central truth for GST, markups, splits.
// AU GST = 10%. Prices stored as cents (integers) to avoid float errors.

import type { Product, PriceBreakdown, AppConfig } from '@/types'

const GST_RATE = 0.10

/**
 * Whether GST may legally be charged on this line.
 * Two independent conditions must both hold:
 *  - the product itself isn't a GST-free category (e.g. raw unprocessed food)
 *  - the supplying grower is actually GST-registered (only registered
 *    entities may charge GST, regardless of product category)
 */
export function gstAppliesToItem(
  product: Pick<Product, 'is_gst_free'>,
  growerGstRegistered: boolean
): boolean {
  return !product.is_gst_free && growerGstRegistered
}

/**
 * Calculate full price breakdown for a product.
 *
 * B2B: sees wholesale_price ex-GST, pays GST on top = wholesale * 1.10
 * B2C: sees retail_price = wholesale * (1 + markup), then + GST unless gst_free
 *
 * GST is only added if the product isn't GST-free AND the grower is GST-registered.
 */
export function getPriceBreakdown(
  product: Pick<Product, 'wholesale_price' | 'b2c_markup_pct' | 'is_gst_free' | 'unit'>,
  deliveryFeeCents: number = 0,
  growerGstRegistered: boolean = false
): PriceBreakdown {
  const { wholesale_price, b2c_markup_pct } = product

  // Wholesale (B2B) — price ex-GST
  const wholesale_ex_gst_cents = wholesale_price

  // Retail (B2C) — wholesale + markup, ex-GST
  const retail_ex_gst_cents = Math.round(wholesale_ex_gst_cents * (1 + b2c_markup_pct))

  // GST
  const gst_cents = gstAppliesToItem(product, growerGstRegistered)
    ? Math.round(retail_ex_gst_cents * GST_RATE)
    : 0

  // Retail inc-GST (what B2C buyer pays at checkout)
  const retail_inc_gst_cents = retail_ex_gst_cents + gst_cents

  return {
    wholesale_ex_gst_cents,
    retail_ex_gst_cents,
    gst_cents,
    retail_inc_gst_cents,
    delivery_fee_cents: deliveryFeeCents,
  }
}

/**
 * What price does a buyer pay per unit?
 * B2B pays wholesale + 10% GST (if the grower is GST-registered and the product isn't GST-free)
 * B2C pays retail (wholesale * markup) + 10% GST (same condition)
 */
export function getBuyerUnitPrice(
  product: Pick<Product, 'wholesale_price' | 'b2c_markup_pct' | 'is_gst_free'>,
  isB2B: boolean,
  growerGstRegistered: boolean = false
): number {
  const { wholesale_price, b2c_markup_pct } = product
  const gstApplies = gstAppliesToItem(product, growerGstRegistered)

  if (isB2B) {
    // B2B sees ex-GST price on invoice, but pays inc-GST
    const gst = gstApplies ? Math.round(wholesale_price * GST_RATE) : 0
    return wholesale_price + gst
  } else {
    const retail_ex_gst = Math.round(wholesale_price * (1 + b2c_markup_pct))
    const gst = gstApplies ? Math.round(retail_ex_gst * GST_RATE) : 0
    return retail_ex_gst + gst
  }
}

/**
 * Per-unit GST component in cents, for a single unit at the given price.
 * Mirrors getBuyerUnitPrice's GST decision so the two never drift apart.
 */
export function getUnitGstCents(
  product: Pick<Product, 'wholesale_price' | 'b2c_markup_pct' | 'is_gst_free'>,
  isB2B: boolean,
  growerGstRegistered: boolean = false
): number {
  const { wholesale_price, b2c_markup_pct } = product
  if (!gstAppliesToItem(product, growerGstRegistered)) return 0

  if (isB2B) {
    return Math.round(wholesale_price * GST_RATE)
  } else {
    const retail_ex_gst = Math.round(wholesale_price * (1 + b2c_markup_pct))
    return Math.round(retail_ex_gst * GST_RATE)
  }
}

/**
 * Display price — formatted string for UI
 * Always shows inc-GST for B2C, ex-GST label for B2B
 */
export function formatPrice(cents: number, showGstLabel = false): string {
  const dollars = (cents / 100).toFixed(2)
  const label = showGstLabel ? ' (ex-GST)' : ''
  return `$${dollars}${label}`
}

/**
 * Price per stem, for buyer comparison across growers who bunch differently.
 * - unit 'stem': the unit price already is the per-stem price.
 * - unit 'bunch' with stems_per_unit set: unit price / stems in the bunch.
 * - anything else (kg, tray, dozen, etc.): not a stem-comparable unit.
 */
export function getPricePerStemCents(
  product: Pick<Product, 'unit' | 'stems_per_unit'>,
  unitPriceCents: number
): number | null {
  if (product.unit === 'stem') return unitPriceCents
  if (product.unit === 'bunch' && product.stems_per_unit && product.stems_per_unit > 0) {
    return Math.round(unitPriceCents / product.stems_per_unit)
  }
  return null
}

/**
 * Calculate farmer payout for an order item
 * gross = item subtotal (what buyer paid)
 * commission = gross * commission_rate
 * net = gross - commission (what farmer receives)
 */
export function calculateFarmerPayout(
  subtotal_cents: number,
  commission_rate: number
): { gross: number; commission: number; net: number } {
  const commission = Math.round(subtotal_cents * commission_rate)
  return {
    gross: subtotal_cents,
    commission,
    net: subtotal_cents - commission,
  }
}

/**
 * Calculate order totals from cart items.
 * Each item's gst_cents must already reflect that line's own gst_applied
 * decision (see gstAppliesToItem) — computed per-unit via getUnitGstCents
 * and multiplied by quantity. We just sum here, never re-derive, so the
 * order total and the per-line GST snapshot can't drift apart.
 */
export function calculateOrderTotals(
  items: Array<{ unit_price_cents: number; quantity: number; gst_cents: number }>,
  deliveryFeeCents: number
): { subtotal: number; gst: number; delivery: number; total: number } {
  const subtotal = items.reduce((sum, item) => sum + item.unit_price_cents * item.quantity, 0)
  const gst = items.reduce((sum, item) => sum + item.gst_cents, 0)

  return {
    subtotal,
    gst,
    delivery: deliveryFeeCents,
    total: subtotal + deliveryFeeCents,
  }
}

/**
 * Stock split calculator
 * Returns how much stock to reserve for B2B vs B2C
 */
export function calculateStockSplits(
  totalStock: number,
  b2bPct: number = 0.8
): { b2b: number; b2c: number } {
  const b2b = Math.floor(totalStock * b2bPct)
  return { b2b, b2c: totalStock - b2b }
}
