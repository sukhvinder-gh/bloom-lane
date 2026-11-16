import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/utils/permissions'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user: _authUser } } = await supabase.auth.getUser()
  if (!_authUser) return { error: 'Unauthorised', status: 401 as const }
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', _authUser.id).single()
  if (!isAdminRole(profile?.role)) return { error: 'Admin access required', status: 403 as const }
  return { error: null, status: 200 as const }
}

// Orders that never got paid (or were already cancelled) have no payouts,
// disputes, or refunds attached — deleting them outright is safe. Anything
// that's actually been paid for must be cancelled (keeps the record), never
// deleted, so real order history can't be erased from this endpoint.
const DELETABLE_STATUSES = ['pending_payment', 'cancelled']

// DELETE /api/admin/orders/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin()
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id: orderId } = await params
  const admin = createAdminClient()

  const { data: order, error: fetchError } = await admin
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .single()
  if (fetchError || !order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

  if (!DELETABLE_STATUSES.includes(order.status)) {
    return NextResponse.json({ error: `Only pending or cancelled orders can be deleted (this one is "${order.status}")` }, { status: 409 })
  }

  const { error } = await admin.from('orders').delete().eq('id', orderId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
