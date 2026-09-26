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
    sendEmail({
      to: inbox,
      replyTo: email,
      subject: `New ${role} interest: ${full_name}`,
      html: `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#1a3a2a">
<p><strong>Role:</strong> ${escapeHtml(role)}<br>
<strong>Name:</strong> ${escapeHtml(full_name)}<br>
<strong>Email:</strong> ${escapeHtml(email)}${phone ? `<br><strong>Phone:</strong> ${escapeHtml(phone)}` : ''}${business_name ? `<br><strong>Business:</strong> ${escapeHtml(business_name)}` : ''}${region ? `<br><strong>Region:</strong> ${escapeHtml(region)}` : ''}</p>
${notes ? `<hr style="border:none;border-top:1px solid #e8f0e8"><div style="white-space:pre-wrap;line-height:1.6">${escapeHtml(notes)}</div>` : ''}
</div>`,
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}
