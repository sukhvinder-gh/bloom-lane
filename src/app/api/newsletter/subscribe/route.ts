import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

    const { data: existing } = await admin
      .from('newsletter_subscribers')
      .select('id, status')
      .eq('email', normalised)
      .single()

    if (existing) {
      if (existing.status === 'active') {
        return NextResponse.json({ message: "You're already subscribed — thanks!" })
      }
      // Re-subscribe
      await admin
        .from('newsletter_subscribers')
        .update({ status: 'active', subscribed_at: new Date().toISOString(), unsubscribed_at: null })
        .eq('id', existing.id)
      return NextResponse.json({ message: "Welcome back! You're subscribed again." })
    }

    const { error } = await admin.from('newsletter_subscribers').insert({
      email: normalised,
      source: 'landing_page',
    })

    if (error) {
      console.error('Newsletter subscribe error:', error)
      return NextResponse.json({ error: 'Could not subscribe. Please try again.' }, { status: 500 })
    }

    return NextResponse.json({ message: "You're on the list! Expect fresh updates every week." })
  } catch (err) {
    console.error('Newsletter subscribe error:', err)
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 })
  }
}
