import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/utils/permissions'

// PATCH /api/admin/orders/[id]/dates
// Admin sets grower_fulfillment_date and/or florist_delivery_date on an order.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!isAdminRole(profile?.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

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

// GET /api/admin/orders/[id]/dates — returns current dates + any rejected POs for this order
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!isAdminRole(profile?.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

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
