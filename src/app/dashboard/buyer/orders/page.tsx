'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatPrice } from '@/lib/utils/pricing'
import { formatAEST } from '@/lib/utils/timezone'
import Link from 'next/link'

const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  pending_payment:   { label: 'Pending',    bg: '#F1EFE8', color: '#5F5E5A' },
  payment_confirmed: { label: 'Paid',       bg: '#EAF3DE', color: '#3B6D11' },
  preparing:         { label: 'Preparing',  bg: '#E6F1FB', color: '#185FA5' },
  ready_for_pickup:  { label: 'Ready',      bg: '#E1F5EE', color: '#0F6E56' },
  out_for_delivery:  { label: 'Delivering', bg: '#E1F5EE', color: '#0F6E56' },
  delivered:         { label: 'Delivered',  bg: '#C0DD97', color: '#27500A' },
  disputed:          { label: 'Disputed',   bg: '#FCEBEB', color: '#A32D2D' },
  resolved:          { label: 'Resolved',   bg: '#E1F5EE', color: '#0F6E56' },
  refunded:          { label: 'Refunded',   bg: '#F1EFE8', color: '#5F5E5A' },
  cancelled:         { label: 'Cancelled',  bg: '#F1EFE8', color: '#5F5E5A' },
}

function exportCSV(orders: any[], filename = 'harvest-orders.csv') {
  const rows = [['Order #','Date','Status','Item','Supplier','Qty','Unit','Unit Price (ex-GST)','Subtotal (ex-GST)','GST','Delivery','Total (inc-GST)']]
  orders.forEach(o => {
    ;(o.order_items || []).forEach((item: any, i: number) => {
      const gst = item.products?.is_gst_free ? 0 : Math.round((item.subtotal_cents * 0.1) / 1.1)
      const exGst = item.subtotal_cents - gst
      rows.push([
        i === 0 ? o.order_number : '',
        i === 0 ? formatAEST(o.created_at, 'dd/MM/yyyy') : '',
        i === 0 ? o.status : '',
        item.products?.name || '',
        item.farmers?.business_name || '',
        item.quantity,
        item.products?.unit || '',
        ((item.unit_price_cents / 1.1) / 100).toFixed(2),
        (exGst / 100).toFixed(2),
        (gst / 100).toFixed(2),
        i === 0 ? ((o.delivery_fee_cents || 0) / 100).toFixed(2) : '',
        i === 0 ? (o.total_cents / 100).toFixed(2) : '',
      ])
    })
  })
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv)
  a.download = filename
  a.click()
}

