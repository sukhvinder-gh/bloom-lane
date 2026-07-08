// src/app/api/admin/disputes/[id]/refund/route.ts
//
// Executes the refund side of dispute resolution: one Stripe refund against
// the order's PaymentIntent, then allocates that refund across every grower
// whose items are in the order, issuing a credit note per grower and — since
// we do NOT reverse Stripe transfers that already happened — recording a
// balance adjustment that gets deducted from that grower's next payout(s).

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/utils/permissions'
import { createRefund } from '@/lib/stripe'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: disputeId } = await params

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: adminProfile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!isAdminRole(adminProfile?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const note: string | null = body?.note || null
  const requestedAmountCents: number | undefined = body?.refund_amount_cents

  const { data: dispute } = await admin
    .from('disputes')
    .select('id, order_id, reason, resolved_at')
    .eq('id', disputeId)
    .single()

  if (!dispute) return NextResponse.json({ error: 'Dispute not found' }, { status: 404 })
  if (dispute.resolved_at) return NextResponse.json({ error: 'Dispute already resolved' }, { status: 409 })

  const { data: order } = await admin
    .from('orders')
    .select('id, order_number, status, stripe_payment_intent_id, subtotal_cents, total_cents, refunded_cents')
    .eq('id', dispute.order_id)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (!order.stripe_payment_intent_id || order.stripe_payment_intent_id === 'test_mode_bypass') {
    return NextResponse.json({ error: 'Order has no live payment to refund' }, { status: 400 })
  }

  const remainingRefundable = order.total_cents - (order.refunded_cents || 0)
  const refundAmountCents = requestedAmountCents ?? remainingRefundable

  if (refundAmountCents <= 0 || refundAmountCents > remainingRefundable) {
    return NextResponse.json(
      { error: `Refund amount must be between 1 and ${remainingRefundable} cents (remaining refundable)` },
      { status: 400 }
    )
  }

  // 1. One refund via Stripe, against the original PaymentIntent.
  let refund
  try {
    refund = await createRefund(order.stripe_payment_intent_id, refundAmountCents, 'requested_by_customer')
  } catch (err: any) {
    return NextResponse.json({ error: `Stripe refund failed: ${err.message}` }, { status: 502 })
  }

  // 2. Allocate the refund across growers, proportional to each item's share
  //    of the order's items subtotal (delivery fee isn't a grower's supply,
  //    so it's excluded from per-grower allocation).
  const { data: items } = await admin
    .from('order_items')
    .select('id, farmer_id, subtotal_cents, gst_cents, gst_applied')
    .eq('order_id', order.id)

  const itemsPool = Math.min(refundAmountCents, order.subtotal_cents)
  const totalItemsSubtotal = (items || []).reduce((s, i) => s + i.subtotal_cents, 0)

  const byFarmer = new Map<string, { grossRefund: number; gstRefund: number; originalSubtotal: number }>()
  for (const item of items || []) {
    const entry = byFarmer.get(item.farmer_id) || { grossRefund: 0, gstRefund: 0, originalSubtotal: 0 }
    const itemRefundShare = totalItemsSubtotal > 0
      ? Math.round((itemsPool * item.subtotal_cents) / totalItemsSubtotal)
      : 0
    const itemGstRefund = item.gst_applied
      ? Math.round((itemRefundShare * item.gst_cents) / item.subtotal_cents)
      : 0
    entry.grossRefund += itemRefundShare
    entry.gstRefund += itemGstRefund
    entry.originalSubtotal += item.subtotal_cents
    byFarmer.set(item.farmer_id, entry)
  }

  const farmerIds = [...byFarmer.keys()]
  const { data: farmers } = await admin
    .from('farmers')
    .select('id, commission_rate')
    .in('id', farmerIds)
  const commissionByFarmer = new Map((farmers || []).map(f => [f.id, f.commission_rate ?? 0.10]))

  const creditNotes: any[] = []
  for (const [farmerId, alloc] of byFarmer.entries()) {
    if (alloc.grossRefund <= 0) continue

    const { data: creditNote, error: cnErr } = await admin
      .from('credit_notes')
      .insert({
        order_id: order.id,
        dispute_id: dispute.id,
        farmer_id: farmerId,
        original_subtotal_cents: alloc.originalSubtotal,
        refund_amount_cents: alloc.grossRefund,
        gst_cents: alloc.gstRefund,
        reason: note || dispute.reason,
        created_by: user.id,
      })
      .select()
      .single()

    if (cnErr || !creditNote) continue
    creditNotes.push(creditNote)

    // 3. Don't reverse the Stripe transfer — record a clawback against the
    //    grower's future payout(s) instead. What the grower would have kept
    //    net of platform commission is what they now owe back.
    const commissionRate = commissionByFarmer.get(farmerId) ?? 0.10
    const netClawback = Math.round(alloc.grossRefund * (1 - commissionRate))

    if (netClawback > 0) {
      await admin.from('farmer_balance_adjustments').insert({
        farmer_id: farmerId,
        credit_note_id: creditNote.id,
        amount_cents: netClawback,
        reason: `Refund on order ${order.order_number}`,
        status: 'pending',
      })
    }
  }

  // 4. Update order + dispute state.
  const newRefundedCents = (order.refunded_cents || 0) + refundAmountCents
  const newOrderStatus = newRefundedCents >= order.total_cents ? 'refunded' : 'resolved'

  await admin.from('orders').update({
    refunded_cents: newRefundedCents,
    status: newOrderStatus,
    updated_at: new Date().toISOString(),
  }).eq('id', order.id)

  await admin.from('disputes').update({
    resolved_at: new Date().toISOString(),
    resolution_note: note,
    refund_amount_cents: refundAmountCents,
    stripe_refund_id: refund.id,
  }).eq('id', dispute.id)

  return NextResponse.json({
    success: true,
    refund_id: refund.id,
    refund_amount_cents: refundAmountCents,
    order_status: newOrderStatus,
    credit_notes: creditNotes,
  })
}
