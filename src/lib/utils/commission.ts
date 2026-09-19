// src/lib/utils/commission.ts
// Single place that decides what commission rate a grower is charged. Both
// rates are platform-wide settings in Admin > Config:
//
//   Free Grower Listing plan  -> config.wholesale_commission_pct
//   everyone else             -> config.commission_rate_default
//
// The per-grower farmers.commission_rate column is no longer used to charge
// anyone, so changing a rate in Config changes it for every grower at once.

import { createAdminClient } from '@/lib/supabase/server'

export const FALLBACK_COMMISSION_RATE = 0.10
export const FALLBACK_FREE_LISTING_RATE = 0.15

export type CommissionRates = { standard: number; freeListing: number }

function validRate(value: string | null | undefined, fallback: number): number {
  const rate = parseFloat(value ?? '')
  return Number.isFinite(rate) && rate >= 0 && rate < 1 ? rate : fallback
}

export async function getCommissionRates(
  admin: ReturnType<typeof createAdminClient>
): Promise<CommissionRates> {
  const { data } = await admin
    .from('config').select('key, value')
    .in('key', ['commission_rate_default', 'wholesale_commission_pct'])
  const byKey = new Map((data || []).map(r => [r.key, r.value]))
  return {
    standard: validRate(byKey.get('commission_rate_default'), FALLBACK_COMMISSION_RATE),
    freeListing: validRate(byKey.get('wholesale_commission_pct'), FALLBACK_FREE_LISTING_RATE),
  }
}

export function effectiveCommissionRate(
  farmer: { subscription_type?: string | null },
  rates: CommissionRates
): number {
  return farmer.subscription_type === 'wholesale_collection' ? rates.freeListing : rates.standard
}
