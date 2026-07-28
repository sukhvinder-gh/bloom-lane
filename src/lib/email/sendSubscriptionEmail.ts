import { Resend } from 'resend'

function fmt(cents: number) { return `$${(cents / 100).toFixed(2)}` }

const FROM = 'The Green Guild <onboarding@resend.dev>'
const SITE  = process.env.NEXT_PUBLIC_SITE_URL || 'https://bloom-lane-app.azurewebsites.net'

function baseLayout(content: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:system-ui,-apple-system,sans-serif">
<div style="max-width:600px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
  <div style="background:#1a3a2a;padding:28px 40px">
    <div style="color:white;font-size:18px;font-weight:800;letter-spacing:-0.5px;text-transform:uppercase">THE GREEN GUILD</div>
  </div>
  <div style="padding:32px 40px">${content}</div>
  <div style="background:#f5f9f5;padding:16px 40px;text-align:center">
    <p style="color:#4a7a5a;font-size:11px;margin:0">The Green Guild — thegreenguild.com.au</p>
  </div>
</div></body></html>`
}

// ── Subscription confirmation ────────────────────────────────────────────────
export async function sendSubscriptionConfirmation(data: {
  to: string; name: string; plan: string; billing: string; amount_cents: number; gst_registered?: boolean
}) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const planLabel = data.plan === 'hub_membership' ? 'Hub Membership'
    : data.plan === 'wholesale_collection' ? 'Free Grower Listing'
    : data.plan === 'mailing_list' ? 'Florist Mailing List'
    : data.plan === 'personal_shopper' ? 'Personal Shopper & Delivery'
    : data.plan === 'coordinator' ? 'Hub Coordinator'
    : data.plan

  const html = baseLayout(`
    <p style="color:#1a3a2a;font-size:16px;margin:0 0 8px">Hi ${data.name},</p>
    <p style="color:#4a7a5a;font-size:14px;margin:0 0 24px;line-height:1.6">Your subscription to The Green Guild is confirmed.</p>
    <div style="background:#f5f9f5;border-radius:10px;padding:20px 24px;margin-bottom:24px">
      <div style="margin-bottom:10px"><span style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#4a7a5a;font-weight:700">Plan</span><br><span style="color:#1a3a2a;font-size:15px;font-weight:700">${planLabel}</span></div>
      <div style="margin-bottom:10px"><span style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#4a7a5a;font-weight:700">Billing</span><br><span style="color:#1a3a2a;font-size:14px">${data.billing === 'free' ? 'Free' : data.billing.charAt(0).toUpperCase() + data.billing.slice(1)}</span></div>
      <div><span style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#4a7a5a;font-weight:700">Amount</span><br><span style="color:#1a3a2a;font-size:14px;font-weight:700">${data.amount_cents === 0 ? 'Free' : fmt(data.amount_cents)}</span></div>
    </div>
    ${data.gst_registered ? '<p style="color:#4a7a5a;font-size:13px;margin:0 0 16px">As a GST-registered grower, The Green Guild will issue RCTIs on your behalf for all sales through the platform.</p>' : ''}
    <div style="text-align:center;margin:24px 0">
      <a href="${SITE}/dashboard" style="background:#1a3a2a;color:white;padding:14px 32px;border-radius:99px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block">Go to Dashboard →</a>
    </div>
  `)

  await resend.emails.send({ from: FROM, to: data.to, subject: `Subscription confirmed — ${planLabel}`, html })
}

// ── Subscription expiry warning ──────────────────────────────────────────────
export async function sendSubscriptionExpiryWarning(data: {
  to: string; name: string; plan: string; expires_at: string
}) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const planLabel = data.plan === 'hub_membership' ? 'Hub Membership' : data.plan
  const expDate = new Date(data.expires_at).toLocaleDateString('en-AU', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Australia/Sydney' })

  const html = baseLayout(`
    <p style="color:#1a3a2a;font-size:16px;margin:0 0 8px">Hi ${data.name},</p>
    <p style="color:#4a7a5a;font-size:14px;margin:0 0 24px;line-height:1.6">
      Your <strong>${planLabel}</strong> subscription expires on <strong>${expDate}</strong>.
      Renew now to keep your listings active and continue trading through The Green Guild.
    </p>
    <div style="background:#FEF3C7;border-radius:10px;padding:16px 20px;margin-bottom:24px">
      <p style="color:#92400E;font-size:13px;margin:0;font-weight:600">⚠ If your subscription lapses, your product listings will be automatically hidden from buyers.</p>
    </div>
    <div style="text-align:center;margin:24px 0">
      <a href="${SITE}/dashboard/farmer/membership" style="background:#1a3a2a;color:white;padding:14px 32px;border-radius:99px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block">Renew Membership →</a>
    </div>
  `)

  await resend.emails.send({ from: FROM, to: data.to, subject: `Action required — your subscription expires ${expDate}`, html })
}

// ── Weekly availability digest (florist mailing list) ───────────────────────
export async function sendWeeklyAvailabilityDigest(data: {
  to: string; name: string;
  products: Array<{ name: string; farmer: string; unit: string; b2b_price: number; category: string }>
}) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const rows = data.products.slice(0, 20).map(p => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e8f0e8;color:#1a3a2a;font-weight:600">${p.name}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e8f0e8;color:#4a7a5a">${p.farmer}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e8f0e8;color:#1a3a2a;text-align:right">${fmt(p.b2b_price)}/${p.unit}</td>
    </tr>`).join('')

  const html = baseLayout(`
    <p style="color:#1a3a2a;font-size:16px;margin:0 0 8px">Hi ${data.name},</p>
    <p style="color:#4a7a5a;font-size:14px;margin:0 0 24px;line-height:1.6">
      Here's what your local growers have available this week. Order by Wednesday to collect at the Hub on Thursday 9am–12pm.
    </p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <thead><tr style="border-bottom:2px solid #1a3a2a">
        <th style="padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#1a3a2a">Product</th>
        <th style="padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#1a3a2a">Grower</th>
        <th style="padding:8px 12px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#1a3a2a">Price</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${data.products.length > 20 ? `<p style="color:#4a7a5a;font-size:13px;margin:0 0 20px">+ ${data.products.length - 20} more products on the marketplace.</p>` : ''}
    <div style="text-align:center;margin:24px 0">
      <a href="${SITE}/marketplace" style="background:#1a3a2a;color:white;padding:14px 32px;border-radius:99px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block">View Full Marketplace →</a>
    </div>
    <p style="color:#9ab0a0;font-size:11px;text-align:center;margin:0">You're receiving this as a Green Guild Florist Mailing List subscriber. <a href="${SITE}/dashboard/buyer/membership" style="color:#4a7a5a">Manage membership</a></p>
  `)

  await resend.emails.send({ from: FROM, to: data.to, subject: `This week's availability — The Green Guild 🌸`, html })
}

