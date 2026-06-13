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

export async function GET(req: NextRequest) {
  const { error, status, admin } = await requireAdmin()
  if (error || !admin) return NextResponse.json({ error }, { status })

  const period = req.nextUrl.searchParams.get('period') || '90d'
  const from   = periodStart(period)

  // Fetch all paid order_items with order + farmer + product info
  let q = admin
    .from('order_items')
    .select(`
      id, quantity, subtotal_cents, is_b2b, created_at, farmer_id,
      products(id, name, category, is_gst_free),
      farmers(id, business_name),
      orders!inner(id, status, created_at, buyer_id, hub_id)
    `)
    .in('orders.status', PAID_STATUSES)

  if (from) q = q.gte('created_at', from)

  const { data: items, error: dbErr } = await q.order('created_at', { ascending: false })
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  const rows = items || []

  // Summary
  const gmv        = rows.reduce((s, i) => s + i.subtotal_cents, 0)
  const commission = rows.reduce((s, i) => s + Math.round(i.subtotal_cents * 0.10), 0)
  const totalOrders = new Set(rows.map(i => (i.orders as any)?.id)).size
  const activeGrowers = new Set(rows.map(i => i.farmer_id)).size
  const activeBuyers  = new Set(rows.map(i => (i.orders as any)?.buyer_id)).size

  const gstRevenue = rows.reduce((s, i) => {
    if ((i.products as any)?.is_gst_free) return s
    return s + (i.is_b2b ? Math.round(i.subtotal_cents * 0.1) : Math.round(i.subtotal_cents / 11))
  }, 0)
  const nonGstRevenue = gmv - gstRevenue

  // By week
  const weekMap: Record<string, { orders: Set<string>; gmv: number; commission: number }> = {}
  for (const item of rows) {
    const w = isoWeek(item.created_at)
    if (!weekMap[w]) weekMap[w] = { orders: new Set(), gmv: 0, commission: 0 }
    weekMap[w].orders.add((item.orders as any)?.id)
    weekMap[w].gmv        += item.subtotal_cents
    weekMap[w].commission += Math.round(item.subtotal_cents * 0.10)
  }
  const byWeek = Object.entries(weekMap)
    .map(([week, v]) => ({ week, orders: v.orders.size, gmv: v.gmv, commission: v.commission }))
    .sort((a, b) => a.week.localeCompare(b.week))

  // Grower performance
  type GrowerAgg = { farmer_id: string; business_name: string; gmv: number; commission: number; orders: Set<string> }
  const growerMap: Record<string, GrowerAgg> = {}
  for (const item of rows) {
    const f = item.farmers as any
    if (!f) continue
    if (!growerMap[item.farmer_id]) growerMap[item.farmer_id] = { farmer_id: item.farmer_id, business_name: f.business_name, gmv: 0, commission: 0, orders: new Set() }
    growerMap[item.farmer_id].gmv        += item.subtotal_cents
    growerMap[item.farmer_id].commission += Math.round(item.subtotal_cents * 0.10)
    growerMap[item.farmer_id].orders.add((item.orders as any)?.id)
  }
  const growerPerformance = Object.values(growerMap)
    .map(g => ({ ...g, orders: g.orders.size, net: g.gmv - g.commission }))
    .sort((a, b) => b.gmv - a.gmv)

  return NextResponse.json({
    data: {
      summary: { total_orders: totalOrders, gmv, commission, active_growers: activeGrowers, active_buyers: activeBuyers, gst_revenue: gstRevenue, non_gst_revenue: nonGstRevenue },
      by_week: byWeek,
      grower_performance: growerPerformance,
    }
  })
}
