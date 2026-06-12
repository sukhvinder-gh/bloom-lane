import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/utils/permissions'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user: _authUser } } = await supabase.auth.getUser()
  if (!_authUser) return { error: 'Unauthorised', status: 401 as const, userId: null }
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', _authUser.id).single()
  if (!isAdminRole(profile?.role)) return { error: 'Admin access required', status: 403 as const, userId: null }
  return { error: null, status: 200 as const, userId: _authUser.id }
}

// PATCH /api/admin/orders/[id]/dates
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id: orderId } = await params
  const body = await request.json()
  const updates: Record<string, string | null> = {}

  if ('grower_fulfillment_date' in body) {
    updates.grower_fulfillment_date = body.grower_fulfillment_date || null
  }
  if ('florist_delivery_date' in body) {
    updates.florist_delivery_date = body.florist_delivery_date || null
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No date fields provided' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('orders')
    .update(updates)
    .eq('id', orderId)
    .select('id, order_number, grower_fulfillment_date, florist_delivery_date')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// GET /api/admin/orders/[id]/dates
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id: orderId } = await params
  const admin = createAdminClient()
  const [{ data: order }, { data: pos }] = await Promise.all([
    admin.from('orders')
      .select('id, order_number, grower_fulfillment_date, florist_delivery_date')
      .eq('id', orderId)
      .single(),
    admin.from('purchase_orders')
      .select('*, farmers(business_name)')
      .eq('order_id', orderId),
  ])

  return NextResponse.json({ order, purchase_orders: pos || [] })
}
