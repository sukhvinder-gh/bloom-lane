// src/lib/email/sendPORejectionEmails.ts
// When a grower rejects their PO, nobody was actually told — the route only
// flagged orders.has_partial_rejection, and the buyer's own order status
// page was the only place it ever surfaced. This notifies the buyer (their
// order needs attention) and every admin (manual resolution — refund,
// substitute grower, etc. — is needed) by email.

import { createAdminClient } from '@/lib/supabase/server'
import { formatAEST } from '@/lib/utils/timezone'
import { sendEmail } from './mailer'

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

export async function notifyPORejection(orderId: string, farmerId: string, reason: string): Promise<void> {
  const admin = createAdminClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bloom-lane-app.azurewebsites.net'

  const { data: order } = await admin
    .from('orders')
    .select('order_number, buyer_id, created_at')
    .eq('id', orderId)
    .single()
  if (!order) { console.error('[PO-REJECT-EMAIL] Order not found:', orderId); return }

  const { data: farmer } = await admin
    .from('farmers')
    .select('business_name')
    .eq('id', farmerId)
    .single()

  const { data: buyer } = await admin
    .from('profiles')
    .select('email, full_name, business_name')
    .eq('id', order.buyer_id)
    .single()

  const { data: items } = await admin
    .from('order_items')
    .select('quantity, subtotal_cents, products(name, unit)')
    .eq('order_id', orderId)
    .eq('farmer_id', farmerId)

  const farmerName = farmer?.business_name || 'A grower'
  const itemsList = (items || []).map((i: any) => `${i.quantity} × ${i.products?.name ?? 'item'}`).join(', ') || 'items in your order'
  const rejectedSubtotal = (items || []).reduce((s: number, i: any) => s + i.subtotal_cents, 0)

  // --- 1. Buyer notification ---
  if (buyer?.email) {
    try {
      await sendEmail({
        to: buyer.email,
        subject: `Update on your order ${order.order_number}`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:600px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#1a3a2a">
      <tr>
        <td style="padding:32px 40px" valign="top" align="left">
          <div style="color:white;font-size:20px;font-weight:800;letter-spacing:-0.5px;text-transform:uppercase">THE GREEN GUILD</div>
          <div style="color:#a8c8a8;font-size:12px;margin-top:4px">Order Update</div>
        </td>
        <td style="padding:32px 40px" valign="top" align="right">
          <div style="color:white;font-size:14px;font-weight:700">${order.order_number}</div>
        </td>
      </tr>
    </table>
    <div style="padding:32px 40px">
      <p style="color:#1a3a2a;font-size:16px;margin:0 0 8px">Hi ${buyer.full_name || 'there'},</p>
      <p style="color:#4a7a5a;font-size:14px;margin:0 0 20px;line-height:1.6">
        ${farmerName} is unable to fulfil part of your order (${itemsList}, ${fmt(rejectedSubtotal)}). We're sorry for the inconvenience — our team has been notified and will be in touch shortly to sort out a refund or replacement.
      </p>
      <div style="background:#f5f9f5;border-radius:10px;padding:16px 20px;margin-bottom:24px">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#4a7a5a;font-weight:700;margin-bottom:4px">Reason given by the grower</div>
        <div style="color:#1a3a2a;font-size:14px">${reason}</div>
      </div>
      <div style="text-align:center;margin-bottom:8px">
        <a href="${siteUrl}/dashboard/buyer/orders/${orderId}"
           style="background:#1a3a2a;color:white;padding:14px 32px;border-radius:99px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block">
          View Your Order →
        </a>
      </div>
      <p style="color:#9ab0a0;font-size:11px;text-align:center;margin:20px 0 0">
        Do not reply to this email — it is system-generated.
      </p>
    </div>
  </div>
</body>
</html>`,
      })
    } catch (err) {
      console.error('[PO-REJECT-EMAIL] Buyer email failed for order', order.order_number, err)
    }
  } else {
    console.warn('[PO-REJECT-EMAIL] No buyer email for order', order.order_number)
  }

  // --- 2. Admin notification ---
  const { data: admins } = await admin
    .from('profiles')
    .select('email')
    .in('role', ['admin', 'platform_admin', 'super_admin'])
  const adminEmails = (admins || []).map((a: any) => a.email).filter(Boolean)

  if (adminEmails.length > 0) {
    try {
      await sendEmail({
        to: adminEmails,
        subject: `PO rejected — Order ${order.order_number} needs resolution`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:600px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#b91c1c">
      <tr>
        <td style="padding:32px 40px" valign="top" align="left">
          <div style="color:white;font-size:20px;font-weight:800;letter-spacing:-0.5px;text-transform:uppercase">THE GREEN GUILD</div>
          <div style="color:#fecaca;font-size:12px;margin-top:4px">PO Rejected — Action Needed</div>
        </td>
        <td style="padding:32px 40px" valign="top" align="right">
          <div style="color:white;font-size:14px;font-weight:700">${order.order_number}</div>
          <div style="color:#fecaca;font-size:12px;margin-top:4px">${formatAEST(order.created_at, 'dd MMM yyyy')}</div>
        </td>
      </tr>
    </table>
    <div style="padding:32px 40px">
      <p style="color:#1a3a2a;font-size:14px;margin:0 0 20px;line-height:1.6">
        <strong>${farmerName}</strong> rejected their portion of this order (${itemsList}, ${fmt(rejectedSubtotal)}). The buyer has been notified. This needs manual resolution — refund the rejected items, arrange a substitute, or contact the buyer.
      </p>
      <div style="background:#fef2f2;border-radius:10px;padding:16px 20px;margin-bottom:24px">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#b91c1c;font-weight:700;margin-bottom:4px">Rejection reason</div>
        <div style="color:#1a3a2a;font-size:14px">${reason}</div>
      </div>
      <div style="background:#f5f9f5;border-radius:10px;padding:16px 20px;margin-bottom:24px">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#4a7a5a;font-weight:700;margin-bottom:4px">Buyer</div>
        <div style="color:#1a3a2a;font-size:14px;font-weight:600">${buyer?.business_name || buyer?.full_name || 'Unknown'}</div>
      </div>
      <div style="text-align:center">
        <a href="${siteUrl}/dashboard/admin/orders/${orderId}"
           style="background:#1a3a2a;color:white;padding:14px 32px;border-radius:99px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block">
          Resolve in Admin →
        </a>
      </div>
    </div>
  </div>
</body>
</html>`,
      })
    } catch (err) {
      console.error('[PO-REJECT-EMAIL] Admin email failed for order', order.order_number, err)
    }
  } else {
    console.warn('[PO-REJECT-EMAIL] No admin emails found — nobody notified for order', order.order_number)
  }
}
