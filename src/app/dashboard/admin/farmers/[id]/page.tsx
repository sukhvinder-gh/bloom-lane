import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import EditFarmerForm from './EditFarmerForm'

export default async function AdminFarmerEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: farmer } = await admin
    .from('farmers')
    .select(`
      *,
      profiles!farmers_user_id_fkey (
        id, email, full_name, phone
      )
    `)
    .eq('id', id)
    .single()

  if (!farmer) notFound()

  return <EditFarmerForm farmer={farmer} />
}
