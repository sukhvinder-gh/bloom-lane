// src/app/api/orders/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      profiles(full_name, email),
      order_items(*, products(name, unit, category, image_url, image_urls), farmers(business_name, brand_color))
    `)
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (data.buyer_id !== user.id && profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { createAdminClient } = await import('@/lib/supabase/server')
  const adminClient = createAdminClient()

  // Annotate items with po_rejected flag (for partial rejection display)
  // Buyers see "unavailable" without knowing the grower; admins get the same data
  if ((data as any).has_partial_rejection) {
    const { data: rejectedPOs } = await adminClient
      .from('purchase_orders')
      .select('farmer_id')
      .eq('order_id', id)
      .eq('status', 'rejected')
    const rejectedFarmerIds = new Set((rejectedPOs ?? []).map((p: any) => p.farmer_id))
    ;(data as any).order_items = (data as any).order_items?.map((item: any) => ({
      ...item,
      po_rejected: rejectedFarmerIds.has(item.farmer_id),
    }))
  }

  // purchase_order ids per grower — the messaging thread is scoped to
  // (order, farmer) via this id, not the raw order_id, since one order can
  // span multiple growers who shouldn't see each other's conversations.
  const { data: pos } = await adminClient
    .from('purchase_orders')
    .select('id, farmer_id, pickup_method, farmers(address, suburb, state)')
    .eq('order_id', id)
  ;(data as any).purchase_orders = pos || []

  return NextResponse.json({ data })
}