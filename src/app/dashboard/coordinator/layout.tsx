import { getSessionUserFromCookie, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { isAdminRole } from '@/lib/utils/permissions'
import CoordinatorSidebar from './CoordinatorSidebar'

export default async function CoordinatorLayout({ children }: { children: ReactNode }) {
  const sessionUser = await getSessionUserFromCookie()
  if (!sessionUser) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role, full_name').eq('id', sessionUser.id).single()

  const role = profile?.role || ''
  if (role !== 'coordinator' && !isAdminRole(role)) redirect('/dashboard')

  return (
    <div className="dashboard-shell" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <CoordinatorSidebar role={role} userName={profile?.full_name || ''} userEmail={sessionUser.email || ''} />
      <main style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
