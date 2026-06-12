import { createAdminClient } from '@/lib/supabase/server'
import HubsContent from './HubsContent'

export const dynamic = 'force-dynamic'

export default async function AdminHubsPage() {
  const admin = createAdminClient()
  const { data: hubs } = await admin
    .from('hubs')
    .select('*, profiles!hubs_coordinator_id_fkey(full_name, email)')
    .order('created_at', { ascending: false })

  return <HubsContent initialHubs={hubs || []} />
}
