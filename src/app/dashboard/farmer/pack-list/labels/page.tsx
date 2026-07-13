import { getSessionUserFromCookie, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatPrice } from '@/lib/utils/pricing'
import { PrintButton } from '@/components/PrintButton'

const ACTIVE_PO_STATUSES = ['pending', 'ready']

// Calibrated for Avery L7160 (A4, 21 labels/sheet, 3 columns x 7 rows,
// 63.5mm x 38.1mm each) — the standard AU/UK/EU address label sheet.
// Printer margins vary slightly — print one test sheet before a full batch
// and nudge PAGE_MARGIN_TOP/LEFT below if labels drift on your printer.
const LABEL_WIDTH_MM = 63.5
const LABEL_HEIGHT_MM = 38.1
const COLUMN_GAP_MM = 2.5
const PAGE_MARGIN_TOP_MM = 15.15
const PAGE_MARGIN_LEFT_MM = 7.2

export default async function PackListLabelsPage() {
  const sessionUser = await getSessionUserFromCookie()
  if (!sessionUser) redirect('/auth/login')

  const admin = createAdminClient()

  const { data: farmers } = await admin
    .from('farmers').select('id').eq('user_id', sessionUser.id).limit(1)
  const farmer = farmers?.[0] ?? null
  if (!farmer) redirect('/dashboard')

  const { data: pos } = await admin
    .from('purchase_orders')
    .select('order_id')
    .eq('farmer_id', farmer.id)
    .in('status', ACTIVE_PO_STATUSES)

  const orderIds = [...new Set((pos || []).map(p => p.order_id))]

  const { data: orders } = orderIds.length > 0
    ? await admin
        .from('orders')
        .select('id, order_number, buyer_id, order_items(id, quantity, unit_price_cents, subtotal_cents, products(name, unit))')
        .in('id', orderIds)
        .eq('order_items.farmer_id', farmer.id)
    : { data: [] as any[] }

  const buyerIds = [...new Set((orders || []).map((o: any) => o.buyer_id))]
  const { data: buyers } = buyerIds.length > 0
    ? await admin.from('profiles').select('id, full_name, business_name').in('id', buyerIds)
    : { data: [] as any[] }
  const buyerById = new Map((buyers || []).map((b: any) => [b.id, b]))

  const labels = (orders || []).flatMap((order: any) => {
    const buyer = buyerById.get(order.buyer_id)
    const buyerName = buyer?.business_name || buyer?.full_name || 'Buyer'
    return (order.order_items || []).map((item: any) => ({
      id: item.id,
      buyerName,
      orderNumber: order.order_number,
      productName: item.products?.name || '',
      unit: item.products?.unit || '',
      quantity: item.quantity,
      price: formatPrice(item.subtotal_cents),
    }))
  })

  return (
    <div className="page-pad" style={{ padding: '2.5rem' }}>
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <Link href="/dashboard/farmer/pack-list" className="btn btn-ghost btn-sm">← Pack List</Link>
        <span style={{ flex: 1 }} />
        <PrintButton label="Print labels" />
      </div>

      <div className="no-print" style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '1rem', padding: '1rem 1.5rem', marginBottom: '1.5rem', maxWidth: '48rem' }}>
        <p style={{ fontSize: '0.85rem', color: '#92400E' }}>
          Calibrated for <strong>Avery L7160</strong> (21 labels/sheet, 3×7, 63.5×38.1mm). Printer margins vary — print one test sheet on plain paper first and hold it against a label sheet before printing a full batch.
        </p>
      </div>

      {labels.length === 0 ? (
        <p style={{ color: 'var(--moss)' }}>No labels to print — no active orders.</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(3, ${LABEL_WIDTH_MM}mm)`,
            gridAutoRows: `${LABEL_HEIGHT_MM}mm`,
            columnGap: `${COLUMN_GAP_MM}mm`,
            rowGap: 0,
            marginTop: `${PAGE_MARGIN_TOP_MM}mm`,
            marginLeft: `${PAGE_MARGIN_LEFT_MM}mm`,
            width: 'fit-content',
          }}
        >
          {labels.map(l => (
            <div key={l.id} style={{
              width: `${LABEL_WIDTH_MM}mm`,
              height: `${LABEL_HEIGHT_MM}mm`,
              padding: '3mm 4mm',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              fontFamily: 'var(--font-body)',
              overflow: 'hidden',
            }}>
              <div style={{ fontSize: '9pt', fontWeight: 700, color: 'var(--forest)', lineHeight: 1.2 }}>{l.buyerName}</div>
              <div style={{ fontSize: '10pt', fontWeight: 700, color: 'var(--forest)', marginTop: '1mm' }}>{l.productName} × {l.quantity} {l.unit}</div>
              <div style={{ fontSize: '8pt', color: 'var(--moss)', marginTop: '1mm' }}>{l.price} · {l.orderNumber}</div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
        }
      `}</style>
    </div>
  )
}
