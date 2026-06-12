import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/utils/permissions'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params

  const supabase = await createSupabaseServerClient()
  const { data: { user: _authUser } } = await supabase.auth.getUser()
  if (!_authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', _authUser.id).single()
  if (!isAdminRole(profile?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Clear the partial rejection flag
  const { error } = await admin
    .from('orders')
    .update({ has_partial_rejection: false, updated_at: new Date().toISOString() })
    .eq('id', orderId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Re-check auto-aggregate: if all non-rejected POs are delivered_to_hub, advance order
  const { data: allPOs } = await admin
    .from('purchase_orders')
    .select('status')
    .eq('order_id', orderId)

  const activePOs = allPOs?.filter(p => p.status !== 'rejected') ?? []
  const allDelivered = activePOs.length > 0 && activePOs.every(p => p.status === 'delivered_to_hub')

  if (allDelivered) {
    await admin
      .from('orders')
      .update({ status: 'ready_for_pickup', updated_at: new Date().toISOString() })
      .eq('id', orderId)
    return NextResponse.json({ ok: true, advanced: true, status: 'ready_for_pickup' })
  }

  return NextResponse.json({ ok: true, advanced: false })
}