function printInvoice(order: any, profile: any) {
  const isB2B = profile?.role === 'buyer_b2b'
  const w = window.open('', '_blank')!
  const gstTotal = order.gst_cents || 0
  const exGstSub = order.total_cents - gstTotal - (order.delivery_fee_cents || 0)
  const rows = (order.order_items || []).map((item: any) => {
    const gst = item.products?.is_gst_free ? 0 : Math.round((item.subtotal_cents * 0.1) / 1.1)
    const exGst = item.subtotal_cents - gst
    return `<tr>
      <td>${item.products?.name || ''}</td>
      <td style="text-align:right">${item.quantity} ${item.products?.unit || ''}</td>
      <td style="text-align:right">$${((item.unit_price_cents / 1.1) / 100).toFixed(2)}</td>
      <td style="text-align:right">$${(exGst / 100).toFixed(2)}</td>
      <td style="text-align:right">${item.products?.is_gst_free ? 'GST-free' : '$' + (gst / 100).toFixed(2)}</td>
      <td style="text-align:right">$${(item.subtotal_cents / 100).toFixed(2)}</td>
    </tr>`
  }).join('')
  w.document.write(`<!DOCTYPE html><html><head><title>Invoice ${order.order_number}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:40px;color:#01472E;font-size:13px}
    h1{font-size:26px;letter-spacing:-1px;margin:0}
    table{width:100%;border-collapse:collapse;margin-top:20px}
    th{text-align:left;padding:7px 6px;border-bottom:1.5px solid #01472E;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#4a7a65}
    th.r,td.r{text-align:right}
    td{padding:7px 6px;border-bottom:1px solid #d0e0d8}
    .total-line{display:flex;justify-content:space-between;padding:4px 0;color:#4a7a65;font-size:12px}
    .total-final{display:flex;justify-content:space-between;font-weight:700;border-top:1.5px solid #01472E;padding-top:8px;margin-top:4px}
    @media print{button{display:none}}
  </style></head><body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px">
    <div>
      <h1>THE GREEN GUILD</h1>
      <div style="font-size:11px;color:#4a7a65;margin-top:6px;letter-spacing:.1em">TAX INVOICE</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:16px;font-weight:700">${order.order_number}</div>
      <div style="font-size:11px;color:#4a7a65;margin-top:4px">${formatAEST(order.created_at, 'dd MMM yyyy')}</div>
      ${profile?.abn ? `<div style="font-size:11px;color:#4a7a65;margin-top:2px">ABN: ${profile.abn}</div>` : ''}
    </div>
  </div>
  <div style="margin-bottom:24px">
    <div style="font-weight:700">${profile?.business_name || profile?.full_name || ''}</div>
    <div style="color:#4a7a65;font-size:12px;margin-top:2px">${profile?.email || ''}</div>
    <div style="color:#4a7a65;font-size:12px;margin-top:2px">${order.delivery_suburb ? `Delivery: ${order.delivery_suburb}, ${order.delivery_state || ''}` : 'Collection: Hub Pickup'}</div>
  </div>
  <table>
    <thead><tr><th>Product</th><th class="r">Qty</th><th class="r">Unit price</th><th class="r">Ex-GST</th><th class="r">GST</th><th class="r">Total</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div style="display:flex;justify-content:flex-end;margin-top:20px">
    <div style="width:240px">
      ${isB2B ? `<div class="total-line"><span>Subtotal (ex-GST)</span><span>$${(exGstSub/100).toFixed(2)}</span></div>` : ''}
      ${isB2B && gstTotal > 0 ? `<div class="total-line"><span>GST (10%)</span><span>$${(gstTotal/100).toFixed(2)}</span></div>` : ''}
      ${(order.delivery_fee_cents||0) > 0 ? `<div class="total-line"><span>Delivery</span><span>$${(order.delivery_fee_cents/100).toFixed(2)}</span></div>` : `<div class="total-line"><span>Hub pickup</span><span>Free</span></div>`}
      <div class="total-final"><span>TOTAL (inc-GST)</span><span>$${(order.total_cents/100).toFixed(2)}</span></div>
    </div>
  </div>
  <script>window.onload=()=>window.print()<\/script>
  </body></html>`)
  w.document.close()
}

