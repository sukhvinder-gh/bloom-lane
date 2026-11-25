import { getSessionUserFromCookie, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { isAdminRole, hasBuyerRole } from '@/lib/utils/permissions'
import BuyerSidebar from './BuyerSidebar'

export default async function BuyerLayout({ children }: { children: ReactNode }) {
  const sessionUser = await getSessionUserFromCookie()
  if (!sessionUser) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role, secondary_role, full_name')
    .eq('id', sessionUser.id)
    .single()

  const role = profile?.role || ''
  const isAdmin = isAdminRole(role)

  if (!hasBuyerRole(profile) && !isAdmin) redirect('/dashboard')

  // Dual-role (grower + buyer) users get a link back to their grower
  // dashboard — same pattern already used for admin accounts that also run
  // a storefront (see src/app/dashboard/admin/layout.tsx).
  const { data: farmerRecord } = await admin.from('farmers').select('id').eq('user_id', sessionUser.id).maybeSingle()

  return (
    <div className="dashboard-shell" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <BuyerSidebar
        role={role}
        userName={profile?.full_name || ''}
        userEmail={sessionUser.email || ''}
        hasGrowerAccount={!!farmerRecord}
      />
      <main style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
