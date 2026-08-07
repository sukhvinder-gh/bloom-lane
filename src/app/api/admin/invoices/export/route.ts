import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { isAdminRole } from '@/lib/utils/permissions'
import { formatAEST } from '@/lib/utils/timezone'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized', status: 401 as const, admin: null }
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (!isAdminRole(profile?.role)) return { error: 'Forbidden', status: 403 as const, admin: null }
  return { error: null, status: 200 as const, admin }
}

// Only paid transactions count as an actual supply/invoice for ATO purposes —
// mirrors the same status set the buyer-facing invoice list uses.
const PAID_STATUSES = ['payment_confirmed', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'resolved']

function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// GET /api/admin/invoices/export?from=YYYY-MM-DD&to=YYYY-MM-DD
// One row per invoice line item (per grower, per product) — the same
// granularity the per-order invoice documents render — so this file is a
// complete, self-contained transaction record a bookkeeper or the ATO can
// work from without needing to open the app.
export async function GET(req: NextRequest) {
  const { error, status, admin } = await requireAdmin()
  if (error || !admin) return NextResponse.json({ error }, { status })

  const from = req.nextUrl.searchParams.get('from') || ''
  const to   = req.nextUrl.searchParams.get('to') || ''

  let query = admin
    .from('orders')
    .select(`
      id, order_number, created_at, status, fulfillment_type, delivery_fee_cents,
      profiles!orders_buyer_id_fkey(full_name, business_name, email, abn),
      order_items(quantity, unit_price_cents, subtotal_cents, gst_applied, gst_cents, farmer_id,
        products(name, unit),
        farmers(business_name, abn, gst_registered)
      )
    `)
    .in('status', PAID_STATUSES)
    .order('created_at', { ascending: true })

  if (from) query = query.gte('created_at', from)
  if (to)   query = query.lte('created_at', `${to}T23:59:59`)

  const { data: orders, error: dbErr } = await query
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })

  const header = [
    'Order Date', 'Order Number', 'Order Status', 'Fulfillment Type',
    'Buyer', 'Buyer Email', 'Buyer ABN',
    'Grower', 'Grower ABN', 'Grower GST Registered',
    'Product', 'Unit', 'Quantity', 'Unit Price', 'Subtotal',
    'GST Applied', 'GST Amount',
  ]

  const rows: string[] = [header.map(csvCell).join(',')]

  for (const order of orders || []) {
    const buyer = (order as any).profiles
    const items = (order as any).order_items || []
    for (const item of items) {
      const farmer = item.farmers
      rows.push([
        formatAEST(order.created_at, 'yyyy-MM-dd'),
        order.order_number,
        order.status,
        order.fulfillment_type,
        buyer?.business_name || buyer?.full_name || '',
        buyer?.email || '',
        buyer?.abn || '',
        farmer?.business_name || '',
        farmer?.abn || '',
        farmer?.gst_registered ? 'Yes' : 'No',
        item.products?.name || '',
        item.products?.unit || '',
        item.quantity,
        (item.unit_price_cents / 100).toFixed(2),
        (item.subtotal_cents / 100).toFixed(2),
        item.gst_applied ? 'Yes' : 'No',
        ((item.gst_cents || 0) / 100).toFixed(2),
      ].map(csvCell).join(','))
    }
  }

  const csv = rows.join('\r\n')
  const filename = `green-guild-transactions${from ? `_${from}` : ''}${to ? `_${to}` : ''}.csv`

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
