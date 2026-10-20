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
// happens to be running — the whole app anchors weeks/market windows to
// Australia/Sydney (see timezone.ts), and a server-local computation here
// would silently shift the default range by a day whenever server TZ != AEST.
function defaultWeekRange(): { from: string; to: string } {
  const sydneyNow = toZonedTime(new Date(), AU_TIMEZONE)
  const day = sydneyNow.getDay() // 0=Sun..6=Sat, read as Sydney wall-clock
  const diff = (day === 0 ? -6 : 1) - day
  const monday = new Date(sydneyNow)
  monday.setDate(sydneyNow.getDate() + diff)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const pad = (n: number) => String(n).padStart(2, '0')
  const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  return { from: toDateStr(monday), to: toDateStr(sunday) }
}

// A plain from/to date string means "that calendar day in Sydney" — convert
// to the real UTC instants bounding it so the range comparison below can't
// drift by the ~10-11hr AEST/UTC offset.
function sydneyDateRangeInstants(from: string, to: string): { fromMs: number; toMs: number } {
  return {
    fromMs: fromZonedTime(`${from}T00:00:00`, AU_TIMEZONE).getTime(),
    toMs: fromZonedTime(`${to}T23:59:59`, AU_TIMEZONE).getTime(),
  }
}

function aggregateByProduct(items: any[], dateByOrder: Map<string, string | null>) {
  const now = Date.now()
  const byProduct = new Map<string, any>()
  for (const item of items) {
    const p = item.products
    const key = `${p?.name || 'Unknown'}|${p?.unit || ''}`
    const entry = byProduct.get(key) || {
      key, name: p?.name || 'Unknown', unit: p?.unit || '', category: p?.category || '',
      qty: 0, orderSet: new Set<string>(), item_ids: [] as string[], notes: [] as string[],
      fully_harvested: true, any_harvested: false, overdue: false,
    }
    entry.qty += item.quantity
    entry.orderSet.add(item.order_id)
    entry.item_ids.push(item.id)
    if (item.notes && item.notes.trim()) entry.notes.push(item.notes.trim())
    const isHarvested = !!item.harvested_at
    if (!isHarvested) entry.fully_harvested = false
    if (isHarvested) entry.any_harvested = true
    const orderDate = dateByOrder.get(item.order_id)
    if (!isHarvested && orderDate && new Date(orderDate).getTime() < now) entry.overdue = true
    byProduct.set(key, entry)
  }
  return [...byProduct.values()]
    .map(r => ({
      key: r.key, name: r.name, unit: r.unit, category: r.category, qty: r.qty,
      order_count: r.orderSet.size, item_ids: r.item_ids, notes: r.notes,
      fully_harvested: r.fully_harvested, any_harvested: r.any_harvested, overdue: r.overdue,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// GET /api/farmer/harvest-list?from=YYYY-MM-DD&to=YYYY-MM-DD
// Aggregates this farmer's still-active order lines by product, scoped to
// orders whose fulfilment date (set by this farmer on their own PO, or the
// shared order-level fallback for older rows) falls in [from, to] —
// defaults to the current Mon–Sun week (Sydney time) when no range is given.
// Orders with no fulfilment date at all can't fit any range, so they're
// never silently dropped — they come back as a separate `unscheduled_rows`
// group the farmer can still see and act on.
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
    .select('order_id, grower_fulfillment_date')
    .eq('farmer_id', farmer.id)
    .in('status', ACTIVE_PO_STATUSES)

  const activeOrderIds = [...new Set((pos || []).map((p: any) => p.order_id))]
  // This farmer's own date on their own PO row — falls back to the shared
  // order-level column for any PO row created before per-farmer dates existed.
  const poDateByOrder = new Map((pos || []).map((p: any) => [p.order_id, p.grower_fulfillment_date]))
  if (activeOrderIds.length === 0) {
    return NextResponse.json({ data: { rows: [], unscheduled_rows: [], order_count: 0, unscheduled_order_count: 0, from, to } })
  }

  // A cancelled order's purchase_orders row can be left at 'pending' (it's
  // never transitioned on cancellation), so the PO-status filter above
  // alone isn't enough to keep a cancelled order out of this list — check
  // the order's own status too, or a stale PO leaks a dead order in
  // permanently (with no date to ever satisfy it).
  const { data: allActiveOrders } = await admin
    .from('orders')
    .select('id, grower_fulfillment_date')
    .in('id', activeOrderIds)
    .neq('status', 'cancelled')

  const dateByOrder = new Map(
    (allActiveOrders || []).map((o: any) => [o.id, poDateByOrder.get(o.id) || o.grower_fulfillment_date])
  )

  const scopedOrders = (allActiveOrders || []).filter((o: any) => {
    const date = dateByOrder.get(o.id)
    if (!date) return false
    const t = new Date(date).getTime()
    return t >= fromMs && t <= toMs
  })
  const unscheduledOrders = (allActiveOrders || []).filter((o: any) => !dateByOrder.get(o.id))

  const scopedOrderIds = scopedOrders.map((o: any) => o.id)
  const unscheduledOrderIds = unscheduledOrders.map((o: any) => o.id)

  const allRelevantIds = [...scopedOrderIds, ...unscheduledOrderIds]
  if (allRelevantIds.length === 0) {
    return NextResponse.json({ data: { rows: [], unscheduled_rows: [], order_count: 0, unscheduled_order_count: 0, from, to } })
  }

  const { data: items } = await admin
    .from('order_items')
    .select('id, order_id, quantity, notes, harvested_at, products(name, unit, category)')
    .eq('farmer_id', farmer.id)
    .in('order_id', allRelevantIds)

  const scopedIdSet = new Set(scopedOrderIds)
  const unscheduledIdSet = new Set(unscheduledOrderIds)
  const scopedItems = (items || []).filter((i: any) => scopedIdSet.has(i.order_id))
  const unscheduledItems = (items || []).filter((i: any) => unscheduledIdSet.has(i.order_id))

  const rows = aggregateByProduct(scopedItems, dateByOrder)
  const unscheduledRows = aggregateByProduct(unscheduledItems, dateByOrder)

  return NextResponse.json({
    data: {
      rows, unscheduled_rows: unscheduledRows,
      order_count: scopedOrderIds.length, unscheduled_order_count: unscheduledOrderIds.length,
      from, to,
    },
  })
}

// PATCH /api/farmer/harvest-list — toggle harvested_at for a set of this
// farmer's own order_items (one aggregated row can span several orders).
export async function PATCH(request: NextRequest) {
  const check = await requireFarmer()
  if (check.error || !check.farmer || !check.admin) return NextResponse.json({ error: check.error }, { status: check.status })
  const { farmer, admin } = check

  const body = await request.json()
  const { item_ids, harvested } = body
  if (!Array.isArray(item_ids) || item_ids.length === 0 || typeof harvested !== 'boolean') {
    return NextResponse.json({ error: 'item_ids (array) and harvested (boolean) are required' }, { status: 400 })
  }

  const { data: owned } = await admin.from('order_items').select('id').eq('farmer_id', farmer.id).in('id', item_ids)
  const ownedIds = new Set((owned || []).map((o: any) => o.id))
  const validIds = (item_ids as string[]).filter(id => ownedIds.has(id))
  if (validIds.length === 0) return NextResponse.json({ error: 'No matching items' }, { status: 404 })

  const { error } = await admin
    .from('order_items')
    .update({ harvested_at: harvested ? new Date().toISOString() : null })
    .in('id', validIds)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, updated: validIds.length })
}
