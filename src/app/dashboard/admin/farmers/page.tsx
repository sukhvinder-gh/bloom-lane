import { createAdminClient } from '@/lib/supabase/server'
import { Suspense } from 'react'
import FarmersContent from './FarmersContent'

export default async function AdminFarmersPage() {
  const admin = createAdminClient()
  const { data: initialFarmers } = await admin
    .from('farmers')
    .select('*, profiles!farmers_user_id_fkey(id, email, full_name, phone)')
    .order('created_at', { ascending: false })

  return (
    <Suspense fallback={<div className="page-pad" style={{ padding: '2.5rem', color: 'var(--moss)', opacity: 0.5 }}>Loading growers...</div>}>
      <FarmersContent initialFarmers={initialFarmers || []} />
    </Suspense>
  )
}
