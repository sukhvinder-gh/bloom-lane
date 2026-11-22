import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendEmail, getAdminInbox } from '@/lib/email/mailer'

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Nothing to dispute before payment, and cancelled/refunded/resolved orders
// are already closed out — the disputes table's one-dispute-per-order
// constraint would also block re-filing on a resolved/refunded order anyway.
const DISPUTE_ELIGIBLE_STATUSES = ['payment_confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered']

// POST — a buyer reports a problem with their own order. This is the only
// way a `disputes` row gets created; previously nothing in the app could
// insert one, so disputes could only ever reach Admin > Disputes via a
// direct database insert.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params
  const { reason } = await request.json().catch(() => ({}))
  const trimmedReason = reason?.trim() || ''
  if (!trimmedReason) return NextResponse.json({ error: 'Please describe the issue' }, { status: 400 })
  if (trimmedReason.length > 2000) return NextResponse.json({ error: 'Please keep this under 2000 characters' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // RLS already scopes orders to the buyer's own rows — a stranger's order
  // id simply comes back null, doubling as the ownership check.
  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number, status')
    .eq('id', orderId)
    .maybeSingle()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (!DISPUTE_ELIGIBLE_STATUSES.includes(order.status)) {
    return NextResponse.json({ error: "This order can't be disputed in its current state." }, { status: 400 })
  }

  const { data: dispute, error } = await supabase
    .from('disputes')
    .insert({ order_id: order.id, raised_by: user.id, reason: trimmedReason })
    .select('id')
    .single()

  if (error) {
    // one_dispute_per_order unique constraint — already reported, even if
    // that earlier dispute was since resolved.
    if (error.code === '23505') {
      return NextResponse.json({ error: "You've already reported an issue with this order." }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const admin = createAdminClient()
  // Buyers can't freely change order status via RLS — this is the one
  // admin-client write in an otherwise RLS-scoped route.
  await admin.from('orders').update({ status: 'disputed' }).eq('id', order.id)

  const { data: profile } = await admin.from('profiles').select('full_name, email').eq('id', user.id).maybeSingle()
  const inbox = getAdminInbox()
  if (inbox) {
    sendEmail({
      to: inbox,
      subject: `New dispute on order ${order.order_number}`,
      html: `<p><strong>${escapeHtml(profile?.full_name || profile?.email || 'A buyer')}</strong> has reported an issue with order <strong>${escapeHtml(order.order_number)}</strong>:</p>
<div style="background:#f5f9f5;border-radius:10px;padding:16px 20px;white-space:pre-wrap;color:#1a3a2a;font-size:14px;line-height:1.6">${escapeHtml(trimmedReason)}</div>
<p>Review it from <strong>Admin &rarr; Disputes</strong>.</p>`,
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true, dispute_id: dispute.id })
}
