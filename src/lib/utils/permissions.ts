export const ADMIN_ROLES       = ['admin', 'super_admin', 'platform_admin'] as const
export const SUPER_ADMIN_ROLES = ['admin', 'super_admin'] as const

export type AdminRole = typeof ADMIN_ROLES[number]

export function isAdminRole(role: string | null | undefined): boolean {
  return (ADMIN_ROLES as readonly string[]).includes(role || '')
}

export function isSuperAdminRole(role: string | null | undefined): boolean {
  return (SUPER_ADMIN_ROLES as readonly string[]).includes(role || '')
}

// Config keys that only super_admin / admin can change (pricing, platform identity)
export const SUPER_ADMIN_CONFIG_KEYS = new Set([
  'commission_rate_default',
  'hub_membership_monthly_cents',
  'hub_membership_seasonal_cents',
  'hub_membership_annual_cents',
  'wholesale_commission_pct',
  'personal_shopper_weekly_cents',
  'personal_shopper_monthly_cents',
  'personal_shopper_annual_cents',
  'coordinator_registration_cents',
  'platform_name',
])

// Config keys platform_admin can edit (operations)
export const PLATFORM_ADMIN_CONFIG_KEYS = new Set([
  'listing_window_close_time',
  'portal_background',
])

export function canEditConfigKey(key: string, role: string | null | undefined): boolean {
  if (isSuperAdminRole(role)) return true
  if (isAdminRole(role)) return PLATFORM_ADMIN_CONFIG_KEYS.has(key)
  return false
}

export function canEditPricing(role: string | null | undefined): boolean {
  return isSuperAdminRole(role)
}

export function canEditCommission(role: string | null | undefined): boolean {
  return isSuperAdminRole(role)
}

export function canManageInventory(role: string | null | undefined): boolean {
  return isAdminRole(role)
}

export function canEditConfig(role: string | null | undefined): boolean {
  return isSuperAdminRole(role)
}

// Dual-role accounts: profiles.role is the primary/default role; secondary_role
// is an additive second capability on the same account (see migration 062).
// Grower is always primary when an account has both — these helpers check
// both slots so it doesn't matter which one happens to hold "farmer".
const BUYER_ROLES = ['buyer_b2b', 'buyer_b2c'] as const

export function hasGrowerRole(p: { role?: string | null; secondary_role?: string | null } | null | undefined): boolean {
  return p?.role === 'farmer' || p?.secondary_role === 'farmer'
}

export function hasBuyerRole(p: { role?: string | null; secondary_role?: string | null } | null | undefined): boolean {
  return (BUYER_ROLES as readonly string[]).includes(p?.role || '') || (BUYER_ROLES as readonly string[]).includes(p?.secondary_role || '')
}

// Which buyer sub-type (b2b vs b2c) applies, regardless of whether it's
// sitting in role or secondary_role — used for B2B pricing-tier checks.
export function buyerSubRole(p: { role?: string | null; secondary_role?: string | null } | null | undefined): 'buyer_b2b' | 'buyer_b2c' | null {
  if (p?.role === 'buyer_b2b' || p?.role === 'buyer_b2c') return p.role
  if (p?.secondary_role === 'buyer_b2b' || p?.secondary_role === 'buyer_b2c') return p.secondary_role as 'buyer_b2b' | 'buyer_b2c'
  return null
}

export function roleLabel(role: string | null | undefined): string {
  switch (role) {
    case 'super_admin':    return 'Super Admin'
    case 'platform_admin': return 'Platform Admin'
    case 'admin':          return 'Admin'
    case 'farmer':         return 'Grower'
    case 'buyer_b2b':      return 'B2B Buyer'
    case 'buyer_b2c':      return 'B2C Buyer'
    case 'coordinator':    return 'Coordinator'
    default:               return role || 'Unknown'
  }
}
