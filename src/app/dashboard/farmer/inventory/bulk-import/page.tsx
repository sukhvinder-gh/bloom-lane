import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import BulkImportContent from './BulkImportContent'

export default async function BulkImportPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: farmer } = await admin.from('farmers').select('status').eq('user_id', user.id).single()
  if (!farmer || farmer.status !== 'approved') redirect('/dashboard/farmer')

  return <BulkImportContent />
}
