import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const ACTIVE_PO_STATUSES = ['pending', 'ready']

async function requireFarmer() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const, farmer: null, admin: null }
  const admin = createAdminClient()
  const { data: farmer } = await admin.from('farmers').select('id, business_name').eq('user_id', user.id).single()
  if (!farmer) return { error: 'Farmer account not found', status: 403 as const, farmer: null, admin: null }
  return { error: null, status: 200 as const, farmer, admin }
}

function mondayOf(d: Date): Date {
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1) - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

// GET /api/farmer/pack-list?from=YYYY-MM-DD&to=YYYY-MM-DD
// One row per order (not aggregated) — packing is done order by order —
// scoped to orders whose admin-set harvest/fulfilment date falls in
// [from, to], defaulting to the current Mon–Sun week.
export async function GET(request: NextRequest) {
  const check = await requireFarmer()
  if (check.error || !check.farmer || !check.admin) return NextResponse.json({ error: check.error }, { status: check.status })
  const { farmer, admin } = check

  const url = new URL(request.url)
  let from = url.searchParams.get('from')
  let to = url.searchParams.get('to')
  if (!from || !to) {
    const monday = mondayOf(new Date())
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    from = monday.toISOString().slice(0, 10)
    to = sunday.toISOString().slice(0, 10)
  }

  const { data: pos } = await admin
    .from('purchase_orders')
    .select('order_id, status, pickup_method')
    .eq('farmer_id', farmer.id)
    .in('status', ACTIVE_PO_STATUSES)

  const activeOrderIds = [...new Set((pos || []).map((p: any) => p.order_id))]
  const pickupMethodByOrder = new Map((pos || []).map((p: any) => [p.order_id, p.pickup_method]))

  if (activeOrderIds.length === 0) {
    return NextResponse.json({ data: { orders: [], order_count: 0, unscheduled_order_count: 0, from, to } })
  }

  const { data: allActiveOrders } = await admin
    .from('orders')
    .select('id, order_number, created_at, fulfillment_type, buyer_id, grower_fulfillment_date, order_items(id, quantity, notes, packed_at, products(name, unit))')
    .in('id', activeOrderIds)
    .eq('order_items.farmer_id', farmer.id)
    .order('created_at', { ascending: true })

  const unscheduledCount = (allActiveOrders || []).filter((o: any) => !o.grower_fulfillment_date).length

  const scopedOrders = (allActiveOrders || []).filter((o: any) => {
    if (!o.grower_fulfillment_date) return false
    const t = new Date(o.grower_fulfillment_date).getTime()
    return t >= new Date(from!).getTime() && t <= new Date(`${to}T23:59:59`).getTime()
  })

  const buyerIds = [...new Set(scopedOrders.map((o: any) => o.buyer_id))]
  const { data: buyers } = buyerIds.length > 0
    ? await admin.from('profiles').select('id, full_name, business_name').in('id', buyerIds)
    : { data: [] as any[] }
  const buyerById = new Map((buyers || []).map((b: any) => [b.id, b]))

  const now = Date.now()
  const orders = scopedOrders
    .sort((a: any, b: any) => new Date(a.grower_fulfillment_date).getTime() - new Date(b.grower_fulfillment_date).getTime())
    .map((o: any) => {
      const items = o.order_items || []
      const allPacked = items.length > 0 && items.every((i: any) => !!i.packed_at)
      const overdue = !allPacked && new Date(o.grower_fulfillment_date).getTime() < now
      const buyer = buyerById.get(o.buyer_id)
      return {
        id: o.id,
        order_number: o.order_number,
        created_at: o.created_at,
        grower_fulfillment_date: o.grower_fulfillment_date,
        fulfillment_type: o.fulfillment_type,
        pickup_method: pickupMethodByOrder.get(o.id) || null,
        buyer_name: buyer?.business_name || buyer?.full_name || 'Buyer',
        items,
        all_packed: allPacked,
        overdue,
      }
    })

  return NextResponse.json({
    data: { orders, order_count: orders.length, unscheduled_order_count: unscheduledCount, from, to },
  })
}

// PATCH /api/farmer/pack-list — toggle packed_at for either a single item
// (item_id) or every item in one order at once (order_id), always scoped
// to this farmer's own order_items.
export async function PATCH(request: NextRequest) {
  const check = await requireFarmer()
  if (check.error || !check.farmer || !check.admin) return NextResponse.json({ error: check.error }, { status: check.status })
  const { farmer, admin } = check

  const body = await request.json()
  const { item_id, order_id, packed } = body
  if (typeof packed !== 'boolean' || (!item_id && !order_id)) {
    return NextResponse.json({ error: 'packed (boolean) and either item_id or order_id are required' }, { status: 400 })
  }

  const packedAt = packed ? new Date().toISOString() : null

  if (item_id) {
    const { data: owned } = await admin.from('order_items').select('id').eq('id', item_id).eq('farmer_id', farmer.id).single()
    if (!owned) return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    const { error } = await admin.from('order_items').update({ packed_at: packedAt }).eq('id', item_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const { error } = await admin
    .from('order_items')
    .update({ packed_at: packedAt })
    .eq('order_id', order_id)
    .eq('farmer_id', farmer.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
