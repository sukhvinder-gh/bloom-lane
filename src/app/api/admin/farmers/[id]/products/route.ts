import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/utils/permissions'
import { z } from 'zod'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user: _authUser } } = await supabase.auth.getUser()
  if (!_authUser) return { error: 'Unauthorized', status: 401 as const, admin: null }
  const adminClient = createAdminClient()
  const { data: profile } = await adminClient.from('profiles').select('role').eq('id', _authUser.id).single()
  if (!isAdminRole(profile?.role)) return { error: 'Forbidden', status: 403 as const, admin: null }
  return { error: null, status: 200 as const, admin: adminClient }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, status, admin } = await requireAdmin()
  if (error || !admin) return NextResponse.json({ error }, { status })

  const { id: farmerId } = await params

  const { data, error: dbErr } = await admin
    .from('products')
    .select('*')
    .eq('farmer_id', farmerId)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data })
}

const productSchema = z.object({
  name:               z.string().min(2).max(100),
  description:        z.string().max(500).optional(),
  category:           z.enum(['flowers_cut', 'flowers_dried', 'flowers_native', 'foliage', 'vegetables', 'herbs', 'fruit', 'eggs', 'honey', 'other']),
  unit:               z.string().min(1).max(20),
  wholesale_price:    z.number().int().positive(),
  stock_total:        z.number().int().nonnegative(),
  min_order_b2b:      z.number().int().positive().default(1),
  is_gst_free:        z.boolean().default(false),
  is_listed_this_week: z.boolean().default(false),
  image_url:          z.string().url().optional().nullable(),
  image_urls:         z.array(z.string().url()).optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, status, admin } = await requireAdmin()
  if (error || !admin) return NextResponse.json({ error }, { status })

  const { id: farmerId } = await params

  const { data: farmer } = await admin.from('farmers').select('id').eq('id', farmerId).single()
  if (!farmer) return NextResponse.json({ error: 'Farmer not found' }, { status: 404 })

  const body = await request.json()
  const parsed = productSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { data, error: dbErr } = await admin
    .from('products')
    .insert({ ...parsed.data, farmer_id: farmerId })
    .select()
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

const updateSchema = productSchema.partial()

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, status, admin } = await requireAdmin()
  if (error || !admin) return NextResponse.json({ error }, { status })

  const { id: farmerId } = await params
  const body = await request.json()
  const { productId, ...rest } = body

  if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 })

  const parsed = updateSchema.safeParse(rest)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { data, error: dbErr } = await admin
    .from('products')
    .update(parsed.data)
    .eq('id', productId)
    .eq('farmer_id', farmerId)
    .select()
    .single()

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, status, admin } = await requireAdmin()
  if (error || !admin) return NextResponse.json({ error }, { status })

  const { id: farmerId } = await params
  const { productId } = await request.json()
  if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 })

  const { error: dbErr } = await admin
    .from('products')
    .update({ is_active: false, is_listed_this_week: false })
    .eq('id', productId)
    .eq('farmer_id', farmerId)

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
