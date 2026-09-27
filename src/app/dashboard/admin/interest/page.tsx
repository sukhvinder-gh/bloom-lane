import { createAdminClient } from '@/lib/supabase/server'
import InterestContent from './InterestContent'

export const dynamic = 'force-dynamic'

export default async function AdminInterestPage() {
  const admin = createAdminClient()
  const { data: initialInterest } = await admin
    .from('interest_registrations')
    .select('*')
    .order('created_at', { ascending: false })

  return <InterestContent initialInterest={initialInterest || []} />
}
