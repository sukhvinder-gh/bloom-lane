import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserFromCookie, createAdminClient } from '@/lib/supabase/server'

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending:          ['ready'],
  ready:            ['delivered_to_hub'],
  delivered_to_hub: [],
  rejected:         [],
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params

  const sessionUser = await getSessionUserFromCookie()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: farmers } = await admin
    .from('farmers')
    .select('id')
    .eq('user_id', sessionUser.id)
    .limit(1)
  const farmer = farmers?.[0]
  if (!farmer) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: po } = await admin
    .from('purchase_orders')
    .select('id, status')
    .eq('order_id', orderId)
    .eq('farmer_id', farmer.id)
    .single()

  if (!po) return NextResponse.json({ error: 'PO not found' }, { status: 404 })

  const { status: newStatus } = await request.json()
  const allowed = VALID_TRANSITIONS[po.status] ?? []
  if (!allowed.includes(newStatus)) {
    return NextResponse.json(
      { error: `Cannot transition from ${po.status} to ${newStatus}` },
      { status: 422 }
    )
  }

  const updateData: Record<string, string> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  }
  if (newStatus === 'ready') updateData.ready_at = new Date().toISOString()
  if (newStatus === 'delivered_to_hub') updateData.delivered_to_hub_at = new Date().toISOString()

  const { error } = await admin
    .from('purchase_orders')
    .update(updateData)
    .eq('id', po.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-aggregate: when every PO for this order reaches delivered_to_hub → advance the main order
  if (newStatus === 'delivered_to_hub') {
    const { data: allPOs } = await admin
      .from('purchase_orders')
      .select('status')
      .eq('order_id', orderId)

    const allDelivered =
      allPOs && allPOs.length > 0 && allPOs.every(p => p.status === 'delivered_to_hub')

    if (allDelivered) {
      await admin
        .from('orders')
        .update({ status: 'ready_for_pickup', updated_at: new Date().toISOString() })
        .eq('id', orderId)
    }
  }

  return NextResponse.json({ ok: true, status: newStatus })
}
