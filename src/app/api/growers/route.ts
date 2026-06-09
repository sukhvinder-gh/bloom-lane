import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

// Public — no auth required
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const region       = searchParams.get('region') || ''
  const sustainability = searchParams.get('sustainability') || ''
  const flowerType   = searchParams.get('flower_type') || ''

  const admin = createAdminClient()

  // Fetch approved farmers — explicitly exclude contact/financial fields
  let query = admin
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
    .eq('status', 'approved')
    .order('business_name')

  if (region) query = query.ilike('region', `%${region}%`)
  if (sustainability) query = query.contains('sustainability', [sustainability])

  const { data: farmers, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let result = farmers || []

  // Filter by flower type via products table if requested
  if (flowerType && result.length > 0) {
    const farmerIds = result.map(f => f.id)
    const { data: matchingProducts } = await admin
      .from('products')
      .select('farmer_id')
      .in('farmer_id', farmerIds)
      .eq('category', flowerType)
      .eq('is_active', true)

    const matchingIds = new Set((matchingProducts || []).map(p => p.farmer_id))
    result = result.filter(f => matchingIds.has(f.id))
  }

  return NextResponse.json({ data: result })
}
