import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendEmail, getAdminInbox } from '@/lib/email/mailer'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Same lightweight per-IP limiter as /api/contact — good enough to stop
// casual abuse of a public, unauthenticated form, not a real rate limiter.
const WINDOW_MS = 60 * 60 * 1000
const MAX_PER_WINDOW = 5
const hits = new Map<string, number[]>()
function tooMany(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)
  return recent.length > MAX_PER_WINDOW
}

// POST — capture interest from the /register-interest/grower and
// /register-interest/buyer pages while real registration for those two
// roles is paused. No account is created; this just logs the lead and
// emails the admin inbox, same pattern as /api/contact.
export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  if (tooMany(ip)) {
    return NextResponse.json({ error: 'Too many submissions from this connection. Please try again later.' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  if (body.website) return NextResponse.json({ ok: true }) // honeypot

  const role = body.role === 'grower' || body.role === 'buyer' ? body.role : null
  const full_name = String(body.full_name ?? '').trim().slice(0, 120)
  const email = String(body.email ?? '').trim().slice(0, 200)
  const phone = String(body.phone ?? '').trim().slice(0, 40) || null
  const business_name = String(body.business_name ?? '').trim().slice(0, 200) || null
  const region = String(body.region ?? '').trim().slice(0, 200) || null
  const notes = String(body.notes ?? '').trim().slice(0, 2000) || null

  if (!role) return NextResponse.json({ error: 'Missing role' }, { status: 400 })
  if (!full_name || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'Please enter your name and a valid email address.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('interest_registrations').insert({
    role, full_name, email, phone, business_name, region, notes,
  })
  if (error) {
    console.error('[INTEREST] insert failed:', error)
    return NextResponse.json({ error: 'Could not save your details. Please try again shortly.' }, { status: 500 })
  }

  const inbox = getAdminInbox()
  if (inbox) {
    const appUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bloom-lane-app.azurewebsites.net'
    const roleLabel = role === 'grower' ? 'Grower' : 'Buyer'

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:600px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1a3a2a">
      <tr>
        <td style="padding:32px 40px" valign="top" align="left">
          <div style="color:white;font-size:20px;font-weight:800;letter-spacing:-0.5px;text-transform:uppercase">THE GREEN GUILD</div>
          <div style="color:#a8c8a8;font-size:12px;margin-top:4px">Register-interest submission</div>
        </td>
        <td style="padding:32px 40px" valign="top" align="right">
          <div style="color:white;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px">NEW INTEREST</div>
          <div style="color:#a8c8a8;font-size:12px;margin-top:4px">${roleLabel}</div>
        </td>
      </tr>
    </table>

    <div style="padding:32px 40px">

      <p style="color:#1a3a2a;font-size:16px;margin:0 0 8px">Hi there,</p>
      <p style="color:#4a7a5a;font-size:14px;margin:0 0 28px;line-height:1.6">
        Someone has registered interest as a ${roleLabel.toLowerCase()} while public sign-up is paused. Their details are below.
      </p>

      <div style="background:#f5f9f5;border-radius:10px;padding:16px 20px;margin-bottom:16px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>${[
            `<td width="50%" valign="top"><div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#4a7a5a;font-weight:700;margin-bottom:4px">Name</div><div style="color:#1a3a2a;font-size:14px;font-weight:600">${escapeHtml(full_name)}</div></td>`,
            `<td width="50%" valign="top"><div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#4a7a5a;font-weight:700;margin-bottom:4px">Role</div><div style="color:#1a3a2a;font-size:14px;font-weight:600">${roleLabel}</div></td>`,
          ].join('')}</tr>
        </table>
      </div>

      <div style="background:#f5f9f5;border-radius:10px;padding:16px 20px;margin-bottom:16px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>${[
            `<td width="50%" valign="top"><div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#4a7a5a;font-weight:700;margin-bottom:4px">Email</div><div style="color:#1a3a2a;font-size:14px;font-weight:600"><a href="mailto:${encodeURIComponent(email)}" style="color:#1a3a2a;text-decoration:underline">${escapeHtml(email)}</a></div></td>`,
            `<td width="50%" valign="top"><div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#4a7a5a;font-weight:700;margin-bottom:4px">Phone</div><div style="color:#1a3a2a;font-size:14px;font-weight:600">${phone ? `<a href="tel:${encodeURIComponent(phone)}" style="color:#1a3a2a;text-decoration:underline">${escapeHtml(phone)}</a>` : '—'}</div></td>`,
          ].join('')}</tr>
        </table>
      </div>

      <div style="background:#f5f9f5;border-radius:10px;padding:16px 20px;margin-bottom:24px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>${[
            `<td width="50%" valign="top"><div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#4a7a5a;font-weight:700;margin-bottom:4px">Business</div><div style="color:#1a3a2a;font-size:14px;font-weight:600">${business_name ? escapeHtml(business_name) : '—'}</div></td>`,
            `<td width="50%" valign="top"><div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#4a7a5a;font-weight:700;margin-bottom:4px">Region</div><div style="color:#1a3a2a;font-size:14px;font-weight:600">${region ? escapeHtml(region) : '—'}</div></td>`,
          ].join('')}</tr>
        </table>
      </div>

      ${notes ? `
      <div style="background:#f5f9f5;border-radius:10px;padding:16px 20px;margin-bottom:24px">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#4a7a5a;font-weight:700;margin-bottom:8px">Notes</div>
        <div style="color:#1a3a2a;font-size:13px;line-height:1.6;white-space:pre-wrap">${escapeHtml(notes)}</div>
      </div>` : ''}

      <div style="text-align:center;margin-bottom:28px">
        <a href="${appUrl}/dashboard/admin/interest"
           style="background:#1a3a2a;color:white;padding:14px 32px;border-radius:99px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block">
          View in Admin →
        </a>
      </div>

      <p style="color:#9ab0a0;font-size:11px;text-align:center;margin:0">
        Reply to this email to respond directly to ${escapeHtml(full_name)}.
      </p>
    </div>

    <div style="background:#f5f9f5;padding:20px 40px;text-align:center">
      <p style="color:#4a7a5a;font-size:11px;margin:0">
        This is an automated notification from The Green Guild register-interest form.
      </p>
    </div>
  </div>
</body>
</html>`

    sendEmail({
      to: inbox,
      replyTo: email,
      subject: `New ${role} interest: ${full_name}`,
      html,
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
