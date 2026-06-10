import { getSessionUserFromCookie, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { isAdminRole } from '@/lib/utils/permissions'
import AdminSidebar from './AdminSidebar'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const sessionUser = await getSessionUserFromCookie()
  if (!sessionUser) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role, full_name')
    .eq('id', sessionUser.id)
    .single()

  if (!isAdminRole(profile?.role)) redirect('/dashboard')

  const { data: farmerRecord } = await admin
    .from('farmers')
    .select('id')
    .eq('user_id', sessionUser.id)
    .maybeSingle()

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <AdminSidebar
        role={profile?.role || ''}
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
