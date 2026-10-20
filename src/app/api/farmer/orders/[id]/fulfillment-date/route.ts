import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function requireFarmer() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const, farmer: null, admin: null }
  const admin = createAdminClient()
  const { data: farmer } = await admin.from('farmers').select('id').eq('user_id', user.id).single()
  if (!farmer) return { error: 'Farmer account not found', status: 403 as const, farmer: null, admin: null }
  return { error: null, status: 200 as const, farmer, admin }
}

// PATCH /api/farmer/orders/[id]/fulfillment-date
// Lets a grower set the date they'll have this order's items ready — their
// own call, scoped to their own purchase_orders row on this order, never
// touching any other grower sharing the same multi-vendor order.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const check = await requireFarmer()
  if (check.error || !check.farmer || !check.admin) return NextResponse.json({ error: check.error }, { status: check.status })
  const { farmer, admin } = check
  const { id: orderId } = await params

  const body = await request.json()
  const { grower_fulfillment_date } = body
  if (!grower_fulfillment_date || isNaN(new Date(grower_fulfillment_date).getTime())) {
    return NextResponse.json({ error: 'A valid grower_fulfillment_date is required' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('purchase_orders')
    .update({ grower_fulfillment_date: new Date(grower_fulfillment_date).toISOString() })
    .eq('order_id', orderId)
    .eq('farmer_id', farmer.id)
    .select('order_id, farmer_id, grower_fulfillment_date')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })

  return NextResponse.json({ data })
}
