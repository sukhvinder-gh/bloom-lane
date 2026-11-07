import { sendEmail } from './mailer'

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://bloom-lane-app.azurewebsites.net'

const ROLE_COPY: Record<'farmer' | 'buyer_b2b', { title: string; body: string }> = {
  farmer: {
    title: 'Your grower account is ready',
    body: "You're approved to sell on The Green Guild. Sign in below, then head to Farmer Dashboard → Membership to pick a selling option and start listing products.",
  },
  buyer_b2b: {
    title: 'Your business buyer account is ready',
    body: "You're approved to order on The Green Guild. Sign in below to browse this week's availability — our team will verify your ABN shortly if it isn't already.",
  },
}

// Sent once, right after an admin approves an interest-registration row
// (see /api/admin/interest/[id]/approve). The account is created with a
// random temporary password — this is the only time it's ever shown to the
// grower/buyer, so the email points them at "Forgot password" immediately
// rather than asking them to keep this password long-term.
export async function sendApprovalWelcomeEmail(opts: {
  to: string
  fullName: string
  role: 'farmer' | 'buyer_b2b'
  tempPassword: string
}) {
  const { to, fullName, role, tempPassword } = opts
  const copy = ROLE_COPY[role]
  const loginUrl = `${SITE}/auth/login`
  const resetUrl = `${SITE}/auth/forgot-password`

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:system-ui,-apple-system,sans-serif">
<div style="max-width:600px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <div style="background:#1a3a2a;padding:28px 40px">
    <div style="color:white;font-size:18px;font-weight:800;letter-spacing:-0.5px;text-transform:uppercase">THE GREEN GUILD</div>
  </div>
  <div style="padding:32px 40px">
    <p style="color:#1a3a2a;font-size:18px;font-weight:700;margin:0 0 8px">${copy.title}</p>
    <p style="color:#4a7a5a;font-size:14px;margin:0 0 24px;line-height:1.6">Hi ${fullName}, ${copy.body}</p>
    <div style="background:#f5f9f5;border-radius:12px;padding:20px 24px;margin:0 0 24px">
      <p style="color:#9ab0a0;font-size:11px;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.05em">Email</p>
      <p style="color:#1a3a2a;font-size:15px;margin:0 0 14px;font-weight:600">${to}</p>
      <p style="color:#9ab0a0;font-size:11px;margin:0 0 4px;text-transform:uppercase;letter-spacing:0.05em">Temporary password</p>
      <p style="color:#1a3a2a;font-size:15px;margin:0;font-weight:600;font-family:monospace">${tempPassword}</p>
    </div>
    <div style="text-align:center;margin-bottom:16px">
      <a href="${loginUrl}" style="background:#1a3a2a;color:white;padding:14px 32px;border-radius:99px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block">Sign in →</a>
    </div>
    <p style="color:#9ab0a0;font-size:12px;margin:0;line-height:1.6;text-align:center">
      For your security, set your own password right away via
      <a href="${resetUrl}" style="color:#4a7a5a">Forgot password</a> on the sign-in page.
    </p>
  </div>
  <div style="background:#f5f9f5;padding:16px 40px;text-align:center">
    <p style="color:#4a7a5a;font-size:11px;margin:0">The Green Guild — thegreenguild.com.au</p>
  </div>
</div></body></html>`

  await sendEmail({ to, subject: copy.title, html })
}
