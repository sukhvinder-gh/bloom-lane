import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/utils/permissions'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const, admin: null }
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!isAdminRole(profile?.role)) return { error: 'Forbidden', status: 403 as const, admin: null }
  return { error: null, status: 200 as const, admin }
}

export async function GET() {
  const { error, status, admin } = await requireAdmin()
  if (error || !admin) return NextResponse.json({ error }, { status })

  const { data, error: dbErr } = await admin
    .from('products')
    .select(`
      id, name, description, category, unit,
      wholesale_price, stock_total, min_order_b2b,
      is_gst_free, is_listed_this_week, is_active,
      image_url, image_urls, created_at, updated_at, farmer_id,
      farmers(
        id,
        business_name,
        hub_id,
        hubs(name, region)
      )
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data })
}

// Quick toggle — only is_listed_this_week supported from the global inventory view
export async function PATCH(request: NextRequest) {
  const { error, status, admin } = await requireAdmin()
  if (error || !admin) return NextResponse.json({ error }, { status })

  const { productId, farmerId, is_listed_this_week } = await request.json()
  if (!productId || !farmerId) return NextResponse.json({ error: 'productId and farmerId required' }, { status: 400 })

  const { data, error: dbErr } = await admin
    .from('products')
    .update({ is_listed_this_week, updated_at: new Date().toISOString() })
    .eq('id', productId)
    .eq('farmer_id', farmerId)
    .eq('is_active', true)
    .select()
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data })
}
