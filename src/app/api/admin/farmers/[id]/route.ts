// src/app/api/admin/farmers/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const { status } = body

    const updates: any = { status }
    if (status === 'approved') {
      updates.approved_at = new Date().toISOString()
      updates.approved_by = user.id
    }

    const adminSupabase = createAdminClient()
    const { data, error } = await adminSupabase
      .from('farmers')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data })

  } catch (err: any) {
    console.error('[PATCH /api/admin/farmers/[id]]', err)
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 })
  }
}