import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import EditBuyerForm from './EditBuyerForm'

export const dynamic = 'force-dynamic'

export default async function AdminBuyerEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: buyer } = await admin
    .from('profiles')
    .select('id, email, full_name, phone, role, abn, abn_verified, business_name, created_at')
    .eq('id', id)
    .single()

  if (!buyer) notFound()

  return <EditBuyerForm buyer={buyer} />
}
