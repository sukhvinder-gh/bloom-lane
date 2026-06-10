// src/app/api/admin/orders/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/utils/permissions'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const adminSupabase = createAdminClient()

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await adminSupabase.from('profiles').select('role').eq('id', session.user.id).single()
    if (!isAdminRole(profile?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data, error } = await adminSupabase
      .from('orders')
      .select(`
        *,
        profiles!orders_buyer_id_fkey(full_name, email),
        order_items(*, products(name, unit), farmers(business_name, brand_color))
      `)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data || [] })
  } catch (err: any) {
    console.error('admin/orders error:', err)
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}
