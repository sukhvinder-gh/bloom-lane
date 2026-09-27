import { sendEmail } from './mailer'

function fmt(cents: number) { return `$${(cents / 100).toFixed(2)}` }

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://bloom-lane-app.azurewebsites.net'

// Sent the moment a grower's first (or next) sale is ready to pay out but
// they haven't connected Stripe yet — the nudge to set up their payout
// account happens right when there's actually money waiting, not as a
// generic onboarding step nobody gets around to.
export async function sendPayoutReadyEmail(data: { to: string; name: string; netAmountCents: number }) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:system-ui,-apple-system,sans-serif">
<div style="max-width:600px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <div style="background:#1a3a2a;padding:28px 40px">
    <div style="color:white;font-size:18px;font-weight:800;letter-spacing:-0.5px;text-transform:uppercase">THE GREEN GUILD</div>
  </div>
  <div style="padding:32px 40px">
    <p style="color:#1a3a2a;font-size:16px;margin:0 0 8px">Hi ${data.name},</p>
    <p style="color:#4a7a5a;font-size:14px;margin:0 0 24px;line-height:1.6">Your order has been delivered and <strong>${fmt(data.netAmountCents)}</strong> is ready to be paid out to you — you just need to connect a bank account first.</p>
    <div style="text-align:center;margin-bottom:24px">
      <a href="${SITE}/dashboard/farmer/payouts" style="background:#1a3a2a;color:white;padding:14px 32px;border-radius:99px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block">Connect your bank account →</a>
    </div>
    <p style="color:#4a7a5a;font-size:12px;margin:0;line-height:1.6">Takes about 5 minutes via Stripe. Once connected, this payout — and any others waiting — is sent automatically.</p>
  </div>
  <div style="background:#f5f9f5;padding:16px 40px;text-align:center">
    <p style="color:#4a7a5a;font-size:11px;margin:0">The Green Guild — thegreenguild.com.au</p>
  </div>
</div></body></html>`

  await sendEmail({ to: data.to, subject: `${fmt(data.netAmountCents)} is waiting for you — connect your bank account`, html })
}
