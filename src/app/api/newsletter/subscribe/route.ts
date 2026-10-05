import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendNewsletterConfirmEmail } from '@/lib/email/sendNewsletterConfirmEmail'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Valid email required.' }, { status: 400 })
    }

    const normalised = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const token = randomUUID()

    const { data: existing } = await admin
      .from('newsletter_subscribers')
      .select('id, status')
      .eq('email', normalised)
      .single()

    if (existing) {
      if (existing.status === 'active') {
        return NextResponse.json({ message: "You're already subscribed — thanks!" })
      }
      // Re-subscribing (previously unsubscribed, or never confirmed) still
      // requires proving ownership of the address again — a fresh token,
      // not an instant reactivation.
      await admin
        .from('newsletter_subscribers')
        .update({ status: 'pending', confirm_token: token, confirmed_at: null, unsubscribed_at: null })
        .eq('id', existing.id)
    } else {
      const { error } = await admin.from('newsletter_subscribers').insert({
        email: normalised,
        status: 'pending',
        confirm_token: token,
        source: 'landing_page',
      })

      if (error) {
        console.error('Newsletter subscribe error:', error)
        return NextResponse.json({ error: 'Could not subscribe. Please try again.' }, { status: 500 })
      }
    }

    try {
      await sendNewsletterConfirmEmail(normalised, token)
    } catch (emailErr) {
      console.error('Newsletter confirm email failed:', emailErr)
      return NextResponse.json({ error: 'Could not send a confirmation email. Please try again.' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Almost there — check your inbox to confirm your subscription.' })
  } catch (err) {
    console.error('Newsletter subscribe error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
