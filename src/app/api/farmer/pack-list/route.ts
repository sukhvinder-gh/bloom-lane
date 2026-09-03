import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'
import { AU_TIMEZONE } from '@/lib/utils/timezone'

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

// "Monday" has to mean Monday in Sydney, not wherever the server process
// happens to be running — see the identical helper in harvest-list/route.ts.
function defaultWeekRange(): { from: string; to: string } {
  const sydneyNow = toZonedTime(new Date(), AU_TIMEZONE)
  const day = sydneyNow.getDay()
  const diff = (day === 0 ? -6 : 1) - day
  const monday = new Date(sydneyNow)
  monday.setDate(sydneyNow.getDate() + diff)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const pad = (n: number) => String(n).padStart(2, '0')
  const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return { from: toDateStr(monday), to: toDateStr(sunday) }
}

function sydneyDateRangeInstants(from: string, to: string): { fromMs: number; toMs: number } {
  return {
    fromMs: fromZonedTime(`${from}T00:00:00`, AU_TIMEZONE).getTime(),
    toMs: fromZonedTime(`${to}T23:59:59`, AU_TIMEZONE).getTime(),
  }
}

// GET /api/farmer/pack-list?from=YYYY-MM-DD&to=YYYY-MM-DD
// One row per order (not aggregated) — packing is done order by order —
// scoped to orders whose admin-set harvest/fulfilment date falls in
// [from, to], defaulting to the current Mon–Sun week (Sydney time).
export async function GET(request: NextRequest) {
  const check = await requireFarmer()
  if (check.error || !check.farmer || !check.admin) return NextResponse.json({ error: check.error }, { status: check.status })
  const { farmer, admin } = check

  const url = new URL(request.url)
  let from = url.searchParams.get('from')
  let to = url.searchParams.get('to')
  if (!from || !to) {
    const range = defaultWeekRange()
    from = range.from
    to = range.to
  }
  const { fromMs, toMs } = sydneyDateRangeInstants(from, to)

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

  // A cancelled order's purchase_orders row can be left at 'pending' (it's
  // never transitioned on cancellation), so the PO-status filter above
  // alone isn't enough to keep a cancelled order out of this list — check
  // the order's own status too, or a stale PO leaks a dead order in
  // permanently (with no date to ever satisfy it).
  const { data: allActiveOrders } = await admin
    .from('orders')
    .select('id, order_number, created_at, fulfillment_type, buyer_id, grower_fulfillment_date, order_items(id, quantity, notes, packed_at, products(name, unit))')
    .in('id', activeOrderIds)
    .eq('order_items.farmer_id', farmer.id)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: true })

  const scopedOrders = (allActiveOrders || []).filter((o: any) => {
    if (!o.grower_fulfillment_date) return false
    const t = new Date(o.grower_fulfillment_date).getTime()
    return t >= fromMs && t <= toMs
  })
  // Orders with no fulfilment date at all can't fit any range — return them
  // as their own group instead of silently dropping them, so the farmer can
  // still see and pack them (and know to chase admin for a date).
  const unscheduledOrders = (allActiveOrders || []).filter((o: any) => !o.grower_fulfillment_date)

  const buyerIds = [...new Set([...scopedOrders, ...unscheduledOrders].map((o: any) => o.buyer_id))]
  const { data: buyers } = buyerIds.length > 0
    ? await admin.from('profiles').select('id, full_name, business_name').in('id', buyerIds)
    : { data: [] as any[] }
  const buyerById = new Map((buyers || []).map((b: any) => [b.id, b]))

  const now = Date.now()
  function toOrderRow(o: any, overdue: boolean) {
    const items = o.order_items || []
    const allPacked = items.length > 0 && items.every((i: any) => !!i.packed_at)
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
      overdue: !allPacked && overdue,
    }
  }

  const orders = scopedOrders
    .sort((a: any, b: any) => new Date(a.grower_fulfillment_date).getTime() - new Date(b.grower_fulfillment_date).getTime())
    .map((o: any) => toOrderRow(o, new Date(o.grower_fulfillment_date).getTime() < now))

  const unscheduledOrdersOut = unscheduledOrders
    .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map((o: any) => toOrderRow(o, false))

  return NextResponse.json({
    data: {
      orders, unscheduled_orders: unscheduledOrdersOut,
      order_count: orders.length, unscheduled_order_count: unscheduledOrdersOut.length,
      from, to,
    },
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
