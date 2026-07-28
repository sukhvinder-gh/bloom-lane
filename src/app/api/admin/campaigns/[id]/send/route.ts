import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'

const FROM = 'The Green Guild <onboarding@resend.dev>'
const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://bloom-lane-app.azurewebsites.net'

function buildHtml(subject: string, body: string) {
  const paragraphs = body.split('\n').filter(Boolean)
    .map(p => `<p style="color:#4a7a5a;font-size:14px;margin:0 0 14px;line-height:1.7">${p}</p>`)
    .join('')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:system-ui,-apple-system,sans-serif">
<div style="max-width:600px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <div style="background:#1a3a2a;padding:28px 40px">
    <div style="color:white;font-size:18px;font-weight:800;letter-spacing:-0.5px;text-transform:uppercase">THE GREEN GUILD</div>
  </div>
  <div style="padding:32px 40px">
    <h2 style="color:#1a3a2a;font-size:20px;font-weight:700;margin:0 0 20px">${subject}</h2>
    ${paragraphs}
    <div style="text-align:center;margin:28px 0">
      <a href="${SITE}/marketplace" style="background:#1a3a2a;color:white;padding:14px 32px;border-radius:99px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block">Shop the Market →</a>
    </div>
  </div>
  <div style="background:#f5f9f5;padding:16px 40px;text-align:center">
    <p style="color:#9ab0a0;font-size:11px;margin:0">The Green Guild — thegreenguild.com.au</p>
    <p style="color:#9ab0a0;font-size:11px;margin:4px 0 0">You received this as a newsletter subscriber. <a href="${SITE}/newsletter/unsubscribe" style="color:#4a7a5a">Unsubscribe</a></p>
  </div>
</div></body></html>`
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'platform_admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const { data: campaign } = await admin.from('campaigns').select('*').eq('id', id).eq('status', 'draft').single()
  if (!campaign) return NextResponse.json({ error: 'Campaign not found or already sent' }, { status: 404 })

  const { data: subscribers } = await admin.from('newsletter_subscribers').select('email').eq('status', 'active')
  if (!subscribers || subscribers.length === 0) {
    return NextResponse.json({ error: 'No active subscribers' }, { status: 400 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const html = buildHtml(campaign.subject, campaign.body)

  const results = await Promise.allSettled(
    subscribers.map(s => resend.emails.send({ from: FROM, to: s.email, subject: campaign.subject, html }))
  )
  const sent = results.filter(r => r.status === 'fulfilled').length
  const failed = results.length - sent

  await admin.from('campaigns').update({
    status: 'sent',
    sent_by: user.id,
    sent_at: new Date().toISOString(),
    recipient_count: sent,
  }).eq('id', id)

  return NextResponse.json({ sent, failed, total: subscribers.length })
}