// ── Market open notification (all buyers) ───────────────────────────────────
export async function sendMarketOpenNotification(data: {
  to: string; name: string; productCount: number
}) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const html = baseLayout(`
    <p style="color:#1a3a2a;font-size:16px;margin:0 0 8px">Hi ${data.name},</p>
    <p style="color:#4a7a5a;font-size:14px;margin:0 0 24px;line-height:1.6">
      The Green Guild market is now open. <strong>${data.productCount} product${data.productCount !== 1 ? 's' : ''}</strong> from local growers are available this week.
      Orders close tonight at 8pm AEST.
    </p>
    <div style="background:#f5f9f5;border-radius:10px;padding:18px 24px;margin-bottom:24px;text-align:center">
      <p style="color:#1a3a2a;font-size:13px;margin:0 0 4px;font-weight:700">Wednesday Market Window</p>
      <p style="color:#4a7a5a;font-size:12px;margin:0">8:00am – 8:00pm AEST</p>
    </div>
    <div style="text-align:center;margin:24px 0">
      <a href="${SITE}/marketplace" style="background:#1a3a2a;color:white;padding:14px 32px;border-radius:99px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block">Browse This Week's Products →</a>
    </div>
    <p style="color:#9ab0a0;font-size:11px;text-align:center;margin:0">You're receiving this as a registered Green Guild buyer.</p>
  `)
  await resend.emails.send({ from: FROM, to: data.to, subject: `The market is open — shop this week's fresh produce 🌿`, html })
}

// ── PO notification to grower ────────────────────────────────────────────────
export async function sendPONotification(data: {
  to: string; grower_name: string; order_number: string; order_id: string;
  items: Array<{ product_name: string; quantity: number; unit: string; subtotal_cents: number }>
}) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const rows = data.items.map(i => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e8f0e8;color:#1a3a2a;font-weight:600">${i.product_name}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e8f0e8;color:#1a3a2a;text-align:right">${i.quantity} ${i.unit}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e8f0e8;color:#1a3a2a;text-align:right;font-weight:700">${fmt(i.subtotal_cents)}</td>
    </tr>`).join('')

  const html = baseLayout(`
    <p style="color:#1a3a2a;font-size:16px;margin:0 0 8px">Hi ${data.grower_name},</p>
    <p style="color:#4a7a5a;font-size:14px;margin:0 0 24px;line-height:1.6">
      You have a new purchase order for <strong>${data.order_number}</strong>. Please review and update the status in your dashboard.
    </p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <thead><tr style="border-bottom:2px solid #1a3a2a">
        <th style="padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#1a3a2a">Product</th>
        <th style="padding:8px 12px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#1a3a2a">Qty</th>
        <th style="padding:8px 12px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#1a3a2a">Total</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="text-align:center;margin:24px 0">
      <a href="${SITE}/dashboard/farmer/orders/${data.order_id}/po" style="background:#1a3a2a;color:white;padding:14px 32px;border-radius:99px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block">View Purchase Order →</a>
    </div>
  `)

  await resend.emails.send({ from: FROM, to: data.to, subject: `New purchase order — ${data.order_number}`, html })
}
