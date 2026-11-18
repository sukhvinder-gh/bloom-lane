import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/utils/permissions'
import { sendEmail } from '@/lib/email/mailer'

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function requireCoordinator(hubId: string) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const }

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (isAdminRole(profile?.role)) return { admin }

  const { data: hub } = await admin.from('hubs').select('id').eq('id', hubId).eq('coordinator_id', user.id).maybeSingle()
  if (!hub) return { error: 'Forbidden', status: 403 as const }
  return { admin }
}

// POST — send a message to everyone using this hub as their collection
// point: growers who've chosen it, and buyers with an order still awaiting
// collection from it.
export async function POST(request: NextRequest) {
  const { hub_id, subject, message } = await request.json()
  if (!hub_id || !subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'hub_id, subject and message are required' }, { status: 400 })
  }

  const check = await requireCoordinator(hub_id)
  if ('error' in check) return NextResponse.json({ error: check.error }, { status: check.status })
  const { admin } = check

  const { data: hub } = await admin.from('hubs').select('name').eq('id', hub_id).single()

  const { data: options } = await admin
    .from('farmer_fulfillment_options')
    .select('id, farmer_id')
    .eq('hub_id', hub_id)
    .eq('type', 'collection_point')
  const farmerIds = [...new Set((options || []).map((o: any) => o.farmer_id))]
  const cpOptionIds = (options || []).map((o: any) => o.id)

  const growerEmails: string[] = []
  if (farmerIds.length > 0) {
    const { data: farmers } = await admin.from('farmers').select('email').in('id', farmerIds)
    for (const f of farmers || []) if ((f as any).email) growerEmails.push((f as any).email)
  }

  const buyerEmails: string[] = []
  if (cpOptionIds.length > 0) {
    const { data: pos } = await admin
      .from('purchase_orders')
      .select('order_id, collection_point_checkins(checkin_type)')
      .in('fulfillment_option_id', cpOptionIds)
    const outstandingOrderIds = [...new Set(
      (pos || [])
        .filter((p: any) => !(p.collection_point_checkins || []).some((c: any) => c.checkin_type === 'buyer_collection'))
        .map((p: any) => p.order_id)
    )]
    if (outstandingOrderIds.length > 0) {
      const { data: orders } = await admin.from('orders').select('buyer_id').in('id', outstandingOrderIds)
      const buyerIds = [...new Set((orders || []).map((o: any) => o.buyer_id))]
      if (buyerIds.length > 0) {
        const { data: profiles } = await admin.from('profiles').select('email').in('id', buyerIds)
        for (const p of profiles || []) if ((p as any).email) buyerEmails.push((p as any).email)
      }
    }
  }

  const recipients = [...new Set([...growerEmails, ...buyerEmails])]
  if (recipients.length === 0) return NextResponse.json({ ok: true, sent: 0, failed: 0 })

  const html = `
<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto">
  <p style="color:#1a3a2a;font-size:14px">A message from <strong>${escapeHtml(hub?.name || 'your collection point')}</strong>:</p>
  <div style="background:#f5f9f5;border-radius:10px;padding:16px 20px;white-space:pre-wrap;color:#1a3a2a;font-size:14px;line-height:1.6">${escapeHtml(message)}</div>
</div>`

  const results = await Promise.allSettled(
    recipients.map(email => sendEmail({ to: email, subject: subject.trim(), html }))
  )
  const sent = results.filter(r => r.status === 'fulfilled').length

  return NextResponse.json({ ok: true, sent, failed: recipients.length - sent, recipients: recipients.length })
}
