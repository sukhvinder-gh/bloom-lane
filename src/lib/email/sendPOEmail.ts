import { Resend } from 'resend'
import { renderToBuffer } from '@react-pdf/renderer'
import { PODocument, type POData } from '@/lib/pdf/PODocument'

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function fmtDate(iso: string | null, fallback = 'TBC') {
  if (!iso) return fallback
  return new Date(iso).toLocaleDateString('en-AU', {
    day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Australia/Sydney',
  })
}

export async function sendPOEmail(farmerEmail: string, po: POData): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const gross = po.items.reduce((s, i) => s + i.subtotal_cents, 0)
  const commission = Math.round(gross * po.commission_rate)
  const net = gross - commission
  const commissionPct = Math.round(po.commission_rate * 100)

  // Generate PDF buffer server-side (call as function to get the Document element directly)
  const pdfBuffer = await renderToBuffer(PODocument({ po }))

  const itemRows = po.items.map(item => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e8f0e8;color:#1a3a2a;font-weight:600">${item.product_name}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e8f0e8;text-align:right;color:#1a3a2a">${item.quantity}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e8f0e8;text-align:right;color:#4a7a5a;font-size:12px">${item.product_unit}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e8f0e8;text-align:right;color:#1a3a2a">${fmt(item.unit_price_cents)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e8f0e8;text-align:right;color:#4a7a5a;font-size:12px">${item.gst_applied ? fmt(item.gst_cents || 0) : '—'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e8f0e8;text-align:right;color:#1a3a2a;font-weight:700">${fmt(item.subtotal_cents)}</td>
    </tr>
  `).join('')

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:600px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

    <!-- Header -->
    <div style="background:#1a3a2a;padding:32px 40px;display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="color:white;font-size:20px;font-weight:800;letter-spacing:-0.5px;text-transform:uppercase">THE GREEN GUILD</div>
        <div style="color:#a8c8a8;font-size:12px;margin-top:4px">${po.farmer_gst_registered ? 'GST registered' : 'Not registered for GST'}</div>
      </div>
      <div style="text-align:right">
        <div style="color:white;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px">PURCHASE ORDER</div>
        <div style="color:#a8c8a8;font-size:12px;margin-top:4px">PO for ${po.order_number}</div>
      </div>
    </div>

    <div style="padding:32px 40px">

      <!-- Greeting -->
      <p style="color:#1a3a2a;font-size:16px;margin:0 0 8px">Hi ${po.farmer_business_name},</p>
      <p style="color:#4a7a5a;font-size:14px;margin:0 0 28px;line-height:1.6">
        A new order has been placed and your purchase order is ready. Please review the details below and fulfil by the date listed.
        The full PDF is attached for your records.
      </p>

      <!-- Buyer -->
      <div style="background:#f5f9f5;border-radius:10px;padding:16px 20px;margin-bottom:16px">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#4a7a5a;font-weight:700;margin-bottom:4px">From (Buyer)</div>
        <div style="color:#1a3a2a;font-size:14px;font-weight:600">${po.buyer_business_name || po.buyer_full_name || 'Buyer'}</div>
        ${po.buyer_business_name && po.buyer_full_name ? `<div style="color:#4a7a5a;font-size:12px;margin-top:2px">${po.buyer_full_name}</div>` : ''}
      </div>

      <!-- Dates -->
      <div style="background:#f5f9f5;border-radius:10px;padding:16px 20px;margin-bottom:24px">
        <div style="display:flex;gap:32px;flex-wrap:wrap">
          <div>
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#4a7a5a;font-weight:700;margin-bottom:4px">Order Placed</div>
            <div style="color:#1a3a2a;font-size:14px;font-weight:600">${fmtDate(po.created_at)}</div>
          </div>
          <div>
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#4a7a5a;font-weight:700;margin-bottom:4px">Fulfil By</div>
            <div style="color:#1a3a2a;font-size:14px;font-weight:600">${fmtDate(po.grower_fulfillment_date)}</div>
          </div>
          <div>
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#4a7a5a;font-weight:700;margin-bottom:4px">Delivery Method</div>
            <div style="color:#1a3a2a;font-size:14px;font-weight:600">
              ${po.fulfillment_type === 'hub_pickup'
                ? po.hub_address ? `Hub drop-off — ${po.hub_address}` : 'Hub drop-off (admin to confirm)'
                : 'Direct delivery to florist'}
            </div>
          </div>
        </div>
      </div>

      <!-- Line items table -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
        <thead>
          <tr style="border-bottom:2px solid #1a3a2a">
            <th style="padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#1a3a2a">Product</th>
            <th style="padding:8px 12px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#1a3a2a">Qty</th>
            <th style="padding:8px 12px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#1a3a2a">Unit</th>
            <th style="padding:8px 12px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#1a3a2a">Unit Price</th>
            <th style="padding:8px 12px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#1a3a2a">GST</th>
            <th style="padding:8px 12px;text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#1a3a2a">Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>

      <!-- Commission summary -->
      <div style="display:flex;justify-content:flex-end;margin-bottom:28px">
        <div style="width:240px">
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e8f0e8">
            <span style="color:#4a7a5a;font-size:13px">Gross value</span>
            <span style="color:#1a3a2a;font-weight:700;font-size:13px">${fmt(gross)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e8f0e8">
            <span style="color:#4a7a5a;font-size:13px">Platform commission (${commissionPct}%)</span>
            <span style="color:#b91c1c;font-size:13px">− ${fmt(commission)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:10px 0 0">
            <span style="color:#1a3a2a;font-weight:700;font-size:14px">Net payable to you</span>
            <span style="color:#1a3a2a;font-weight:800;font-size:18px">${fmt(net)}</span>
          </div>
        </div>
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:28px">
        <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://bloom-lane-app.azurewebsites.net'}/dashboard/farmer/orders"
           style="background:#1a3a2a;color:white;padding:14px 32px;border-radius:99px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block">
          View in Dashboard →
        </a>
      </div>

      <p style="color:#9ab0a0;font-size:11px;text-align:center;margin:0">
        The full PO is attached as a PDF. If you have questions, contact your admin.
        Do not reply to this email — it is system-generated.
      </p>
    </div>

    <div style="background:#f5f9f5;padding:20px 40px;text-align:center">
      <p style="color:#4a7a5a;font-size:11px;margin:0">
        This purchase order is between ${po.buyer_business_name || po.buyer_full_name || 'the buyer'} and ${po.farmer_business_name}. The Green Guild facilitates this transaction but is not a party to it. PO #${po.order_number}
      </p>
    </div>
  </div>
</body>
</html>`

  await resend.emails.send({
    from: 'The Green Guild <onboarding@resend.dev>',
    to: farmerEmail,
    subject: `Purchase Order #${po.order_number} – Please fulfil by ${fmtDate(po.grower_fulfillment_date, 'TBC')}`,
    html,
    attachments: [
      {
        filename: `PO-${po.order_number}-${po.farmer_business_name.replace(/\s+/g, '-')}.pdf`,
        content: pdfBuffer.toString('base64'),
      },
    ],
  })
}
