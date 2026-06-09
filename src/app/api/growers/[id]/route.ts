import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: farmer, error } = await admin
    .from('farmers')
    .select(`
      id,
      business_name,
      bio,
      suburb,
      state,
      brand_color,
      banner_url,
      logo_url,
      region,
      growing_practices,
      seasonal_specialties,
      sustainability,
      created_at
    `)
    .eq('id', id)
    .eq('status', 'approved')
    .single()

  if (error || !farmer) return NextResponse.json({ error: 'Grower not found' }, { status: 404 })

  // Fetch their active products (public info only)
  const { data: products } = await admin
    .from('products')
    .select('id, name, category, unit, wholesale_price, b2c_markup_pct, b2c_available, image_url, is_gst_free')
    .eq('farmer_id', id)
    .eq('is_active', true)
    .gt('b2c_available', 0)
    .order('category')

  return NextResponse.json({ data: { ...farmer, products: products || [] } })
}
