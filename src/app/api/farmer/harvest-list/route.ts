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

// Monday of the week containing `d`, at local midnight.
function mondayOf(d: Date): Date {
  const day = d.getDay() // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1) - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

// GET /api/farmer/harvest-list?from=YYYY-MM-DD&to=YYYY-MM-DD
// Aggregates this farmer's still-active order lines by product, scoped to
// orders whose admin-set harvest/fulfilment date falls in [from, to] —
// defaults to the current Mon–Sun week when no range is given.
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
    .select('order_id')
    .eq('farmer_id', farmer.id)
    .in('status', ACTIVE_PO_STATUSES)

  const activeOrderIds = [...new Set((pos || []).map((p: any) => p.order_id))]
  if (activeOrderIds.length === 0) {
    return NextResponse.json({ data: { rows: [], order_count: 0, unscheduled_order_count: 0, from, to } })
  }

  const { data: allActiveOrders } = await admin
    .from('orders')
    .select('id, grower_fulfillment_date')
    .in('id', activeOrderIds)

  const unscheduledCount = (allActiveOrders || []).filter((o: any) => !o.grower_fulfillment_date).length

  const scopedOrders = (allActiveOrders || []).filter((o: any) => {
    if (!o.grower_fulfillment_date) return false
    const t = new Date(o.grower_fulfillment_date).getTime()
    return t >= new Date(from!).getTime() && t <= new Date(`${to}T23:59:59`).getTime()
  })
  const scopedOrderIds = scopedOrders.map((o: any) => o.id)
  const dateByOrder = new Map(scopedOrders.map((o: any) => [o.id, o.grower_fulfillment_date]))

  if (scopedOrderIds.length === 0) {
    return NextResponse.json({ data: { rows: [], order_count: 0, unscheduled_order_count: unscheduledCount, from, to } })
  }

  const { data: items } = await admin
    .from('order_items')
    .select('id, order_id, quantity, notes, harvested_at, products(name, unit, category)')
    .eq('farmer_id', farmer.id)
    .in('order_id', scopedOrderIds)

  const now = Date.now()
  const byProduct = new Map<string, any>()
  for (const item of items || []) {
    const p = (item as any).products
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
    if (!isHarvested && orderDate && new Date(orderDate as string).getTime() < now) entry.overdue = true
    byProduct.set(key, entry)
  }

  const rows = [...byProduct.values()]
    .map(r => ({
      key: r.key, name: r.name, unit: r.unit, category: r.category, qty: r.qty,
      order_count: r.orderSet.size, item_ids: r.item_ids, notes: r.notes,
      fully_harvested: r.fully_harvested, any_harvested: r.any_harvested, overdue: r.overdue,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return NextResponse.json({
    data: { rows, order_count: scopedOrderIds.length, unscheduled_order_count: unscheduledCount, from, to },
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
