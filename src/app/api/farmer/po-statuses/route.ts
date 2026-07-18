import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserFromCookie, createAdminClient } from '@/lib/supabase/server'

// GET /api/farmer/po-statuses?ids=orderId1,orderId2,...
// Returns { data: { [orderId]: status } } for this farmer's POs across the given orders.
export async function GET(request: NextRequest) {
  const sessionUser = await getSessionUserFromCookie()
  if (!sessionUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ids = request.nextUrl.searchParams.get('ids')
  if (!ids) return NextResponse.json({ data: {} })

  const orderIds = ids.split(',').filter(Boolean).slice(0, 100)
  if (orderIds.length === 0) return NextResponse.json({ data: {} })

  const admin = createAdminClient()

  const { data: farmers } = await admin
    .from('farmers')
    .select('id')
    .eq('user_id', sessionUser.id)
    .limit(1)
  const farmer = farmers?.[0]
  if (!farmer) return NextResponse.json({ data: {} })

  const { data: pos } = await admin
    .from('purchase_orders')
    .select('id, order_id, status, pickup_method')
    .eq('farmer_id', farmer.id)
    .in('order_id', orderIds)

  const map: Record<string, string> = {}
  const poIdMap: Record<string, string> = {}
  const pickupMap: Record<string, string> = {}
  for (const po of pos ?? []) {
    map[po.order_id] = po.status
    poIdMap[po.order_id] = po.id
    pickupMap[po.order_id] = po.pickup_method
  }

  return NextResponse.json({ data: map, ids: poIdMap, pickupMethods: pickupMap })
}
