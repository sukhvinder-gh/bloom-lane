import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/utils/permissions'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorised', status: 401 as const }
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!isAdminRole(profile?.role)) return { error: 'Admin access required', status: 403 as const }
  return { error: null, status: 200 as const }
}

// PATCH /api/admin/orders/picking-list — toggle picked_at (hub check-in) for
// a single order_item, marking it as physically arrived at the hub.
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const { item_id, picked } = body
  if (!item_id || typeof picked !== 'boolean') {
    return NextResponse.json({ error: 'item_id and picked (boolean) are required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('order_items')
    .update({ picked_at: picked ? new Date().toISOString() : null })
    .eq('id', item_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
