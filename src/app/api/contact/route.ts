import { NextRequest, NextResponse } from 'next/server'
import { sendEmail, getAdminInbox } from '@/lib/email/mailer'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TOPICS = new Set([
  'General question',
  'Buying on The Green Guild',
  'Selling as a grower',
  'Setting up a hub or collective',
  'A problem with an order',
  'Something else',
])

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Per-IP limit so the form can't be used to flood the inbox. In-memory, so it
// resets on restart and isn't shared between instances — good enough to stop
// casual abuse, not a substitute for a real rate limiter.
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

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
  if (tooMany(ip)) {
    return NextResponse.json({ error: 'Too many messages from this connection. Please try again later.' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  // Honeypot filled in: pretend it worked so bots don't retry.
  if (body.website) return NextResponse.json({ ok: true })

  const name = String(body.name ?? '').trim().slice(0, 120)
  const email = String(body.email ?? '').trim().slice(0, 200)
  const message = String(body.message ?? '').trim().slice(0, 4000)
  const topic = TOPICS.has(body.topic) ? String(body.topic) : 'General question'
  const order = String(body.order ?? '').trim().slice(0, 40)

  if (!name || !EMAIL_RE.test(email)) return NextResponse.json({ error: 'Please enter your name and a valid email address.' }, { status: 400 })
  if (message.length < 10) return NextResponse.json({ error: 'Please write a little more so we can help.' }, { status: 400 })

  const inbox = getAdminInbox()
  if (!inbox) {
    console.error('[CONTACT] No CONTACT_EMAIL / GMAIL_USER / EMAIL_FROM configured — message not delivered')
    return NextResponse.json({ error: 'Messages can’t be delivered right now. Please try again later.' }, { status: 500 })
  }

  try {
    await sendEmail({
      to: inbox,
      replyTo: email,
      subject: `[Contact] ${topic} — ${name}`,
      html: `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#1a3a2a">
<p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;<br>
<strong>Topic:</strong> ${escapeHtml(topic)}${order ? `<br><strong>Order:</strong> ${escapeHtml(order)}` : ''}</p>
<hr style="border:none;border-top:1px solid #e8f0e8">
<div style="white-space:pre-wrap;line-height:1.6">${escapeHtml(message)}</div>
</div>`,
    })
  } catch (err) {
    console.error('[CONTACT] send failed:', err)
    return NextResponse.json({ error: 'We couldn’t send your message. Please try again shortly.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
