import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardRootPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = profile?.role
  if (role === 'admin')  redirect('/dashboard/admin')
  if (role === 'farmer') redirect('/dashboard/farmer')
  redirect('/dashboard/buyer')
}
