import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createAdminClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/utils/permissions'
import {
  sendSubscriptionConfirmation,
  sendSubscriptionExpiryWarning,
  sendWeeklyAvailabilityDigest,
  sendPONotification,
} from '@/lib/email/sendSubscriptionEmail'
import { sendOrderConfirmationEmail } from '@/lib/email/sendOrderConfirmationEmail'
import { sendPOEmail } from '@/lib/email/sendPOEmail'

// GET /api/admin/test-emails?to=you@example.com
// Sends one of each email type to verify templates + Resend connectivity.
// DELETE THIS ROUTE once domain is verified and email is confirmed working.
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!isAdminRole(profile?.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const to = request.nextUrl.searchParams.get('to')
  if (!to) return NextResponse.json({ error: 'Pass ?to=your@email.com' }, { status: 400 })

  const results: Record<string, string> = {}

  // 1. Subscription confirmation
  try {
    await sendSubscriptionConfirmation({
      to,
      name: 'Test Grower',
      plan: 'hub_membership',
      billing: 'monthly',
      amount_cents: 6000,
      gst_registered: true,
    })
    results['subscription_confirmation'] = 'OK'
  } catch (e: any) {
    results['subscription_confirmation'] = `FAIL: ${e.message}`
  }

  // 2. Subscription expiry warning
  try {
    await sendSubscriptionExpiryWarning({
      to,
      name: 'Test Grower',
      plan: 'hub_membership',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    results['subscription_expiry_warning'] = 'OK'
  } catch (e: any) {
    results['subscription_expiry_warning'] = `FAIL: ${e.message}`
  }

  // 3. Weekly availability digest
  try {
    await sendWeeklyAvailabilityDigest({
      to,
      name: 'Test Florist',
      products: [
        { name: 'Tulips – Pink', farmer: 'Sunrise Farm', unit: 'bunch', b2b_price: 1200, category: 'Flowers' },
        { name: 'Garden Roses – White', farmer: 'Hill View Gardens', unit: 'stem', b2b_price: 450, category: 'Flowers' },
        { name: 'Eucalyptus Sprigs', farmer: 'Green Valley', unit: 'bunch', b2b_price: 800, category: 'Foliage' },
      ],
    })
    results['weekly_digest'] = 'OK'
  } catch (e: any) {
    results['weekly_digest'] = `FAIL: ${e.message}`
  }

  // 4. PO notification (simple)
  try {
    await sendPONotification({
      to,
      grower_name: 'Test Grower',
      order_number: 'TGG-TEST-001',
      order_id: '00000000-0000-0000-0000-000000000001',
      items: [
        { product_name: 'Tulips – Pink', quantity: 5, unit: 'bunch', subtotal_cents: 6000 },
        { product_name: 'Garden Roses', quantity: 10, unit: 'stem', subtotal_cents: 4500 },
      ],
    })
    results['po_notification'] = 'OK'
  } catch (e: any) {
    results['po_notification'] = `FAIL: ${e.message}`
  }

  // 5. Buyer order confirmation
  try {
    await sendOrderConfirmationEmail({
      order_number: 'TGG-TEST-001',
      created_at: new Date().toISOString(),
      buyer_email: to,
      buyer_name: 'Test Buyer',
      fulfillment_type: 'hub_pickup',
      delivery_address: null,
      delivery_suburb: null,
      delivery_state: null,
      subtotal_cents: 10500,
      gst_cents: 954,
      delivery_fee_cents: 0,
      total_cents: 11454,
      items: [
        { product_name: 'Tulips – Pink', product_unit: 'bunch', quantity: 5, subtotal_cents: 6000, is_gst_free: false },
        { product_name: 'Garden Roses', product_unit: 'stem', quantity: 10, subtotal_cents: 4500, is_gst_free: false },
      ],
    })
    results['order_confirmation'] = 'OK'
  } catch (e: any) {
    results['order_confirmation'] = `FAIL: ${e.message}`
  }

  // 6. PO email with PDF attachment
  try {
    await sendPOEmail(to, {
      order_number: 'TGG-TEST-001',
      created_at: new Date().toISOString(),
      grower_fulfillment_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      fulfillment_type: 'hub_pickup',
      hub_address: '12 Market Lane, Melbourne VIC 3000',
      farmer_business_name: 'Sunrise Farm',
      farmer_abn: '12 345 678 901',
      farmer_suburb: 'Healesville',
      farmer_state: 'VIC',
      commission_rate: 0.15,
      items: [
        { id: 'item-1', product_name: 'Tulips – Pink', product_unit: 'bunch', quantity: 5, unit_price_cents: 1200, subtotal_cents: 6000 },
        { id: 'item-2', product_name: 'Garden Roses', product_unit: 'stem', quantity: 10, unit_price_cents: 450, subtotal_cents: 4500 },
      ],
    })
    results['po_email_with_pdf'] = 'OK'
  } catch (e: any) {
    results['po_email_with_pdf'] = `FAIL: ${e.message}`
  }

  const allOk = Object.values(results).every(v => v === 'OK')
  return NextResponse.json({ allOk, to, results })
}
