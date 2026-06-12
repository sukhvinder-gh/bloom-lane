import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/utils/permissions'

// GET /api/admin/purchase-orders?status=rejected
// Returns purchase orders filtered by status (for admin dashboard alerts)
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user: _authUser } } = await supabase.auth.getUser()
  if (!_authUser) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', _authUser.id)
    .single()

  if (!isAdminRole(profile?.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const url = new URL(request.url)
  const status = url.searchParams.get('status')
  let query = admin
    .from('purchase_orders')
    .select('*, farmers(business_name), orders(order_number)')
    .order('created_at', { ascending: false })
    .limit(50)

  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}