export default function BuyerOrdersPage() {
  const [orders, setOrders]   = useState<any[]>([])
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [tab, setTab]         = useState<'orders' | 'invoices'>('orders')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { window.location.href = '/auth/login'; return }
      const [{ data: prof }, { data: ords }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('orders')
          .select('*, order_items(*, products(name, unit, is_gst_free), farmers(business_name))')
          .eq('buyer_id', user.id)
          .order('created_at', { ascending: false }),
      ])
      setProfile(prof)
      setOrders(ords || [])
      setLoading(false)
    })
  }, [])

  const toggle = (id: string) => setExpanded(s => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n
  })

  const invoiceStatuses = ['payment_confirmed','preparing','ready_for_pickup','out_for_delivery','delivered','resolved']
  const displayOrders = tab === 'invoices' ? orders.filter(o => invoiceStatuses.includes(o.status)) : orders
  const isB2B = profile?.role === 'buyer_b2b'

  const th: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--forest)', opacity: 0.5, borderBottom: '1px solid var(--olive)', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '11px 12px', borderBottom: '1px solid var(--olive)', fontSize: '0.875rem', color: 'var(--forest)', verticalAlign: 'middle' }

  if (loading) return <div className="page-pad" style={{ padding: '2.5rem', color: 'var(--forest)', opacity: 0.4 }}>Loading...</div>

  return (
    <div className="page-pad" style={{ padding: '2.5rem', fontFamily: 'var(--font-body)' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', color: 'var(--forest)', marginBottom: '0.2rem' }}>
            {tab === 'orders' ? 'My Orders' : 'Tax Invoices'}
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--forest)', opacity: 0.5 }}>{displayOrders.length} {tab === 'orders' ? 'orders' : 'invoices'}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {displayOrders.length > 0 && (
            <button onClick={() => exportCSV(displayOrders, `harvest-${tab}.csv`)}
              style={{ padding: '0.5rem 1rem', background: 'var(--olive)', border: '1px solid var(--sage)', borderRadius: '99px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', color: 'var(--forest)', fontFamily: 'var(--font-body)' }}>
              ↓ Export all CSV
            </button>
          )}
          <Link href="/marketplace"
            style={{ padding: '0.5rem 1.25rem', background: 'var(--forest)', color: 'var(--cream)', borderRadius: '99px', textDecoration: 'none', fontWeight: 700, fontSize: '0.8rem' }}>
            + New Order
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--olive)', borderRadius: '99px', padding: '0.25rem', width: 'fit-content', marginBottom: '1.5rem' }}>
        {(['orders', 'invoices'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ padding: '0.375rem 1.125rem', borderRadius: '99px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', fontFamily: 'var(--font-body)', transition: 'all 0.15s',
              background: tab === t ? 'var(--forest)' : 'transparent',
              color: tab === t ? 'var(--cream)' : 'var(--forest)' }}>
            {t === 'orders' ? '📦 Orders' : '🧾 Invoices'}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {displayOrders.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 'var(--r-card)', padding: '4rem', textAlign: 'center', border: '1px solid var(--olive)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>{tab === 'orders' ? '📦' : '🧾'}</div>
          <p style={{ fontFamily: 'var(--font-display)', color: 'var(--forest)', marginBottom: '0.5rem', fontSize: '1.25rem' }}>No {tab} yet</p>
          <p style={{ color: 'var(--forest)', opacity: 0.5, fontSize: '0.875rem', marginBottom: '1.5rem' }}>Place your first order from the marketplace</p>
          <Link href="/marketplace"
            style={{ background: 'var(--forest)', color: 'var(--cream)', padding: '0.625rem 1.5rem', borderRadius: '99px', textDecoration: 'none', fontWeight: 700, fontSize: '0.875rem' }}>
            Browse Marketplace
          </Link>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: 'var(--r-card)', border: '1px solid var(--olive)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--olive)' }}>
                <th style={{ ...th, width: '2rem' }} />
                <th style={th}>Order</th>
                <th style={th}>Date</th>
                {tab === 'orders'
                  ? <th style={{ ...th, width: '35%' }}>Items</th>
                  : <th style={{ ...th, width: '35%' }}>Description</th>
                }
                {tab === 'orders'
                  ? <th style={{ ...th, textAlign: 'right' }}>Total</th>
                  : <>
                      <th style={{ ...th, textAlign: 'right' }}>Ex-GST</th>
                      <th style={{ ...th, textAlign: 'right' }}>GST</th>
                      <th style={{ ...th, textAlign: 'right' }}>Total</th>
                    </>
                }
                {tab === 'orders'
                  ? <th style={{ ...th, textAlign: 'center' }}>Status</th>
                  : <th style={{ ...th, textAlign: 'center' }}>Period</th>
                }
                <th style={{ ...th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayOrders.map((order, idx) => {
                const s = STATUS_MAP[order.status] || { label: order.status, bg: '#F1EFE8', color: '#5F5E5A' }
                const isOpen = expanded.has(order.id)
                const itemCount = order.order_items?.length || 0
                const summary = order.order_items?.slice(0, 2).map((i: any) => `${i.quantity}× ${i.products?.name}`).join(', ')
                  + (itemCount > 2 ? ` +${itemCount - 2} more` : '')

                return (
                  <>
                    {/* Main row */}
                    <tr key={order.id}
                      onClick={() => toggle(order.id)}
                      style={{ cursor: 'pointer', background: isOpen ? '#fafaf7' : 'white', transition: 'background 0.1s' }}>
                      <td style={{ ...td, textAlign: 'center', width: '2rem' }}>
                        <span style={{ display: 'inline-block', transition: 'transform 0.18s', transform: isOpen ? 'rotate(90deg)' : 'none', fontSize: '0.6rem', color: 'var(--moss)' }}>▶</span>
                      </td>
                      <td style={{ ...td, fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '-0.01em', fontSize: '0.875rem' }}>
                        {order.order_number}
                      </td>
                      <td style={{ ...td, opacity: 0.6, whiteSpace: 'nowrap' }}>
                        {formatAEST(order.created_at, 'dd MMM yyyy')}
                      </td>
                      {tab === 'orders' ? (
                        <td style={{ ...td, opacity: 0.8, fontSize: '0.8rem' }}>{summary}</td>
                      ) : (
                        <td style={{ ...td, fontSize: '0.8rem', color: 'var(--forest)', opacity: 0.8 }}>
                          {itemCount} item{itemCount !== 1 ? 's' : ''}
                          {order.fulfillment_type === 'hub_pickup' ? ' · Hub pickup' : ' · Delivery'}
                        </td>
                      )}
                      {tab === 'orders' ? (
                        <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', fontSize: '1rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {formatPrice(order.total_cents)}
                        </td>
                      ) : (
                        <>
                          <td style={{ ...td, textAlign: 'right', fontSize: '0.85rem', color: 'var(--forest)' }}>
                            {formatPrice(order.total_cents - (order.gst_cents || 0) - (order.delivery_fee_cents || 0))}
                          </td>
                          <td style={{ ...td, textAlign: 'right', fontSize: '0.85rem', color: 'var(--forest)', opacity: 0.6 }}>
                            {formatPrice(order.gst_cents || 0)}
                          </td>
                          <td style={{ ...td, textAlign: 'right', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', fontSize: '1rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                            {formatPrice(order.total_cents)}
                          </td>
                        </>
                      )}
                      {tab === 'orders' ? (
                        <td style={{ ...td, textAlign: 'center' }}>
                          <span style={{ padding: '3px 10px', borderRadius: '99px', fontSize: '0.7rem', fontWeight: 700, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
                            {s.label}
                          </span>
                        </td>
                      ) : (
                        <td style={{ ...td, textAlign: 'center', fontSize: '0.75rem', color: 'var(--forest)', opacity: 0.6 }}>
                          {formatAEST(order.created_at, 'MMM yyyy')}
                        </td>
                      )}
                      <td style={{ ...td, textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          <button onClick={() => exportCSV([order], `${order.order_number}.csv`)}
                            style={{ padding: '0.3rem 0.6rem', background: 'var(--olive)', border: '1px solid var(--sage)', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, color: 'var(--forest)', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}>
                            ↓ CSV
                          </button>
                          {invoiceStatuses.includes(order.status) && (
                            <button onClick={() => printInvoice(order, profile)}
                              style={{ padding: '0.3rem 0.6rem', background: 'var(--forest)', border: 'none', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, color: 'var(--cream)', fontFamily: 'var(--font-body)', whiteSpace: 'nowrap' }}>
                              🖨 Invoice
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isOpen && (
                      <tr key={order.id + '-detail'}>
                        <td colSpan={tab === 'invoices' ? 8 : 7} style={{ padding: 0, background: '#fafaf7', borderBottom: '1px solid var(--olive)' }}>
                          <div style={{ padding: '1rem 1.25rem 1.25rem 2.75rem' }}>

                            {/* Meta */}
                            <div style={{ display: 'flex', gap: '2rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                              <div>
                                <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--moss)', marginBottom: '0.2rem' }}>Fulfillment</p>
                                <p style={{ fontSize: '0.8rem', color: 'var(--forest)' }}>
                                  {order.fulfillment_type === 'hub_pickup' ? '🏭 Hub Pickup' : '🚚 Delivery'}
                                  {order.delivery_suburb ? ` · ${order.delivery_suburb}, ${order.delivery_state || ''}` : ''}
                                </p>
                              </div>
                              {order.notes && (
                                <div>
                                  <p style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--moss)', marginBottom: '0.2rem' }}>Notes</p>
                                  <p style={{ fontSize: '0.8rem', color: 'var(--forest)' }}>{order.notes}</p>
                                </div>
                              )}
                            </div>

                            {/* Line items */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid var(--sage)' }}>
                                  {['Product','Qty','Unit price','Ex-GST', isB2B ? 'GST' : '','Total'].filter(Boolean).map(h => (
                                    <th key={h} style={{ padding: '6px 8px', textAlign: ['Ex-GST','GST','Total','Unit price','Qty'].includes(h) ? 'right' : 'left', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--forest)', opacity: 0.5 }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {(order.order_items || []).map((item: any) => {
                                  const gst = item.products?.is_gst_free ? 0 : Math.round((item.subtotal_cents * 0.1) / 1.1)
                                  const exGst = item.subtotal_cents - gst
                                  return (
                                    <tr key={item.id} style={{ borderBottom: '1px solid var(--olive)' }}>
                                      <td style={{ padding: '7px 8px', fontWeight: 600, color: 'var(--forest)' }}>{item.products?.name}</td>
                                      <td style={{ padding: '7px 8px', textAlign: 'right', color: 'var(--forest)' }}>{item.quantity} {item.products?.unit}</td>
                                      <td style={{ padding: '7px 8px', textAlign: 'right', color: 'var(--forest)' }}>{formatPrice(Math.round(item.unit_price_cents / 1.1))}</td>
                                      <td style={{ padding: '7px 8px', textAlign: 'right', color: 'var(--forest)' }}>{formatPrice(exGst)}</td>
                                      {isB2B && <td style={{ padding: '7px 8px', textAlign: 'right', color: 'var(--forest)', opacity: 0.6 }}>{item.products?.is_gst_free ? <span style={{ fontSize: '0.65rem' }}>GST-free</span> : formatPrice(gst)}</td>}
                                      <td style={{ padding: '7px 8px', textAlign: 'right', fontWeight: 700, color: 'var(--forest)' }}>{formatPrice(item.subtotal_cents)}</td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>

                            {/* Totals */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                              <div style={{ width: '15rem', fontSize: '0.8rem' }}>
                                {isB2B && (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--forest)', opacity: 0.7, padding: '3px 0' }}>
                                    <span>Subtotal (ex-GST)</span>
                                    <span>{formatPrice(order.total_cents - (order.gst_cents || 0) - (order.delivery_fee_cents || 0))}</span>
                                  </div>
                                )}
                                {isB2B && (order.gst_cents || 0) > 0 && (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--forest)', opacity: 0.7, padding: '3px 0' }}>
                                    <span>GST (10%)</span><span>{formatPrice(order.gst_cents)}</span>
                                  </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--forest)', opacity: 0.7, padding: '3px 0' }}>
                                  <span>{order.fulfillment_type === 'hub_pickup' ? 'Hub pickup' : 'Delivery'}</span>
                                  <span>{(order.delivery_fee_cents || 0) === 0 ? 'Free' : formatPrice(order.delivery_fee_cents)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--forest)', borderTop: '1.5px solid var(--forest)', paddingTop: '6px', marginTop: '4px', fontSize: '0.875rem' }}>
                                  <span>Total {isB2B ? '(inc-GST)' : ''}</span>
                                  <span>{formatPrice(order.total_cents)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
