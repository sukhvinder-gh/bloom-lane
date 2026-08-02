import { Resend } from 'resend'

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Australia/Sydney',
  })
}

export interface OrderConfirmationData {
  order_number: string
  created_at: string
  buyer_email: string
  buyer_name: string
  fulfillment_type: string | null
  delivery_address: string | null
  delivery_suburb: string | null
  delivery_state: string | null
  subtotal_cents: number
  gst_cents: number
  delivery_fee_cents: number
  total_cents: number
  items: Array<{
    product_name: string
    product_unit: string
    quantity: number
    subtotal_cents: number
    is_gst_free: boolean
  }>
}

export async function sendOrderConfirmationEmail(data: OrderConfirmationData): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bloom-lane-app.azurewebsites.net'

  const itemRows = data.items.map(item => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e8f0e8;color:#1a3a2a;font-weight:600">${item.product_name}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e8f0e8;text-align:right;color:#1a3a2a">${item.quantity} ${item.product_unit}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e8f0e8;text-align:right;color:#1a3a2a;font-weight:700">${fmt(item.subtotal_cents)}</td>
    </tr>
  `).join('')

  const fulfillmentText = data.fulfillment_type === 'hub_pickup'
    ? 'Hub Pickup'
    : data.delivery_suburb
      ? `Delivery to ${data.delivery_suburb}${data.delivery_state ? ', ' + data.delivery_state : ''}`
      : 'Delivery'

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:600px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

    <!-- Header — table layout, not flex: email clients (Gmail webmail
         included) strip display:flex, collapsing this into run-together
         unreadable text instead of a two-column header. -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1a3a2a">
      <tr>
        <td style="padding:32px 40px" valign="top" align="left">
          <div style="color:white;font-size:20px;font-weight:800;letter-spacing:-0.5px;text-transform:uppercase">THE GREEN GUILD</div>
          <div style="color:#a8c8a8;font-size:12px;margin-top:4px">Order Confirmation</div>
        </td>
        <td style="padding:32px 40px" valign="top" align="right">
          <div style="color:white;font-size:14px;font-weight:700">${data.order_number}</div>
          <div style="color:#a8c8a8;font-size:12px;margin-top:4px">${fmtDate(data.created_at)}</div>
        </td>
      </tr>
    </table>

    <div style="padding:32px 40px">

      <!-- Greeting -->
      <p style="color:#1a3a2a;font-size:16px;margin:0 0 8px">Hi ${data.buyer_name},</p>
      <p style="color:#4a7a5a;font-size:14px;margin:0 0 28px;line-height:1.6">
        Your order has been confirmed and payment received. Your growers are now preparing your items.
      </p>

      <!-- Order info -->
      <div style="background:#f5f9f5;border-radius:10px;padding:16px 20px;margin-bottom:24px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="33%" valign="top">
              <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#4a7a5a;font-weight:700;margin-bottom:4px">Order</div>
              <div style="color:#1a3a2a;font-size:14px;font-weight:600">${data.order_number}</div>
            </td>
            <td width="33%" valign="top">
              <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#4a7a5a;font-weight:700;margin-bottom:4px">Date</div>
              <div style="color:#1a3a2a;font-size:14px;font-weight:600">${fmtDate(data.created_at)}</div>
            </td>
            <td valign="top">
              <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#4a7a5a;font-weight:700;margin-bottom:4px">Fulfillment</div>
              <div style="color:#1a3a2a;font-size:14px;font-weight:600">${fulfillmentText}</div>
            </td>
          </tr>
        </table>
      </div>

      <!-- Items -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <thead>
          <tr style="border-bottom:2px solid #1a3a2a">
            <th style="padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#1a3a2a">Product</th>
            <th style="padding:8px 12px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#1a3a2a">Qty</th>
            <th style="padding:8px 12px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#1a3a2a">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>

      <!-- Order totals -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
        <tr>
          <td>
            <table role="presentation" cellpadding="0" cellspacing="0" align="right" style="width:240px">
              <tr style="border-bottom:1px solid #e8f0e8">
                <td style="padding:8px 0;color:#4a7a5a;font-size:13px">Subtotal</td>
                <td style="padding:8px 0;text-align:right;color:#1a3a2a;font-weight:700;font-size:13px">${fmt(data.subtotal_cents)}</td>
              </tr>
              ${data.gst_cents > 0 ? `
              <tr style="border-bottom:1px solid #e8f0e8">
                <td style="padding:8px 0;color:#4a7a5a;font-size:13px">GST (10%)</td>
                <td style="padding:8px 0;text-align:right;color:#1a3a2a;font-size:13px">${fmt(data.gst_cents)}</td>
              </tr>` : ''}
              <tr style="border-bottom:1px solid #e8f0e8">
                <td style="padding:8px 0;color:#4a7a5a;font-size:13px">${data.fulfillment_type === 'hub_pickup' ? 'Hub pickup' : 'Delivery'}</td>
                <td style="padding:8px 0;text-align:right;color:#1a3a2a;font-size:13px">${data.delivery_fee_cents === 0 ? 'Free' : fmt(data.delivery_fee_cents)}</td>
              </tr>
              <tr>
                <td style="padding:10px 0 0;color:#1a3a2a;font-weight:700;font-size:14px">Total (inc-GST)</td>
                <td style="padding:10px 0 0;text-align:right;color:#1a3a2a;font-weight:800;font-size:18px">${fmt(data.total_cents)}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:28px">
        <a href="${siteUrl}/dashboard/buyer/orders"
           style="background:#1a3a2a;color:white;padding:14px 32px;border-radius:99px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block">
          Track Your Order →
        </a>
      </div>

      <p style="color:#9ab0a0;font-size:11px;text-align:center;margin:0">
        Questions? Contact your marketplace admin. Do not reply to this email — it is system-generated.
      </p>
    </div>

    <div style="background:#f5f9f5;padding:20px 40px;text-align:center">
      <p style="color:#4a7a5a;font-size:11px;margin:0">The Green Guild · ${data.order_number}</p>
    </div>
  </div>
</body>
</html>`

  await resend.emails.send({
    // Resend's onboarding@resend.dev sandbox address only ever delivers to
    // the Resend account's own email — real recipients need EMAIL_FROM set
    // to a verified sending domain.
    from: `The Green Guild <${process.env.EMAIL_FROM || 'onboarding@resend.dev'}>`,
    to: data.buyer_email,
    subject: `Order confirmed – ${data.order_number}`,
    html,
  })
}
