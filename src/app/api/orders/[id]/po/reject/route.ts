import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { notifyPORejection } from '@/lib/email/sendPORejectionEmails'
import { createRefund, reverseFarmerTransfer } from '@/lib/stripe'
import { getCommissionRates, effectiveCommissionRate } from '@/lib/utils/commission'
import { sendEmail, getAdminInbox } from '@/lib/email/mailer'

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// POST /api/orders/[id]/po/reject
//
// Grower rejects their PO for this order — and, since they're the one
// backing out, they're also the one whose action refunds the buyer for
// their share of the order, not admin. Refunding is best-effort and never
// blocks the rejection itself: the PO is rejected regardless of whether the
// Stripe refund succeeds. Admin is always emailed with the outcome either
// way, for visibility — not because they need to act, except when the
// refund itself failed and needs manual follow-up (see Admin → Disputes).
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
    .select('id, business_name, commission_rate, subscription_type')
    .eq('user_id', user.id)
    .single()

  if (!farmer) return NextResponse.json({ error: 'Farmer account not found' }, { status: 403 })

  const admin = createAdminClient()

  const { data: existingPO } = await admin
    .from('purchase_orders')
    .select('status')
    .eq('order_id', orderId)
    .eq('farmer_id', farmer.id)
    .maybeSingle()

  if (existingPO?.status === 'rejected') {
    return NextResponse.json({ error: 'This PO has already been rejected.' }, { status: 409 })
  }

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

  // Flag the order so admin knows a grower pulled out, even though the
  // refund below usually settles it without needing them to act.
  await admin
    .from('orders')
    .update({ has_partial_rejection: true, updated_at: new Date().toISOString() })
    .eq('id', orderId)

  let refundedCents = 0
  let refundFailureReason: string | null = null
  try {
    const { data: order } = await admin
      .from('orders')
      .select('id, order_number, stripe_payment_intent_id, total_cents, refunded_cents')
      .eq('id', orderId)
      .single()

    if (!order?.stripe_payment_intent_id || order.stripe_payment_intent_id === 'test_mode_bypass') {
      refundFailureReason = 'Order has no live payment to refund'
    } else {
      const { data: items } = await admin
        .from('order_items')
        .select('subtotal_cents, gst_cents, gst_applied')
        .eq('order_id', orderId)
        .eq('farmer_id', farmer.id)

      const grossRefund = (items || []).reduce((s, i) => s + i.subtotal_cents, 0)
      const gstRefund = (items || []).reduce((s, i) => s + (i.gst_applied ? i.gst_cents : 0), 0)
      const remainingRefundable = order.total_cents - (order.refunded_cents || 0)
      const refundAmountCents = Math.min(grossRefund + gstRefund, remainingRefundable)

      if (refundAmountCents <= 0) {
        refundFailureReason = 'Nothing left to refund on this order'
      } else {
        const refund = await createRefund(order.stripe_payment_intent_id, refundAmountCents, 'requested_by_customer')

        const { data: creditNote } = await admin
          .from('credit_notes')
          .insert({
            order_id: order.id,
            farmer_id: farmer.id,
            original_subtotal_cents: grossRefund,
            refund_amount_cents: refundAmountCents,
            gst_cents: gstRefund,
            reason: `Grower rejected PO: ${reason.trim()} (Stripe refund ${refund.id})`,
            created_by: user.id,
          })
          .select()
          .single()

        // Claw back from the grower if they'd already been paid for this
        // order — shouldn't normally happen for a still-pending PO, but
        // defend against it the same way the admin dispute-refund flow does.
        const rates = await getCommissionRates(admin)
        const commissionRate = effectiveCommissionRate(farmer, rates)
        const netClawback = Math.round(grossRefund * (1 - commissionRate))
        if (netClawback > 0) {
          const { data: paidPayouts } = await admin
            .from('payouts')
            .select('id, stripe_transfer_id, net_amount_cents')
            .eq('farmer_id', farmer.id)
            .eq('order_id', order.id)
            .eq('status', 'paid')
            .order('created_at', { ascending: false })
          const payout = (paidPayouts || []).find(p => p.stripe_transfer_id)
          if (payout?.stripe_transfer_id) {
            const reversibleAmount = Math.min(netClawback, payout.net_amount_cents)
            try {
              const reversal = await reverseFarmerTransfer(payout.stripe_transfer_id, reversibleAmount, { order_id: order.id })
              await admin.from('farmer_balance_adjustments').insert({
                farmer_id: farmer.id,
                credit_note_id: creditNote?.id,
                amount_cents: reversibleAmount,
                reason: `PO rejection on order ${order.order_number} — recovered from grower's Stripe balance (reversal ${reversal.id})`,
                status: 'applied',
                applied_to_payout_id: payout.id,
                applied_at: new Date().toISOString(),
              })
            } catch {
              await admin.from('farmer_balance_adjustments').insert({
                farmer_id: farmer.id,
                credit_note_id: creditNote?.id,
                amount_cents: netClawback,
                reason: `PO rejection on order ${order.order_number} — deducting from next payout`,
                status: 'pending',
              })
            }
          }
        }

        refundedCents = refundAmountCents

        const newRefundedCents = (order.refunded_cents || 0) + refundAmountCents
        await admin.from('orders').update({
          refunded_cents: newRefundedCents,
          ...(newRefundedCents >= order.total_cents ? { status: 'refunded' as const } : {}),
          updated_at: new Date().toISOString(),
        }).eq('id', order.id)
      }
    }
  } catch (err: any) {
    refundFailureReason = err.message || 'Refund failed'
  }

  if (refundFailureReason) {
    console.error('[PO-REJECT-REFUND] Could not auto-refund for order', orderId, 'farmer', farmer.id, ':', refundFailureReason)
  }

  // Admin visibility — always sent, since this never requires admin to act
  // unless the refund itself failed (in which case Admin → Disputes is
  // where they'd finish it manually).
  const inbox = getAdminInbox()
  if (inbox) {
    sendEmail({
      to: inbox,
      subject: refundFailureReason
        ? `Action needed: refund grower-rejected PO on order ${orderId}`
        : `Grower rejected a PO — buyer auto-refunded on order ${orderId}`,
      html: refundFailureReason
        ? `<p><strong>${escapeHtml(farmer.business_name || 'A grower')}</strong> rejected their PO on order ${orderId} ("${escapeHtml(reason.trim())}"), but the automatic refund could not be processed: <strong>${escapeHtml(refundFailureReason)}</strong>.</p><p>Please refund the buyer manually from Admin → Disputes.</p>`
        : `<p><strong>${escapeHtml(farmer.business_name || 'A grower')}</strong> rejected their PO on order ${orderId} ("${escapeHtml(reason.trim())}") and the buyer was automatically refunded <strong>$${(refundedCents / 100).toFixed(2)}</strong>. No action needed — this is for your visibility only.</p>`,
    }).catch(() => {})
  }

  // Best-effort — the rejection itself has already succeeded regardless of
  // whether these emails send.
  notifyPORejection(orderId, farmer.id, reason.trim(), refundedCents).catch(err =>
    console.error('[PO-REJECT-EMAIL] notifyPORejection failed for order', orderId, err)
  )

  return NextResponse.json({ data, refunded_cents: refundedCents, refund_failed: !!refundFailureReason })
}
