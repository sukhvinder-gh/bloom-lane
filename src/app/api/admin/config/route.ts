import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'
import { isSuperAdminRole } from '@/lib/utils/permissions'

async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user: _authUser } } = await supabase.auth.getUser()
  if (!_authUser) return { error: 'Unauthorized', status: 401 as const }
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', _authUser.id).single()
  if (!isSuperAdminRole(profile?.role)) return { error: 'Forbidden', status: 403 as const }
  return { userId: _authUser.id }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const { key, value } = body

  if (!key || value === undefined || value === null) {
    return NextResponse.json({ error: 'key and value are required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('config')
    .upsert({ key, value: String(value), updated_at: new Date().toISOString() }, { onConflict: 'key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
