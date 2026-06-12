import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

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
