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

  // Annotate items with po_rejected flag (for partial rejection display)
  // Buyers see "unavailable" without knowing the grower; admins get the same data
  if ((data as any).has_partial_rejection) {
    const { createAdminClient } = await import('@/lib/supabase/server')
    const adminClient = createAdminClient()
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

  return NextResponse.json({ data })
}