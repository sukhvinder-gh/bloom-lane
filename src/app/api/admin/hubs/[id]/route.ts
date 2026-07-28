import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/utils/permissions'
import { Resend } from 'resend'

const FROM = 'The Green Guild <onboarding@resend.dev>'
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://bloom-lane-app.azurewebsites.net'

async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!isAdminRole(profile?.role)) return { error: 'Forbidden', status: 403 as const }
  return { admin }
}

// POST — send email to coordinator
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin()
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status })

  const { id } = await params
  const { subject, message } = await request.json()
  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 })
  }

  const { data: hub } = await check.admin
    .from('hubs')
    .select('name, profiles!hubs_coordinator_id_fkey(full_name, email)')
    .eq('id', id)
    .single()

  const coord = (hub as any)?.profiles as { full_name: string | null; email: string | null } | null
  const hubName = (hub as any)?.name as string | undefined
  if (!coord?.email) {
    return NextResponse.json({ error: 'This hub has no coordinator assigned' }, { status: 400 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:system-ui,-apple-system,sans-serif">
<div style="max-width:600px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <div style="background:#1a3a2a;padding:28px 40px">
    <div style="color:white;font-size:18px;font-weight:800;letter-spacing:-0.5px;text-transform:uppercase">THE GREEN GUILD</div>
  </div>
  <div style="padding:32px 40px">
    <p style="color:#1a3a2a;font-size:15px;margin:0 0 6px">Hi ${coord.full_name || 'Coordinator'},</p>
    <p style="color:#4a7a5a;font-size:13px;margin:0 0 4px">Message regarding hub: <strong>${hubName ?? ''}</strong></p>
    <hr style="border:none;border-top:1px solid #e8f0e8;margin:20px 0">
    <div style="color:#1a3a2a;font-size:14px;line-height:1.7;white-space:pre-wrap">${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
    <hr style="border:none;border-top:1px solid #e8f0e8;margin:20px 0">
    <div style="text-align:center">
      <a href="${SITE}/dashboard" style="background:#1a3a2a;color:white;padding:12px 28px;border-radius:99px;text-decoration:none;font-weight:700;font-size:13px;display:inline-block">Go to Dashboard →</a>
    </div>
  </div>
  <div style="background:#f5f9f5;padding:14px 40px;text-align:center">
    <p style="color:#4a7a5a;font-size:11px;margin:0">The Green Guild — thegreenguild.com.au</p>
  </div>
</div></body></html>`

  const { error } = await resend.emails.send({ from: FROM, to: coord.email, subject: subject.trim(), html })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// DELETE — remove hub (blocked if growers still assigned)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin()
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status })

  const { id } = await params

  const { count } = await check.admin
    .from('farmers')
    .select('id', { count: 'exact', head: true })
    .eq('hub_id', id)

  if (count && count > 0) {
    return NextResponse.json({
      error: `Cannot delete: ${count} grower${count !== 1 ? 's' : ''} still assigned to this hub. Reassign them first.`,
    }, { status: 400 })
  }

  const { error } = await check.admin.from('hubs').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
