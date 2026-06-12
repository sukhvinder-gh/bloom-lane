import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/utils/permissions'

async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user: _authUser } } = await supabase.auth.getUser()
  if (!_authUser) return { error: 'Unauthorized', status: 401 as const }
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', _authUser.id).single()
  if (!isAdminRole(profile?.role)) return { error: 'Forbidden', status: 403 as const }
  return { userId: _authUser.id }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('farmers')
    .select(`
      *,
      profiles!farmers_user_id_fkey (
        id, email, full_name, phone
      )
    `)
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const body = await request.json()

  const ALLOWED = [
    'status',
    'business_name', 'bio', 'suburb', 'state', 'region',
    'growing_practices', 'seasonal_specialties', 'sustainability',
    'brand_color', 'banner_url', 'logo_url',
    'commission_rate', 'abn', 'abn_verified',
  ]

  const updates: Record<string, unknown> = {}
  for (const key of ALLOWED) {
    if (key in body) updates[key] = body[key]
  }

  if (updates.status === 'approved') {
    updates.approved_at = new Date().toISOString()
    updates.approved_by = auth.userId
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('farmers')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
