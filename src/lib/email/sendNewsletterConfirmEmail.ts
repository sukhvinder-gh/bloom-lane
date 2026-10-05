import { sendEmail } from './mailer'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://bloom-lane-app.azurewebsites.net'

// Double opt-in: a subscriber lands as 'pending' until they click this link
// (see /api/newsletter/subscribe and /api/newsletter/confirm) — proves they
// actually own the address instead of just typing any email in.
export async function sendNewsletterConfirmEmail(to: string, token: string) {
  const confirmUrl = `${SITE}/api/newsletter/confirm?token=${encodeURIComponent(token)}`

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:system-ui,-apple-system,sans-serif">
<div style="max-width:600px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <div style="background:#1a3a2a;padding:28px 40px">
    <div style="color:white;font-size:18px;font-weight:800;letter-spacing:-0.5px;text-transform:uppercase">THE GREEN GUILD</div>
  </div>
  <div style="padding:32px 40px">
    <p style="color:#1a3a2a;font-size:16px;margin:0 0 8px">One last step</p>
    <p style="color:#4a7a5a;font-size:14px;margin:0 0 24px;line-height:1.6">Confirm this email address to start getting weekly market updates — fresh availability, seasonal highlights, and grower stories.</p>
    <div style="text-align:center;margin-bottom:24px">
      <a href="${confirmUrl}" style="background:#1a3a2a;color:white;padding:14px 32px;border-radius:99px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block">Confirm subscription →</a>
    </div>
    <p style="color:#9ab0a0;font-size:11px;margin:0;line-height:1.6">If you didn't request this, you can ignore this email — you won't be subscribed unless you click the button above.</p>
  </div>
  <div style="background:#f5f9f5;padding:16px 40px;text-align:center">
    <p style="color:#4a7a5a;font-size:11px;margin:0">The Green Guild — thegreenguild.com.au</p>
  </div>
</div></body></html>`

  await sendEmail({ to, subject: 'Confirm your subscription to The Green Guild', html })
}
