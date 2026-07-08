import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/utils/permissions'

const COMMISSION_RATE = 0.05

// POST /api/admin/orders/[id]/generate-payouts
// Creates a payout record per farmer for this order (5% commission deducted).
// Idempotent — skips farmers who already have a payout for this order.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params

  const supabase = await createClient()
  const { data: { user: _authUser } } = await supabase.auth.getUser()
  if (!_authUser) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const adminForAuth = createAdminClient()
  const { data: profile } = await adminForAuth
    .from('profiles').select('role').eq('id', _authUser.id).single()

  if (!isAdminRole(profile?.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Group order items by farmer
  const { data: items, error: itemsErr } = await admin
    .from('order_items')
    .select('id, farmer_id, subtotal_cents')
    .eq('order_id', orderId)

  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 })
  if (!items?.length) return NextResponse.json({ error: 'No items found for this order' }, { status: 404 })

  // Check for existing payouts for this order
  const { data: existingPayouts } = await admin
    .from('payouts')
    .select('farmer_id')
    .eq('order_id', orderId)

  const alreadyPaid = new Set((existingPayouts || []).map(p => p.farmer_id))

  // Group items by farmer
  const byFarmer: Record<string, { items: string[]; gross: number }> = {}
  for (const item of items) {
    if (!byFarmer[item.farmer_id]) byFarmer[item.farmer_id] = { items: [], gross: 0 }
    byFarmer[item.farmer_id].items.push(item.id)
    byFarmer[item.farmer_id].gross += item.subtotal_cents
  }

  const created: any[] = []
  for (const [farmerId, data] of Object.entries(byFarmer)) {
    if (alreadyPaid.has(farmerId)) continue

    const commission = Math.round(data.gross * COMMISSION_RATE)
    const availableForClawback = data.gross - commission

    // Apply pending balance adjustments (refund clawbacks) oldest-first, up to
    // what this payout can absorb. We don't reverse past Stripe transfers —
    // this is exactly that "deduct from future payouts" mechanism.
    const { data: pendingAdjustments } = await admin
      .from('farmer_balance_adjustments')
      .select('id, amount_cents')
      .eq('farmer_id', farmerId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })

    let adjustment = 0
    const adjustmentsToApply: string[] = []
    for (const adj of pendingAdjustments || []) {
      if (adjustment + adj.amount_cents > availableForClawback) break
      adjustment += adj.amount_cents
      adjustmentsToApply.push(adj.id)
    }
    const net = availableForClawback - adjustment

    const { data: payout, error } = await admin
      .from('payouts')
      .insert({
        farmer_id: farmerId,
        order_id: orderId,
        order_item_ids: data.items,
        gross_amount_cents: data.gross,
        commission_cents: commission,
        adjustment_cents: adjustment,
        net_amount_cents: net,
        status: 'pending',
      })
      .select()
      .single()

    if (!error && payout) {
      created.push(payout)
      if (adjustmentsToApply.length > 0) {
        await admin
          .from('farmer_balance_adjustments')
          .update({ status: 'applied', applied_to_payout_id: payout.id, applied_at: new Date().toISOString() })
          .in('id', adjustmentsToApply)
      }
    }
  }

  return NextResponse.json({ created, skipped: alreadyPaid.size })
}
