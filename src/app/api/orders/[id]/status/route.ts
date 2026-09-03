import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/utils/permissions'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('orders')
    .select(`*, profiles(full_name, email), order_items(*, products(name, unit, category), farmers(business_name, brand_color))`)
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const { data: profile } = await adminClient.from('profiles').select('role').eq('id', user.id).single()
  if (data.buyer_id !== user.id && !isAdminRole(profile?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ data })
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  payment_confirmed: ['preparing', 'cancelled'],
  preparing:         ['ready_for_pickup', 'cancelled'],
  ready_for_pickup:  ['out_for_delivery', 'delivered'],
  out_for_delivery:  ['delivered'],
  delivered:         [],
  disputed:          ['delivered', 'refunded'],
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient.from('profiles').select('role').eq('id', user.id).single()
  if (!isAdminRole(profile?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { status: newStatus } = await request.json()
  if (!newStatus) return NextResponse.json({ error: 'status is required' }, { status: 400 })

  const { data: order } = await adminClient.from('orders').select('status').eq('id', id).single()
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  const allowed = VALID_TRANSITIONS[order.status] || []
  if (!allowed.includes(newStatus)) {
    return NextResponse.json({ error: `Cannot transition from ${order.status} to ${newStatus}` }, { status: 422 })
  }

  const { error } = await adminClient
    .from('orders')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Cancelling an order left its purchase_orders row(s) stuck at 'pending'
  // forever (nothing else ever transitions them) — that stale PO alone was
  // enough to keep a dead order permanently visible on the farmer's
  // harvest/pack lists, since those only checked PO status, not the order's.
  // 'rejected' is the closest terminal state the PO status enum allows.
  if (newStatus === 'cancelled') {
    await adminClient
      .from('purchase_orders')
      .update({ status: 'rejected', rejection_reason: 'Order cancelled', rejected_at: new Date().toISOString() })
      .eq('order_id', id)
      .eq('status', 'pending')
  }

  return NextResponse.json({ ok: true, status: newStatus })
}