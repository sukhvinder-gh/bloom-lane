import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'

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
  d.setDate(d.getDate() - d.getDay() + 1) // Monday
  return d.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: farmer } = await admin
    .from('farmers')
    .select('id, commission_rate')
    .eq('user_id', user.id)
    .single()
  if (!farmer) return NextResponse.json({ error: 'Farmer profile not found' }, { status: 403 })

  const period = req.nextUrl.searchParams.get('period') || '90d'
  const from   = periodStart(period)

  // Fetch all order_items for this farmer with order + product details
  let q = admin
    .from('order_items')
    .select(`
      id, quantity, subtotal_cents, is_b2b, created_at,
      products(id, name, category, is_gst_free),
      orders!inner(id, status, created_at)
    `)
    .eq('farmer_id', farmer.id)
    .in('orders.status', ['payment_confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'resolved'])

  if (from) q = q.gte('created_at', from)

  const { data: items, error } = await q.order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rate = Number(farmer.commission_rate) || 0.10
  const rows = items || []

  // Summary
  const grossRevenue  = rows.reduce((s, i) => s + i.subtotal_cents, 0)
  const commission    = Math.round(grossRevenue * rate)
  const netRevenue    = grossRevenue - commission
  const totalOrders   = new Set(rows.map(i => (i.orders as any)?.id)).size

  // GST breakdown (for B2B: ex-GST prices, add 10%; for B2C: inc-GST, extract 1/11)
  const gstAmount = rows.reduce((s, i) => {
    if ((i.products as any)?.is_gst_free) return s
    return s + (i.is_b2b ? Math.round(i.subtotal_cents * 0.1) : Math.round(i.subtotal_cents / 11))
  }, 0)

  // By week
  const weekMap: Record<string, { orders: Set<string>; gross: number; net: number }> = {}
  for (const item of rows) {
    const w = isoWeek(item.created_at)
    if (!weekMap[w]) weekMap[w] = { orders: new Set(), gross: 0, net: 0 }
    weekMap[w].orders.add((item.orders as any)?.id)
    weekMap[w].gross += item.subtotal_cents
    weekMap[w].net   += Math.round(item.subtotal_cents * (1 - rate))
  }
  const byWeek = Object.entries(weekMap)
    .map(([week, v]) => ({ week, orders: v.orders.size, gross: v.gross, net: v.net }))
    .sort((a, b) => a.week.localeCompare(b.week))

  // By product
  type ProdAgg = { product_id: string; name: string; category: string; is_gst_free: boolean; qty: number; gross: number; net: number; orders: number }
  const prodMap: Record<string, ProdAgg> = {}
  for (const item of rows) {
    const p = item.products as any
    if (!p) continue
    if (!prodMap[p.id]) prodMap[p.id] = { product_id: p.id, name: p.name, category: p.category, is_gst_free: p.is_gst_free, qty: 0, gross: 0, net: 0, orders: 0 }
    prodMap[p.id].qty    += item.quantity
    prodMap[p.id].gross  += item.subtotal_cents
    prodMap[p.id].net    += Math.round(item.subtotal_cents * (1 - rate))
    prodMap[p.id].orders += 1
  }
  const byProduct = Object.values(prodMap).sort((a, b) => b.gross - a.gross)

  return NextResponse.json({
    data: {
      summary: { total_orders: totalOrders, gross_revenue: grossRevenue, commission, net_revenue: netRevenue, gst_amount: gstAmount, commission_rate: rate },
      by_week: byWeek,
      by_product: byProduct,
    }
  })
}
