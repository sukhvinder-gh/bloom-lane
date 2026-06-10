import { createAdminClient } from '@/lib/supabase/server'
import BuyersContent from './BuyersContent'

export default async function AdminBuyersPage() {
  const admin = createAdminClient()
  const { data: initialBuyers } = await admin
    .from('profiles')
    .select('id, email, full_name, role, abn, abn_verified, business_name, phone, created_at')
    .in('role', ['buyer_b2b', 'buyer_b2c'])
    .order('created_at', { ascending: false })

  return <BuyersContent initialBuyers={initialBuyers || []} />
}
