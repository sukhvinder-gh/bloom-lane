export const ADMIN_ROLES       = ['admin', 'super_admin', 'platform_admin'] as const
export const SUPER_ADMIN_ROLES = ['admin', 'super_admin'] as const

export type AdminRole = typeof ADMIN_ROLES[number]

export function isAdminRole(role: string | null | undefined): boolean {
  return (ADMIN_ROLES as readonly string[]).includes(role || '')
}

export function isSuperAdminRole(role: string | null | undefined): boolean {
  return (SUPER_ADMIN_ROLES as readonly string[]).includes(role || '')
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
    default:               return role || 'Unknown'
  }
}
