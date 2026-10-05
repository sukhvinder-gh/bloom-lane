// src/app/api/newsletter/confirm/route.ts
//
// Clicked from the confirmation email (see sendNewsletterConfirmEmail) —
// a plain browser navigation, so this responds with a small branded HTML
// page directly rather than JSON or a redirect into the app.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

function page(title: string, message: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — The Green Guild</title></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:system-ui,-apple-system,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center">
<div style="max-width:420px;margin:20px;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);text-align:center">
  <div style="background:#1a3a2a;padding:24px"><div style="color:white;font-size:16px;font-weight:800;letter-spacing:-0.5px;text-transform:uppercase">THE GREEN GUILD</div></div>
  <div style="padding:40px 32px">
    <p style="color:#1a3a2a;font-size:18px;font-weight:700;margin:0 0 12px">${title}</p>
    <p style="color:#4a7a5a;font-size:14px;line-height:1.6;margin:0 0 24px">${message}</p>
    <a href="/" style="background:#1a3a2a;color:white;padding:12px 28px;border-radius:99px;text-decoration:none;font-weight:700;font-size:13px;display:inline-block">Back to The Green Guild</a>
  </div>
</div></body></html>`
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')
  if (!token) {
    return new NextResponse(page('Invalid link', 'This confirmation link is missing its token. Please use the link from your email, or subscribe again.'), {
      status: 400, headers: { 'Content-Type': 'text/html' },
    })
  }

  const admin = createAdminClient()
  const { data: subscriber } = await admin
    .from('newsletter_subscribers')
    .select('id, status')
    .eq('confirm_token', token)
    .maybeSingle()

  if (!subscriber) {
    return new NextResponse(page('Link expired', 'This confirmation link is no longer valid — it may have already been used. Please subscribe again from the homepage.'), {
      status: 400, headers: { 'Content-Type': 'text/html' },
    })
  }

  if (subscriber.status !== 'active') {
    await admin
      .from('newsletter_subscribers')
      .update({ status: 'active', confirmed_at: new Date().toISOString(), confirm_token: null })
      .eq('id', subscriber.id)
  }

  return new NextResponse(page("You're subscribed!", "Thanks for confirming — you'll get weekly market updates, seasonal highlights, and grower stories in your inbox."), {
    status: 200, headers: { 'Content-Type': 'text/html' },
  })
}
