import { getSessionUserFromCookie, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import BuyerSidebar from './BuyerSidebar'

export default async function BuyerLayout({ children }: { children: ReactNode }) {
  const sessionUser = await getSessionUserFromCookie()
  if (!sessionUser) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role, full_name')
    .eq('id', sessionUser.id)
    .single()

  const role = profile?.role || ''
  const isBuyer = role === 'buyer_b2b' || role === 'buyer_b2c'
  const isAdmin = role === 'admin' || role === 'super_admin' || role === 'platform_admin'

  if (!isBuyer && !isAdmin) redirect('/dashboard')

  return (
    <div className="dashboard-shell" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <BuyerSidebar
        role={role}
        userName={profile?.full_name || ''}
        userEmail={sessionUser.email || ''}
      />
      <main style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
