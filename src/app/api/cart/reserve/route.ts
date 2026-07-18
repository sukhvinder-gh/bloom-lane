// src/app/api/cart/reserve/route.ts
//
// Real server-side stock hold for the cart — POST reserves (or adjusts) a
// buyer's hold on a product for 60 minutes, deducting from the same
// b2b_available/b2c_available pool checkout uses so other buyers can't grab
// the same stock; DELETE releases it (item removed from cart).

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'

const RESERVATION_MINUTES = 60

const reserveSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  is_b2b: z.boolean(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = reserveSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  const { product_id, quantity, is_b2b } = parsed.data

  const admin = createAdminClient()
  const expiresAt = new Date(Date.now() + RESERVATION_MINUTES * 60_000).toISOString()

  const { data, error } = await admin.rpc('cart_set_reservation', {
    p_user_id: user.id,
    p_product_id: product_id,
    p_quantity: quantity,
    p_is_b2b: is_b2b,
    p_expires_at: expiresAt,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.success) return NextResponse.json({ error: data?.error || 'Could not reserve stock', available: data?.available }, { status: 409 })

  return NextResponse.json({ success: true, expires_at: data.expires_at })
}

const releaseSchema = z.object({
  product_id: z.string().uuid(),
  is_b2b: z.boolean(),
})

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = releaseSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('cart_release_reservation', {
    p_user_id: user.id,
    p_product_id: parsed.data.product_id,
    p_is_b2b: parsed.data.is_b2b,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, released: data?.released ?? 0 })
}
