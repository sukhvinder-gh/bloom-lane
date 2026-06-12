import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/utils/permissions'
import { sendWeeklyAvailabilityDigest } from '@/lib/email/sendSubscriptionEmail'

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!isAdminRole(profile?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Get all active listed products
  const { data: products } = await admin
    .from('products')
    .select('name, wholesale_price, unit, farmers(business_name)')
    .eq('is_listed_this_week', true)
    .eq('is_active', true)
    .gt('b2b_available', 0)

  if (!products || products.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: 'No products listed this week' })
  }

  const productList = products.map((p: any) => ({
    name: p.name,
    farmer: p.farmers?.business_name || 'Local Grower',
    unit: p.unit,
    b2b_price: p.wholesale_price,
    category: '',
  }))

  // Get all florists on mailing list
  const { data: subscribers } = await admin
    .from('subscriptions')
    .select('user_id, profiles!subscriptions_user_id_fkey(email, full_name)')
    .eq('subscriber_type', 'florist')
    .eq('plan', 'mailing_list')
    .eq('status', 'active')

  if (!subscribers || subscribers.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: 'No mailing list subscribers' })
  }

  let sent = 0
  const errors: string[] = []

  for (const sub of subscribers) {
    const profile = (sub as any).profiles
    if (!profile?.email) continue
    try {
      await sendWeeklyAvailabilityDigest({
        to: profile.email,
        name: profile.full_name || 'Florist',
        products: productList,
      })
      sent++
    } catch (err: any) {
      errors.push(`${profile.email}: ${err.message}`)
    }
  }

  return NextResponse.json({ ok: true, sent, errors: errors.length ? errors : undefined })
}
