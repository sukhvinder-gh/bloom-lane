import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/mailer'

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// POST — a grower just picked (or re-requested) a hub as their collection
// point; let that hub's coordinator know a request is waiting on them.
// Called by the storefront save flow, not itself responsible for creating
// the farmer_fulfillment_options row (already inserted client-side by then)
// — best-effort only, so a failure here never blocks the grower's save.
export async function POST(request: NextRequest) {
  const { hub_id } = await request.json()
  if (!hub_id) return NextResponse.json({ error: 'hub_id is required' }, { status: 400 })

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: farmer } = await admin.from('farmers').select('business_name').eq('user_id', user.id).single()
  const { data: hub } = await admin.from('hubs').select('name, coordinator_id').eq('id', hub_id).maybeSingle()
  if (!hub?.coordinator_id) return NextResponse.json({ ok: true, notified: false })

  const { data: coordinator } = await admin.from('profiles').select('email').eq('id', hub.coordinator_id).maybeSingle()
  if (!coordinator?.email) return NextResponse.json({ ok: true, notified: false })

  const growerName = farmer?.business_name || 'A grower'
  sendEmail({
    to: coordinator.email,
    subject: `${growerName} wants to use ${hub?.name || 'your hub'} as their collection point`,
    html: `<p><strong>${escapeHtml(growerName)}</strong> has requested to use <strong>${escapeHtml(hub?.name || 'your hub')}</strong> as their collection point.</p>
<p>Review and approve or decline it from your hub page.</p>`,
  }).catch(() => {})

  return NextResponse.json({ ok: true, notified: true })
}
