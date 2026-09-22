import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'

// GET — the growers who've joined this coordinator's own hub(s). Coordinators
// previously had no way to see this at all — only the admin Hubs page could.
export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: hubs } = await admin.from('hubs').select('id').eq('coordinator_id', user.id)
  const hubIds = (hubs || []).map(h => h.id)
  if (hubIds.length === 0) return NextResponse.json({ data: [] })

  const { data, error } = await admin
    .from('farmers')
    .select('id, business_name, hub_id, profiles!farmers_user_id_fkey(full_name, email), subscriptions(status, plan, expires_at)')
    .in('hub_id', hubIds)
    .order('business_name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data || [] })
}
