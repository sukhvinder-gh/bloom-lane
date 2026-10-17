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
  'markup_pct_b2c',
  'commission_rate_default',
  'delivery_fee_cents',
  'min_order_b2b_cents',
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
  'b2b_stock_pct',
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
