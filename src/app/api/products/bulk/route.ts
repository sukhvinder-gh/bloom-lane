import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isListingWindowOpen } from '@/lib/utils/timezone'
import { z } from 'zod'

const VALID_CATEGORIES = ['flowers_cut', 'flowers_dried', 'foliage', 'vegetables', 'herbs', 'fruit', 'eggs', 'honey', 'other']

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: farmer } = await supabase.from('farmers').select('id, status').eq('user_id', user.id).single()
  if (!farmer) return NextResponse.json({ error: 'Farmer account not found' }, { status: 403 })
  if (farmer.status !== 'approved') return NextResponse.json({ error: 'Farmer account not yet approved' }, { status: 403 })

  const { products } = await request.json()
  if (!Array.isArray(products) || products.length === 0) {
    return NextResponse.json({ error: 'No products provided' }, { status: 400 })
  }
  if (products.length > 200) {
    return NextResponse.json({ error: 'Maximum 200 products per import' }, { status: 400 })
  }

  const rows: any[] = []
  const errors: Array<{ row: number; message: string }> = []

  products.forEach((p: any, i: number) => {
    const row = i + 2 // +2 because row 1 is header
    if (!p.name?.trim()) { errors.push({ row, message: 'Name is required' }); return }
    if (!VALID_CATEGORIES.includes(p.category)) { errors.push({ row, message: `Invalid category: ${p.category}` }); return }
    if (!p.unit?.trim()) { errors.push({ row, message: 'Unit is required' }); return }

    const price = Number(p.wholesale_price)
    if (isNaN(price) || price <= 0) { errors.push({ row, message: 'wholesale_price must be a positive number' }); return }

    const stock = Number(p.stock_total ?? 0)
    if (!Number.isInteger(stock) || stock < 0) { errors.push({ row, message: 'stock must be a non-negative integer' }); return }

    const minOrder = Number(p.min_order_b2b ?? 1)

    rows.push({
      farmer_id: farmer.id,
      name: p.name.trim(),
      category: p.category,
      unit: p.unit.trim(),
      wholesale_price: Math.round(price * 100),
      stock_total: stock,
      min_order_b2b: Number.isInteger(minOrder) && minOrder > 0 ? minOrder : 1,
      is_gst_free: ['yes', 'true', '1'].includes(String(p.is_gst_free).toLowerCase()),
      description: p.description?.trim() || null,
      is_active: true,
      is_listed_this_week: false,
    })
  })

  if (errors.length > 0) return NextResponse.json({ errors }, { status: 422 })

  const admin = createAdminClient()
  const { data, error } = await admin.from('products').insert(rows).select('id, name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ inserted: data?.length ?? 0, products: data }, { status: 201 })
}

// PATCH — bulk-update existing listings (weekly cadence: toggle listed/archived,
// or set stock across many products in one action) instead of one row at a time.
const bulkUpdateSchema = z.object({
  product_ids: z.array(z.string().uuid()).min(1).max(200),
  updates: z.object({
    is_listed_this_week: z.boolean().optional(),
    is_active: z.boolean().optional(),
    stock_total: z.number().int().nonnegative().optional(),
  }).refine(u => Object.keys(u).length > 0, { message: 'No updates provided' }),
})

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: farmer } = await supabase.from('farmers').select('id, status').eq('user_id', user.id).single()
  if (!farmer) return NextResponse.json({ error: 'Farmer account not found' }, { status: 403 })
  if (farmer.status !== 'approved') return NextResponse.json({ error: 'Farmer account not yet approved' }, { status: 403 })

  const body = await request.json()
  const parsed = bulkUpdateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { product_ids } = parsed.data
  const updates: typeof parsed.data.updates = { ...parsed.data.updates }

  // Archiving (is_active: false) is always allowed, same as the single-product
  // delete/archive route — it's a "stop selling this" action, not a listing-window
  // change. It also always force-unlists, so restoring later never silently
  // re-lists a product without the grower explicitly opting back in.
  const isArchiving = updates.is_active === false
  if (isArchiving) {
    updates.is_listed_this_week = false
  } else {
    // Everything else (turning listing on/off, changing stock) follows the
    // same weekly-cadence gate as the single-product PATCH route.
    const touchesListingWindowFields = 'is_listed_this_week' in updates || 'stock_total' in updates
    if (touchesListingWindowFields && !isListingWindowOpen()) {
      return NextResponse.json(
        { error: 'Listing window is closed. Availability and stock are locked until Sunday midnight AEST.' },
        { status: 400 }
      )
    }
  }

  const admin = createAdminClient()

  // Ownership check — every id must belong to this farmer, or none get updated.
  const { data: owned, error: ownedErr } = await admin
    .from('products')
    .select('id')
    .eq('farmer_id', farmer.id)
    .in('id', product_ids)

  if (ownedErr) return NextResponse.json({ error: ownedErr.message }, { status: 500 })

  const ownedIds = new Set((owned || []).map(p => p.id))
  const notOwned = product_ids.filter(id => !ownedIds.has(id))
  if (notOwned.length > 0) {
    return NextResponse.json({ error: `${notOwned.length} product(s) not found or not yours` }, { status: 403 })
  }

  const { data, error } = await admin
    .from('products')
    .update(updates)
    .in('id', product_ids)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ updated: data?.length ?? 0 })
}
