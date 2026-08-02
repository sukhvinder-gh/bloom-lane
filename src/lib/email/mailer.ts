// src/lib/email/mailer.ts
// Shared sender for every transactional email in the app. Every template
// calls sendEmail() below instead of talking to a provider SDK directly, so
// the actual sending provider is a config change, not a code change.
//
// Resend's onboarding@resend.dev sandbox address only ever delivers to the
// Resend account's own email (anti-spoofing — you can't send FROM a domain
// you haven't verified there), so nothing sent that way ever reached real
// buyers/farmers/admins in production. Gmail SMTP is supported as a
// same-day interim option: a Gmail App Password lets it send genuinely as
// that real, already-deliverable address, no domain verification needed.
//
// EMAIL_PROVIDER selects which one is active ('gmail' | 'resend'). If unset,
// it's inferred: Gmail if GMAIL_USER + GMAIL_APP_PASSWORD are both set,
// otherwise Resend.

import nodemailer from 'nodemailer'
import { Resend } from 'resend'

type Provider = 'gmail' | 'resend'

function getProvider(): Provider {
  const explicit = (process.env.EMAIL_PROVIDER || '').trim().toLowerCase()
  if (explicit === 'gmail' || explicit === 'resend') return explicit
  return process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD ? 'gmail' : 'resend'
}

let gmailTransporter: ReturnType<typeof nodemailer.createTransport> | null = null
function getGmailTransporter() {
  if (!gmailTransporter) {
    gmailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    })
  }
  return gmailTransporter
}

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  attachments?: Array<{ filename: string; content: Buffer | string }>
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const provider = getProvider()

  if (provider === 'gmail') {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.error('[MAILER] EMAIL_PROVIDER=gmail but GMAIL_USER / GMAIL_APP_PASSWORD not set — email not sent:', options.subject)
      return
    }
    await getGmailTransporter().sendMail({
      from: `The Green Guild <${process.env.GMAIL_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      attachments: options.attachments,
    })
    return
  }

  // Resend (default / explicit EMAIL_PROVIDER=resend)
  if (!process.env.RESEND_API_KEY) {
    console.error('[MAILER] EMAIL_PROVIDER=resend but RESEND_API_KEY not set — email not sent:', options.subject)
    return
  }
  const resend = new Resend(process.env.RESEND_API_KEY)
  // Resend's SDK doesn't throw on API-level failures — it returns
  // { data, error } — so this must be checked explicitly, or a failed send
  // looks identical to a successful one to every caller.
  const { error } = await resend.emails.send({
    from: `The Green Guild <${process.env.EMAIL_FROM || 'onboarding@resend.dev'}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
    attachments: options.attachments?.map(a => ({
      filename: a.filename,
      content: typeof a.content === 'string' ? a.content : a.content.toString('base64'),
    })),
  })
  if (error) throw new Error(typeof error === 'string' ? error : JSON.stringify(error))
}
