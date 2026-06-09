import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/cart/validate?ids=uuid,uuid&b2b=true
// Returns current available stock per product so the checkout page can
// warn the user if any item quantity exceeds what is still in stock.
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const idsParam = url.searchParams.get('ids') || ''
  const isB2B = url.searchParams.get('b2b') === 'true'

  const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean)
  if (ids.length === 0) return NextResponse.json({ items: [] })

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('products')
    .select('id, name, unit, b2b_available, b2c_available, is_listed_this_week, is_active')
    .in('id', ids)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const items = (data || []).map(p => ({
    product_id: p.id,
    name: p.name,
    unit: p.unit,
    available: isB2B ? (p.b2b_available || 0) : (p.b2c_available || 0),
    still_listed: p.is_active && p.is_listed_this_week,
  }))

  return NextResponse.json({ items })
}
