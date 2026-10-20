// src/app/api/products/[id]/route.ts
// BUG-07 FIX: This route was completely missing — inventory toggle in UI was hitting 404
// Handles: GET product, PATCH product (includes is_listed_this_week toggle), DELETE product

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'
import { isListingWindowOpen } from '@/lib/utils/timezone'
import { isAdminRole } from '@/lib/utils/permissions'
import { z } from 'zod'

const updateProductSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).optional(),
  category: z.enum(['flowers_cut', 'flowers_dried', 'flowers_native', 'foliage', 'vegetables', 'herbs', 'fruit', 'eggs', 'honey', 'other']).optional(),
  unit: z.string().min(1).max(20).optional(),
  wholesale_price: z.number().int().positive().optional(),
  b2c_markup_pct: z.number().min(0).max(5).optional(),
  b2b_stock_pct: z.number().min(0).max(1).optional(),
  stock_total: z.number().int().nonnegative().optional(),
  min_order_b2b: z.number().int().positive().optional(),
  is_gst_free: z.boolean().optional(),
  is_listed_this_week: z.boolean().optional(),
  is_active: z.boolean().optional(),
  image_url: z.string().url().optional().nullable(),
  image_urls: z.array(z.string().url()).optional(),
  color_tags: z.array(z.string()).max(6).optional(),
  common_name: z.string().max(80).optional().nullable(),
  latin_name: z.string().max(80).optional().nullable(),
  stems_per_unit: z.number().int().positive().optional().nullable(),
})

async function getFarmerForUser(supabase: any, userId: string) {
  const { data } = await supabase
    .from('farmers').select('id, status').eq('user_id', userId).single()
  return data
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('products')
    .select('*, farmers(business_name, suburb, state)')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const adminSupabase = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = isAdminRole(profile?.role)

  if (!isAdmin) {
    const farmer = await getFarmerForUser(supabase, user.id)
    if (!farmer) return NextResponse.json({ error: 'Farmer account not found' }, { status: 403 })
    if (farmer.status !== 'approved') return NextResponse.json({ error: 'Farmer account not approved' }, { status: 403 })

    const { data: product } = await supabase
      .from('products').select('farmer_id').eq('id', id).single()
    if (!product || product.farmer_id !== farmer.id) {
      return NextResponse.json({ error: 'Product not found or not yours' }, { status: 403 })
    }
  }

  const body = await request.json()
  const parsed = updateProductSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const updates = { ...parsed.data }

  if ('is_listed_this_week' in updates && !isAdmin) {
    if (!isListingWindowOpen()) {
      return NextResponse.json(
        { error: 'Listing window is closed. You cannot toggle listings until Sunday midnight AEST.' },
        { status: 400 }
      )
    }
  }

  const sensitiveFields = ['wholesale_price', 'stock_total', 'min_order_b2b']
  const touchesSensitive = sensitiveFields.some(f => f in updates)
  if (touchesSensitive && !isAdmin && !isListingWindowOpen()) {
    return NextResponse.json(
      { error: 'Price and stock changes are locked until the next listing window.' },
      { status: 400 }
    )
  }

  const { data, error } = await adminSupabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const adminSupabase = createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const farmer = await getFarmerForUser(supabase, user.id)
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = isAdminRole(profile?.role)

  if (!farmer && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await adminSupabase
    .from('products')
    .update({ is_active: false, is_listed_this_week: false })
    .eq('id', id)
    .eq(isAdmin ? 'id' : 'farmer_id', isAdmin ? id : farmer.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}