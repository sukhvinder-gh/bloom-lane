import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/utils/permissions'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const, admin: null }
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!isAdminRole(profile?.role)) return { error: 'Forbidden', status: 403 as const, admin: null }
  return { error: null, status: 200 as const, admin }
}

function periodStart(period: string): string | null {
  const now = new Date()
  if (period === '7d')  { now.setDate(now.getDate() - 7);   return now.toISOString() }
  if (period === '30d') { now.setDate(now.getDate() - 30);  return now.toISOString() }
  if (period === '90d') { now.setDate(now.getDate() - 90);  return now.toISOString() }
  if (period === '1y')  { now.setFullYear(now.getFullYear() - 1); return now.toISOString() }
  return null
}

function isoWeek(dateStr: string) {
  const d = new Date(dateStr)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay() + 1)
  return d.toISOString().slice(0, 10)
}

const PAID_STATUSES = ['payment_confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'resolved']

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error, status, admin } = await requireAdmin()
  if (error || !admin) return NextResponse.json({ error }, { status })

  const { id: hubId } = await params
  const period = req.nextUrl.searchParams.get('period') || '90d'
  const from   = periodStart(period)

  // Get hub info
  const { data: hub } = await admin
    .from('delivery_zones')
    .select('id, name, hub_suburb, hub_state')
    .eq('id', hubId)
    .single()
  if (!hub) return NextResponse.json({ error: 'Hub not found' }, { status: 404 })

  // Get all paid orders for this hub
  let ordersQ = admin
    .from('orders')
    .select('id, created_at, subtotal_cents, gst_cents, buyer_is_b2b, status')
    .eq('hub_id', hubId)
    .in('status', PAID_STATUSES)
  if (from) ordersQ = ordersQ.gte('created_at', from)

  const { data: orders, error: oErr } = await ordersQ.order('created_at', { ascending: false })
  if (oErr) return NextResponse.json({ error: oErr.message }, { status: 500 })

  const hubOrders = orders || []
  const orderIds  = hubOrders.map(o => o.id)

  if (orderIds.length === 0) {
    return NextResponse.json({
      data: {
        hub,
        summary: { total_orders: 0, gmv: 0, gst_revenue: 0, non_gst_revenue: 0, b2b_gmv: 0, b2c_gmv: 0 },
        by_week: [],
        grower_performance: [],
      }
    })
  }

  // Get order_items for these orders
  const { data: items, error: iErr } = await admin
    .from('order_items')
    .select(`
      id, quantity, subtotal_cents, is_b2b, created_at, farmer_id, order_id,
      products(id, name, category, is_gst_free),
      farmers(id, business_name)
    `)
    .in('order_id', orderIds)
  if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 })

  const rows = items || []

  // Summary
  const gmv     = rows.reduce((s, i) => s + i.subtotal_cents, 0)
  const b2bGmv  = rows.filter(i => i.is_b2b).reduce((s, i) => s + i.subtotal_cents, 0)
  const b2cGmv  = gmv - b2bGmv

  const gstRevenue = rows.reduce((s, i) => {
    if ((i.products as any)?.is_gst_free) return s
    return s + (i.is_b2b ? Math.round(i.subtotal_cents * 0.1) : Math.round(i.subtotal_cents / 11))
  }, 0)
  const nonGstRevenue = gmv - gstRevenue

  // By week (using order created_at via a lookup map)
  const orderDateMap = Object.fromEntries(hubOrders.map(o => [o.id, o.created_at]))
  const weekMap: Record<string, { orders: Set<string>; gmv: number; gst: number }> = {}
  for (const item of rows) {
    const orderDate = orderDateMap[item.order_id]
    if (!orderDate) continue
    const w = isoWeek(orderDate)
    if (!weekMap[w]) weekMap[w] = { orders: new Set(), gmv: 0, gst: 0 }
    weekMap[w].orders.add(item.order_id)
    weekMap[w].gmv += item.subtotal_cents
    if (!(item.products as any)?.is_gst_free) {
      weekMap[w].gst += item.is_b2b ? Math.round(item.subtotal_cents * 0.1) : Math.round(item.subtotal_cents / 11)
    }
  }
  const byWeek = Object.entries(weekMap)
    .map(([week, v]) => ({ week, orders: v.orders.size, gmv: v.gmv, gst: v.gst }))
    .sort((a, b) => a.week.localeCompare(b.week))

  // Grower performance
  type GrowerAgg = { farmer_id: string; business_name: string; gmv: number; orders: Set<string>; items: number }
  const growerMap: Record<string, GrowerAgg> = {}
  for (const item of rows) {
    const f = item.farmers as any
    if (!f) continue
    if (!growerMap[item.farmer_id]) growerMap[item.farmer_id] = { farmer_id: item.farmer_id, business_name: f.business_name, gmv: 0, orders: new Set(), items: 0 }
    growerMap[item.farmer_id].gmv    += item.subtotal_cents
    growerMap[item.farmer_id].items  += item.quantity
    growerMap[item.farmer_id].orders.add(item.order_id)
  }
  const growerPerformance = Object.values(growerMap)
    .map(g => ({ ...g, orders: g.orders.size }))
    .sort((a, b) => b.gmv - a.gmv)

  return NextResponse.json({
    data: {
      hub,
      summary: { total_orders: hubOrders.length, gmv, gst_revenue: gstRevenue, non_gst_revenue: nonGstRevenue, b2b_gmv: b2bGmv, b2c_gmv: b2cGmv },
      by_week: byWeek,
      grower_performance: growerPerformance,
    }
  })
}
