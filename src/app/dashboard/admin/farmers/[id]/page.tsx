import { notFound } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import EditFarmerForm from './EditFarmerForm'

export default async function AdminFarmerEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient()

  const [{ data: profile }, { data: farmer }] = await Promise.all([
    user ? supabase.from('profiles').select('role').eq('id', user!.id).single() : Promise.resolve({ data: null }),
    admin.from('farmers').select(`*, profiles!farmers_user_id_fkey(id, email, full_name, phone)`).eq('id', id).single(),
  ])

  if (!farmer) notFound()

  return <EditFarmerForm farmer={farmer} requesterRole={profile?.role || ''} />
}
