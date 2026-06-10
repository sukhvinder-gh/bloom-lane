import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isAdminRole } from '@/lib/utils/permissions'

export default async function DashboardRootPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  const role = profile?.role || ''
  if (isAdminRole(role)) redirect('/dashboard/admin')
  if (role === 'farmer')  redirect('/dashboard/farmer')
  redirect('/dashboard/buyer')
}
