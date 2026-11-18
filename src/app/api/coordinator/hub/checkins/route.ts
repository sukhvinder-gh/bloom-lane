import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/utils/permissions'

async function requireCoordinator(hubId: string) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (isAdminRole(profile?.role)) return { admin, userId: user.id }

  const { data: hub } = await admin.from('hubs').select('id').eq('id', hubId).eq('coordinator_id', user.id).maybeSingle()
  if (!hub) return { error: 'Forbidden', status: 403 as const }
  return { admin, userId: user.id }
}

// GET — purchase orders routed to this hub as a collection point, due for
// collection on the given date, with any existing check-ins attached.
export async function GET(request: NextRequest) {
  const hubId = request.nextUrl.searchParams.get('hub_id') || ''
  const date = request.nextUrl.searchParams.get('date') || ''
  if (!hubId || !date) return NextResponse.json({ error: 'hub_id and date are required' }, { status: 400 })

  const check = await requireCoordinator(hubId)
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status })
  const { admin } = check

  // Every farmer_fulfillment_options row for this hub — a PO's
  // fulfillment_option_id must be one of these to count as routed here.
  const { data: options } = await admin
    .from('farmer_fulfillment_options')
    .select('id')
    .eq('hub_id', hubId)
    .eq('type', 'collection_point')
  const optionIds = (options || []).map(o => o.id)
  if (optionIds.length === 0) return NextResponse.json({ data: [] })

  const dayStart = new Date(`${date}T00:00:00`)
  const dayEnd = new Date(`${date}T23:59:59.999`)

  const { data: pos, error } = await admin
    .from('purchase_orders')
    .select('id, grower_fulfillment_date, order_id, farmer_id, orders(order_number, buyer_id, profiles(full_name, business_name)), farmers(business_name), collection_point_checkins(checkin_type, checked_in_at)')
    .in('fulfillment_option_id', optionIds)
    .gte('grower_fulfillment_date', dayStart.toISOString())
    .lte('grower_fulfillment_date', dayEnd.toISOString())
    .order('grower_fulfillment_date', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const data = (pos || []).map((po: any) => ({
    purchase_order_id: po.id,
    order_number: po.orders?.order_number,
    buyer_name: po.orders?.profiles?.business_name || po.orders?.profiles?.full_name || 'Buyer',
    farmer_name: po.farmers?.business_name || 'Grower',
    grower_fulfillment_date: po.grower_fulfillment_date,
    grower_dropoff: (po.collection_point_checkins || []).find((c: any) => c.checkin_type === 'grower_dropoff') || null,
    buyer_collection: (po.collection_point_checkins || []).find((c: any) => c.checkin_type === 'buyer_collection') || null,
  }))

  return NextResponse.json({ data })
}

// POST — check in a grower drop-off or buyer collection for one purchase order.
export async function POST(request: NextRequest) {
  const { purchase_order_id, checkin_type, hub_id } = await request.json()
  if (!purchase_order_id || !checkin_type || !hub_id) {
    return NextResponse.json({ error: 'purchase_order_id, checkin_type and hub_id are required' }, { status: 400 })
  }
  if (!['grower_dropoff', 'buyer_collection'].includes(checkin_type)) {
    return NextResponse.json({ error: 'Invalid checkin_type' }, { status: 400 })
  }

  const check = await requireCoordinator(hub_id)
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status })
  const { admin, userId } = check

  // Confirm this PO is actually routed to this hub before allowing the write.
  const { data: po } = await admin
    .from('purchase_orders')
    .select('id, fulfillment_option_id, farmer_fulfillment_options(hub_id)')
    .eq('id', purchase_order_id)
    .maybeSingle()
  if (!po || (po as any).farmer_fulfillment_options?.hub_id !== hub_id) {
    return NextResponse.json({ error: 'Purchase order not found for this hub' }, { status: 404 })
  }

  const { error } = await admin
    .from('collection_point_checkins')
    .upsert(
      { purchase_order_id, checkin_type, checked_in_at: new Date().toISOString(), checked_in_by: userId },
      { onConflict: 'purchase_order_id,checkin_type' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — undo a check-in (mis-click recovery).
export async function DELETE(request: NextRequest) {
  const { purchase_order_id, checkin_type, hub_id } = await request.json()
  if (!purchase_order_id || !checkin_type || !hub_id) {
    return NextResponse.json({ error: 'purchase_order_id, checkin_type and hub_id are required' }, { status: 400 })
  }

  const check = await requireCoordinator(hub_id)
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status })

  const { error } = await check.admin
    .from('collection_point_checkins')
    .delete()
    .eq('purchase_order_id', purchase_order_id)
    .eq('checkin_type', checkin_type)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
