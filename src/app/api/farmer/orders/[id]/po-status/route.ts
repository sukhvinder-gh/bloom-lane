import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserFromCookie, createAdminClient } from '@/lib/supabase/server'

// Farm-pickup POs skip the hub delivery leg entirely — 'ready' (ready for the
// buyer to collect from the farm) is their terminal state. Standard POs still
// need the hub drop-off confirmation.
const STANDARD_TRANSITIONS: Record<string, string[]> = {
  pending:          ['ready'],
  ready:            ['delivered_to_hub'],
  delivered_to_hub: [],
  rejected:         [],
}
const FARM_PICKUP_TRANSITIONS: Record<string, string[]> = {
  pending:  ['ready'],
  ready:    [],
  rejected: [],
}

function isPOFulfilled(po: { status: string; pickup_method: string }): boolean {
  return po.pickup_method === 'farm_pickup' ? po.status === 'ready' : po.status === 'delivered_to_hub'
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
    .select('id, status, pickup_method')
    .eq('order_id', orderId)
    .eq('farmer_id', farmer.id)
    .single()

  if (!po) return NextResponse.json({ error: 'PO not found' }, { status: 404 })

  const { status: newStatus } = await request.json()
  const transitions = po.pickup_method === 'farm_pickup' ? FARM_PICKUP_TRANSITIONS : STANDARD_TRANSITIONS
  const allowed = transitions[po.status] ?? []
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

  // Auto-aggregate: when every PO has reached ITS OWN terminal state (ready
  // for farm pickup, delivered_to_hub for standard), advance the order.
  // Skip if a partial rejection exists — admin must resolve manually first.
  if (isPOFulfilled({ status: newStatus, pickup_method: po.pickup_method })) {
    const { data: orderRow } = await admin
      .from('orders')
      .select('has_partial_rejection')
      .eq('id', orderId)
      .single()

    if (!orderRow?.has_partial_rejection) {
      const { data: allPOs } = await admin
        .from('purchase_orders')
        .select('status, pickup_method')
        .eq('order_id', orderId)

      const allFulfilled = allPOs && allPOs.length > 0 && allPOs.every(isPOFulfilled)

      if (allFulfilled) {
        await admin
          .from('orders')
          .update({ status: 'ready_for_pickup', updated_at: new Date().toISOString() })
          .eq('id', orderId)
      }
    }
  }

  return NextResponse.json({ ok: true, status: newStatus })
}
