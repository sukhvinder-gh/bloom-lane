import { createAdminClient } from '@/lib/supabase/server'
import { Suspense } from 'react'
import FarmersContent from './FarmersContent'
import { getCommissionRates, effectiveCommissionRate } from '@/lib/utils/commission'

export const dynamic = 'force-dynamic'

export default async function AdminFarmersPage() {
  const admin = createAdminClient()
  const { data: initialFarmers } = await admin
    .from('farmers')
    .select('*, profiles!farmers_user_id_fkey(id, email, full_name, phone)')
    .order('created_at', { ascending: false })

  // The list's Commission column shows what each grower is actually charged.
  const rates = await getCommissionRates(admin)
  const farmers = (initialFarmers || []).map(f => ({ ...f, commission_rate: effectiveCommissionRate(f, rates) }))

  return (
    <Suspense fallback={<div className="page-pad" style={{ padding: '2.5rem', color: 'var(--moss)', opacity: 0.5 }}>Loading growers...</div>}>
      <FarmersContent initialFarmers={farmers} />
    </Suspense>
  )
}
