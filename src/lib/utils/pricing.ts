// src/lib/utils/pricing.ts
// All pricing logic lives here. Central truth for GST, markups, splits.
// AU GST = 10%. Prices stored as cents (integers) to avoid float errors.

import type { Product, PriceBreakdown, AppConfig } from '@/types'

const GST_RATE = 0.10

/**
 * Calculate full price breakdown for a product.
 * 
 * B2B: sees wholesale_price ex-GST, pays GST on top = wholesale * 1.10
 * B2C: sees retail_price = wholesale * (1 + markup), then + GST unless gst_free
 * 
 * GST-free products (raw unprocessed food): no GST at any tier
 */
export function getPriceBreakdown(
  product: Pick<Product, 'wholesale_price' | 'b2c_markup_pct' | 'is_gst_free' | 'unit'>,
  deliveryFeeCents: number = 0
): PriceBreakdown {
  const { wholesale_price, b2c_markup_pct, is_gst_free } = product

  // Wholesale (B2B) — price ex-GST
  const wholesale_ex_gst_cents = wholesale_price

  // Retail (B2C) — wholesale + markup, ex-GST
  const retail_ex_gst_cents = Math.round(wholesale_ex_gst_cents * (1 + b2c_markup_pct))

  // GST
  const gst_cents = is_gst_free ? 0 : Math.round(retail_ex_gst_cents * GST_RATE)

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
 * B2B pays wholesale + 10% GST (unless gst_free)
 * B2C pays retail (wholesale * markup) + 10% GST (unless gst_free)
 */
export function getBuyerUnitPrice(
  product: Pick<Product, 'wholesale_price' | 'b2c_markup_pct' | 'is_gst_free'>,
  isB2B: boolean
): number {
  const { wholesale_price, b2c_markup_pct, is_gst_free } = product

  if (isB2B) {
    // B2B sees ex-GST price on invoice, but pays inc-GST
    const gst = is_gst_free ? 0 : Math.round(wholesale_price * GST_RATE)
    return wholesale_price + gst
  } else {
    const retail_ex_gst = Math.round(wholesale_price * (1 + b2c_markup_pct))
    const gst = is_gst_free ? 0 : Math.round(retail_ex_gst * GST_RATE)
    return retail_ex_gst + gst
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
 * Calculate order totals from cart items
 */
export function calculateOrderTotals(
  items: Array<{ unit_price_cents: number; quantity: number; is_gst_free?: boolean; is_b2b?: boolean }>,
  deliveryFeeCents: number,
  isB2B: boolean
): { subtotal: number; gst: number; delivery: number; total: number } {
  const subtotal = items.reduce((sum, item) => sum + item.unit_price_cents * item.quantity, 0)

  // For B2B invoicing: extract GST component for display
  const gst = isB2B
    ? items.reduce((sum, item) => {
        if (item.is_gst_free) return sum
        // GST is already included in unit_price for B2B
        return sum + Math.round((item.unit_price_cents * item.quantity * GST_RATE) / (1 + GST_RATE))
      }, 0)
    : 0 // B2C: GST is baked into retail price, not shown separately

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
