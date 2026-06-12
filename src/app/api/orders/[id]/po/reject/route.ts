import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

// POST /api/orders/[id]/po/reject
// Grower rejects their PO for this order. Admin is notified via a flag in purchase_orders.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params
  const { reason } = await request.json()

  if (!reason?.trim()) {
    return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // Verify this user is a farmer
  const { data: farmer } = await supabase
    .from('farmers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!farmer) return NextResponse.json({ error: 'Farmer account not found' }, { status: 403 })

  const admin = createAdminClient()

  // Upsert the purchase_order record with rejected status
  const { data, error } = await admin
    .from('purchase_orders')
    .upsert({
      order_id: orderId,
      farmer_id: farmer.id,
      status: 'rejected',
      rejection_reason: reason.trim(),
      rejected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'order_id,farmer_id' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Flag the order so admin knows manual resolution is needed
  await admin
    .from('orders')
    .update({ has_partial_rejection: true, updated_at: new Date().toISOString() })
    .eq('id', orderId)

  return NextResponse.json({ data })
}
