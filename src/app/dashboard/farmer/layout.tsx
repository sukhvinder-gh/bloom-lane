import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { isAdminRole } from '@/lib/utils/permissions'
import FarmerSidebar from './FarmerSidebar'

export default async function FarmerLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  const role = profile?.role || ''
  if (role !== 'farmer' && !isAdminRole(role)) redirect('/dashboard')

  const admin = createAdminClient()
  const { data: farmer } = await admin
    .from('farmers')
    .select('id, business_name, status')
    .eq('user_id', user.id)
    .maybeSingle()

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <FarmerSidebar
        role={role}
        userName={profile?.full_name || ''}
        userEmail={user.email || ''}
        businessName={farmer?.business_name || ''}
        farmerId={farmer?.id || null}
        farmerStatus={farmer?.status || null}
      />
      <main style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
