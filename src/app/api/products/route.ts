// src/app/api/products/route.ts — GET marketplace listing, POST create product

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isListingWindowOpen } from '@/lib/utils/timezone'
import { hasActiveMembership } from '@/lib/utils/membership'
import { z } from 'zod'

const createProductSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  category: z.enum(['flowers_cut', 'flowers_dried', 'flowers_native', 'foliage', 'vegetables', 'herbs', 'fruit', 'eggs', 'honey', 'other']),
  unit: z.string().min(1).max(20),
  wholesale_price: z.number().int().positive(),
  b2c_markup_pct: z.number().min(0).max(5).default(0.45),
  b2b_stock_pct: z.number().min(0).max(1).default(0.5),
  stock_total: z.number().int().nonnegative(),
  min_order_b2b: z.number().int().positive().default(1),
  is_gst_free: z.boolean().default(false),
  is_listed_this_week: z.boolean().default(false),
  image_url: z.string().url().optional().nullable(),
  image_urls: z.array(z.string().url()).optional(),
  color_tags: z.array(z.string()).max(6).optional(),
  common_name: z.string().max(80).optional().nullable(),
  latin_name: z.string().max(80).optional().nullable(),
  stems_per_unit: z.number().int().positive().optional().nullable(),
})

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const url = new URL(request.url)
  const isB2B = url.searchParams.get('b2b') !== 'false'
  const category = url.searchParams.get('category') || ''
  const ownOnly = url.searchParams.get('own') === 'true'
  const facetsOnly = url.searchParams.get('facets') === 'true'

  // Distinct farm/region names across ALL currently-listed products — used
  // to populate the marketplace's Farm/Region filter dropdowns. This must
  // stay independent of category/color/farmer_id filters, otherwise once a
  // buyer is scoped to one farm (e.g. via a grower-profile link), the filter
  // list itself would only ever contain that one farm, with no way to add
  // or switch to another from within it.
  if (facetsOnly) {
    let facetQuery = supabase
      .from('products')
      .select('farmers(business_name, region)')
      .eq('is_listed_this_week', true)
      .eq('is_active', true)
    facetQuery = isB2B ? facetQuery.gt('b2b_available', 0) : facetQuery.gt('b2c_available', 0)
    const { data: facetRows, error: facetError } = await facetQuery
    if (facetError) return NextResponse.json({ error: facetError.message }, { status: 500 })
    const farms = [...new Set((facetRows || []).map((r: any) => r.farmers?.business_name).filter(Boolean))].sort()
    const regions = [...new Set((facetRows || []).map((r: any) => r.farmers?.region).filter(Boolean))].sort()
    return NextResponse.json({ data: { farms, regions } })
  }

  if (ownOnly) {
    // Farmer fetching their own products (all, including unlisted)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: farmer } = await supabase.from('farmers').select('id').eq('user_id', user.id).single()
    if (!farmer) return NextResponse.json({ error: 'Not a farmer' }, { status: 403 })

    // Includes archived (is_active=false) products — a grower needs to see and
    // restore those from their own inventory list, not just active listings.
    // farmers(gst_registered) lets the inventory UI tell "GST-free" (this
    // specific product's tax category) apart from "No GST" (this grower isn't
    // registered, so GST never applies regardless of the product's category).
    let query = supabase.from('products').select('*, farmers(gst_registered)').eq('farmer_id', farmer.id)
    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })
  }

  // Public marketplace listing — only listed + active products
  let query = supabase
    .from('products')
    .select('*, farmers(business_name, region, suburb, state, address, offers_farm_pickup, gst_registered, farmer_fulfillment_options(id, type, day_of_week, start_time, end_time, cost_cents, max_distance_km, notes))')
    .eq('is_listed_this_week', true)
    .eq('is_active', true)

  if (category) query = query.eq('category', category)

  // `colors` (comma-separated, multi-select) is the current param; `color`
  // (single value) is kept for backward compatibility with any old callers.
  const colorsParam = url.searchParams.get('colors') || url.searchParams.get('color') || ''
  const colors = colorsParam.split(',').map(c => c.trim()).filter(Boolean)
  if (colors.length) query = query.overlaps('color_tags', colors)

  const farmerId = url.searchParams.get('farmer_id') || ''
  if (farmerId) query = query.eq('farmer_id', farmerId)

  // Filter out products with zero stock in the relevant pool
  if (isB2B) {
    query = query.gt('b2b_available', 0)
  } else {
    query = query.gt('b2c_available', 0)
  }

  const { data, error } = await query.order('name', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { getBuyerUnitPrice } = await import('@/lib/utils/pricing')
  const withPrices = (data || []).map(p => {
    const growerGstRegistered = !!(p as any).farmers?.gst_registered
    const b2b_unit_price_inc_gst = getBuyerUnitPrice(p, true, growerGstRegistered)   // wholesale + GST (checkout amount)
    const b2c_unit_price_inc_gst = getBuyerUnitPrice(p, false, growerGstRegistered)  // retail + GST (checkout amount)
    const b2c_retail_ex_gst = Math.round(p.wholesale_price * (1 + (p.b2c_markup_pct || 0.45)))
    return {
      ...p,
      buyer_unit_price: isB2B ? b2b_unit_price_inc_gst : b2c_unit_price_inc_gst,
      // Explicit display prices
      b2b_display_price: p.wholesale_price,           // ex-GST, shown on B2B card
      b2c_display_price: b2c_unit_price_inc_gst,      // retail inc-GST, shown on B2C card
      b2c_retail_ex_gst,                              // retail ex-GST (for reference)
    }
  })

  return NextResponse.json({ data: withPrices })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const adminSupabase = await createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: farmer } = await supabase
    .from('farmers').select('id, status').eq('user_id', user.id).single()

  if (!farmer) return NextResponse.json({ error: 'Farmer account not found' }, { status: 403 })
  if (farmer.status !== 'approved') {
    return NextResponse.json({ error: 'Farmer account not yet approved' }, { status: 403 })
  }
  if (!(await hasActiveMembership(user.id))) {
    return NextResponse.json({ error: 'An approved membership is required before you can list products.' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createProductSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { is_listed_this_week, ...rest } = parsed.data

  // Only allow listing during window
  const canList = is_listed_this_week && isListingWindowOpen()

  const { data, error } = await adminSupabase
    .from('products')
    .insert({ ...rest, farmer_id: farmer.id, is_listed_this_week: canList })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
