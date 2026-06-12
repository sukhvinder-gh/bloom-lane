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

export async function GET() {
  const auth = await requireAdmin()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { admin } = auth

  const [
    { count: activeCount },
    { count: sentCount },
    { count: draftCount },
    { data: campaigns },
  ] = await Promise.all([
    admin.from('newsletter_subscribers').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    admin.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'sent'),
    admin.from('campaigns').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
    admin.from('campaigns').select('id, subject, body, status, sent_at, recipient_count, created_at, updated_at').order('created_at', { ascending: false }).limit(50),
  ])

  return NextResponse.json({
    activeCount: activeCount ?? 0,
    sentCount: sentCount ?? 0,
    draftCount: draftCount ?? 0,
    campaigns: campaigns ?? [],
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { admin } = auth

  const { subject, body } = await request.json()
  const { data, error } = await admin.from('campaigns').insert({
    subject: subject?.trim() ?? '',
    body: body?.trim() ?? '',
    status: 'draft',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campaign: data }, { status: 201 })
}
