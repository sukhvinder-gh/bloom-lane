import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/utils/permissions'

async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!isAdminRole(profile?.role)) return { error: 'Forbidden', status: 403 as const }
  return { admin }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin()
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status })

  const { id } = await params

  const { data: farmers, error } = await check.admin
    .from('farmers')
    .select('id, business_name, user_id, profiles!farmers_user_id_fkey(full_name, email)')
    .eq('hub_id', id)
    .order('business_name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // subscriptions.user_id has no foreign key to farmers (it points at
  // profiles), so PostgREST can't auto-embed it under the query above —
  // fetch and merge separately instead.
  const userIds = (farmers || []).map(f => f.user_id)
  const { data: subs } = userIds.length
    ? await check.admin.from('subscriptions').select('user_id, status, plan, expires_at').in('user_id', userIds).eq('subscriber_type', 'grower')
    : { data: [] }

  const data = (farmers || []).map(f => ({
    ...f,
    subscriptions: (subs || []).filter(s => s.user_id === f.user_id),
  }))

  return NextResponse.json({ data })
}
