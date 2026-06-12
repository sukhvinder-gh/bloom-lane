import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'platform_admin', 'super_admin'].includes(profile.role)) return null
  return { user, admin }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const { subject, body } = await request.json()

  const { data, error } = await auth.admin.from('campaigns')
    .update({ subject: subject?.trim() ?? '', body: body?.trim() ?? '', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'draft')
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Campaign not found or already sent' }, { status: 404 })
  return NextResponse.json({ campaign: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params

  const { error } = await auth.admin.from('campaigns').delete().eq('id', id).eq('status', 'draft')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
