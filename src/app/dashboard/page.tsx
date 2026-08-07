import { getSessionUserFromCookie, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isAdminRole } from '@/lib/utils/permissions'

export default async function DashboardRootPage() {
  const sessionUser = await getSessionUserFromCookie()
  if (!sessionUser) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', sessionUser.id)
    .single()

  const role = profile?.role || ''
  if (isAdminRole(role)) redirect('/dashboard/admin')
  if (role === 'farmer')  redirect('/dashboard/farmer')
  // Coordinators have no buyer/farmer-shaped dashboard of their own yet —
  // falling through to /dashboard/buyer used to send them straight into a
  // redirect loop, since that layout immediately bounces anyone who isn't
  // a buyer back to /dashboard (a blank/stuck page in the browser).
  if (role === 'coordinator') redirect('/dashboard/coordinator/hub/register')
  redirect('/dashboard/buyer')
}
