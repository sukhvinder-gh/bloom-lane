// src/app/api/orders/[id]/dispute/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'
import { canDispute } from '@/lib/utils/timezone'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createSupabaseServerClient()
  const adminSupabase = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { reason } = await request.json()
  if (!reason?.trim()) return NextResponse.json({ error: 'Reason required' }, { status: 400 })

  const { data: order } = await supabase
    .from('orders').select('buyer_id, status, dispute_deadline').eq('id', id).single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.buyer_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (order.status !== 'delivered') return NextResponse.json({ error: 'Order not delivered' }, { status: 400 })
  if (!canDispute(order.dispute_deadline)) return NextResponse.json({ error: 'Dispute window has expired' }, { status: 400 })

  await adminSupabase.from('disputes').insert({
    order_id: id,
    raised_by: user.id,
    reason,
  })

  await adminSupabase.from('orders').update({ status: 'disputed' }).eq('id', id)

  return NextResponse.json({ success: true })
}