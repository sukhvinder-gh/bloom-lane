import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/mailer'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://bloom-lane-app.azurewebsites.net'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || !['admin', 'platform_admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { subject, body, to } = await request.json()
  if (!subject?.trim() || !body?.trim() || !to?.trim()) {
    return NextResponse.json({ error: 'subject, body, and to are required' }, { status: 400 })
  }

  const paragraphs = body.split('\n').filter(Boolean)
    .map((p: string) => `<p style="color:#4a7a5a;font-size:14px;margin:0 0 14px;line-height:1.7">${p}</p>`)
    .join('')

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:system-ui,-apple-system,sans-serif">
<div style="max-width:600px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <div style="background:#1a3a2a;padding:20px 40px;display:flex;align-items:center;justify-content:space-between">
    <div style="color:white;font-size:18px;font-weight:800;letter-spacing:-0.5px;text-transform:uppercase">THE GREEN GUILD</div>
    <span style="background:rgba(255,255,255,0.15);color:white;font-size:10px;font-weight:700;padding:4px 10px;border-radius:99px;letter-spacing:0.06em">TEST PREVIEW</span>
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
    <p style="color:#9ab0a0;font-size:11px;margin:4px 0 0">This is a test preview email.</p>
  </div>
</div></body></html>`

  try {
    await sendEmail({ to: to.trim(), subject: `[TEST] ${subject}`, html })
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
