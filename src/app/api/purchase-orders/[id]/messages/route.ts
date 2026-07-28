// src/app/api/purchase-orders/[id]/messages/route.ts
//
// Order messaging — one thread per (order, farmer) via purchase_order_id, so
// a buyer's conversation with one grower on a multi-supplier order never
// leaks to another grower's thread on the same order.

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/utils/permissions'
import { z } from 'zod'

async function resolveViewerRole(admin: ReturnType<typeof createAdminClient>, userId: string, poId: string) {
  const { data: po } = await admin
    .from('purchase_orders')
    .select('id, order_id, farmer_id, orders(buyer_id), farmers(user_id)')
    .eq('id', poId)
    .single()

  if (!po) return { role: null, po: null }

  const { data: profile } = await admin.from('profiles').select('role').eq('id', userId).single()

  if ((po as any).orders?.buyer_id === userId) return { role: 'buyer' as const, po }
  if ((po as any).farmers?.user_id === userId) return { role: 'farmer' as const, po }
  if (isAdminRole(profile?.role)) return { role: 'admin' as const, po }
  return { role: null, po }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: poId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { role, po } = await resolveViewerRole(admin, user.id, poId)
  if (!po) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await admin
    .from('messages')
    .select('id, sender_id, sender_role, body, created_at, profiles(full_name, business_name)')
    .eq('purchase_order_id', poId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, viewer_role: role })
}

const sendMessageSchema = z.object({
  body: z.string().trim().min(1).max(2000),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: poId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { role, po } = await resolveViewerRole(admin, user.id, poId)
  if (!po) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = sendMessageSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { data, error } = await admin
    .from('messages')
    .insert({
      purchase_order_id: poId,
      sender_id: user.id,
      sender_role: role,
      body: parsed.data.body,
    })
    .select('id, sender_id, sender_role, body, created_at, profiles(full_name, business_name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
