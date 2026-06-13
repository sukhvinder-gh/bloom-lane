import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/utils/permissions'

const HUB_SELECT = '*, profiles!hubs_coordinator_id_fkey(full_name, email)'

async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!isAdminRole(profile?.role)) return { error: 'Forbidden', status: 403 as const }
  return { admin }
}

export async function GET() {
  const check = await requireAdmin()
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status })

  const { data, error } = await check.admin
    .from('hubs')
    .select(HUB_SELECT)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data || [] })
}

export async function POST(request: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status })

  const { name, region, coordinator_id } = await request.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Hub name is required' }, { status: 400 })

  const { data, error } = await check.admin
    .from('hubs')
    .insert({
      name: name.trim(),
      region: region?.trim() || null,
      coordinator_id: coordinator_id || null,
      status: 'active',
    })
    .select(HUB_SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, hub: data })
}

export async function PATCH(request: NextRequest) {
  const check = await requireAdmin()
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status })

  const body = await request.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.status !== undefined)         updates.status         = body.status
  if (body.name  !== undefined)          updates.name           = body.name.trim()
  if (body.region !== undefined)         updates.region         = body.region?.trim() || null
  if ('coordinator_id' in body)          updates.coordinator_id = body.coordinator_id || null

  const { data, error } = await check.admin
    .from('hubs')
    .update(updates)
    .eq('id', id)
    .select(HUB_SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, hub: data })
}
