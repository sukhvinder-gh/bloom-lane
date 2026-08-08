import { sendEmail } from './mailer'

// Notifies the other side(s) of an order-message thread when someone posts
// a new message — previously a message just landed in the DB with nothing
// telling the recipient it existed, so they'd only see it if they happened
// to reopen that specific order.
export async function sendNewMessageEmail(params: {
  to: string
  recipientName: string
  senderName: string
  orderNumber: string
  messageBody: string
  dashboardPath: string
}): Promise<void> {
  const { to, recipientName, senderName, orderNumber, messageBody, dashboardPath } = params
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bloom-lane-app.azurewebsites.net'
  const escapedBody = messageBody
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:system-ui,-apple-system,sans-serif">
  <div style="max-width:600px;margin:40px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
    <div style="background:#1a3a2a;padding:28px 40px">
      <div style="color:white;font-size:18px;font-weight:800;letter-spacing:-0.5px;text-transform:uppercase">THE GREEN GUILD</div>
      <div style="color:#a8c8a8;font-size:12px;margin-top:4px">New message on order ${orderNumber}</div>
    </div>
    <div style="padding:32px 40px">
      <p style="color:#1a3a2a;font-size:16px;margin:0 0 8px">Hi ${recipientName},</p>
      <p style="color:#4a7a5a;font-size:14px;margin:0 0 20px;line-height:1.6">
        ${senderName} sent you a message about order ${orderNumber}:
      </p>
      <div style="background:#f5f9f5;border-left:3px solid #1a3a2a;border-radius:6px;padding:16px 20px;margin-bottom:28px">
        <p style="color:#1a3a2a;font-size:14px;margin:0;line-height:1.6">${escapedBody}</p>
      </div>
      <div style="text-align:center;margin-bottom:20px">
        <a href="${siteUrl}${dashboardPath}"
           style="background:#1a3a2a;color:white;padding:14px 32px;border-radius:99px;text-decoration:none;font-weight:700;font-size:14px;display:inline-block">
          Reply →
        </a>
      </div>
      <p style="color:#9ab0a0;font-size:11px;text-align:center;margin:0">
        Do not reply to this email — it is system-generated. Use the link above to reply within the order.
      </p>
    </div>
  </div>
</body>
</html>`

  await sendEmail({
    to,
    subject: `${senderName} sent you a message — order ${orderNumber}`,
    html,
  })
}
