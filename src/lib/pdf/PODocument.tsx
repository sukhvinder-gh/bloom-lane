import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { fontFamily: 'Helvetica', fontSize: 10, padding: 48, color: '#1a3a2a' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 2, borderBottomColor: '#1a3a2a', paddingBottom: 16, marginBottom: 24 },
  brandName: { fontSize: 18, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 1 },
  brandSub: { fontSize: 8, color: '#4a7a5a', marginTop: 4 },
  poTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', textAlign: 'right' },
  poSub: { fontSize: 9, color: '#4a7a5a', marginTop: 4, textAlign: 'right' },
  twoCol: { flexDirection: 'row', gap: 32, marginBottom: 24 },
  colLabel: { fontSize: 7, textTransform: 'uppercase', letterSpacing: 1, color: '#4a7a5a', fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  colVal: { fontSize: 9, color: '#1a3a2a', fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  colSub: { fontSize: 8, color: '#4a7a5a', marginBottom: 2 },
  dateRow: { flexDirection: 'row', marginBottom: 4 },
  dateKey: { fontSize: 8, color: '#4a7a5a', width: 100 },
  dateVal: { fontSize: 8, color: '#1a3a2a', fontFamily: 'Helvetica-Bold' },
  tableHead: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: '#1a3a2a', paddingBottom: 6, marginBottom: 4 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#d4e8d4', paddingVertical: 6 },
  thProduct: { flex: 3, fontSize: 7, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.8, color: '#1a3a2a' },
  thRight: { flex: 1, fontSize: 7, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.8, color: '#1a3a2a', textAlign: 'right' },
  tdProduct: { flex: 3, fontSize: 9, color: '#1a3a2a', fontFamily: 'Helvetica-Bold' },
  tdRight: { flex: 1, fontSize: 9, color: '#1a3a2a', textAlign: 'right' },
  tdUnit: { flex: 1, fontSize: 8, color: '#4a7a5a', textAlign: 'right' },
  summaryOuter: { alignItems: 'flex-end', marginTop: 8, marginBottom: 24 },
  summaryBox: { width: 220 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#d4e8d4' },
  summaryNetRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8 },
  summaryLabel: { fontSize: 9, color: '#4a7a5a' },
  summaryVal: { fontSize: 9, color: '#1a3a2a', fontFamily: 'Helvetica-Bold' },
  summaryNetLabel: { fontSize: 10, color: '#1a3a2a', fontFamily: 'Helvetica-Bold' },
  summaryNetVal: { fontSize: 14, color: '#1a3a2a', fontFamily: 'Helvetica-Bold' },
  deductVal: { fontSize: 9, color: '#b91c1c' },
  footer: { borderTopWidth: 1, borderTopColor: '#d4e8d4', paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 7.5, color: '#4a7a5a' },
})

function fmt(cents: number) {
  return `$${(cents / 100).toFixed(2)}`
}

function fmtDate(iso: string | null, fallback = 'TBC — see admin') {
  if (!iso) return fallback
  const d = new Date(iso)
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Australia/Sydney' })
}

export interface POItem {
  id: string
  quantity: number
  unit_price_cents: number
  subtotal_cents: number
  product_name: string
  product_unit: string
}

export interface POData {
  order_number: string
  created_at: string
  grower_fulfillment_date: string | null
  fulfillment_type: string | null
  hub_address: string | null
  farmer_business_name: string
  farmer_abn: string | null
  farmer_suburb: string | null
  farmer_state: string | null
  commission_rate: number
  items: POItem[]
}

export function PODocument({ po }: { po: POData }) {
  const gross = po.items.reduce((s, i) => s + i.subtotal_cents, 0)
  const commission = Math.round(gross * po.commission_rate)
  const net = gross - commission
  const commissionPct = Math.round(po.commission_rate * 100)

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brandName}>THE GREEN GUILD</Text>
            <Text style={styles.brandSub}>The Green Guild Market · ABN on file</Text>
          </View>
          <View>
            <Text style={styles.poTitle}>PURCHASE ORDER</Text>
            <Text style={styles.poSub}>PO for {po.order_number}</Text>
            <Text style={styles.poSub}>{fmtDate(po.created_at)}</Text>
          </View>
        </View>

        {/* To / Dates */}
        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <Text style={styles.colLabel}>To (Grower)</Text>
            <Text style={styles.colVal}>{po.farmer_business_name}</Text>
            {po.farmer_abn && <Text style={styles.colSub}>ABN: {po.farmer_abn}</Text>}
            {(po.farmer_suburb || po.farmer_state) && (
              <Text style={styles.colSub}>{[po.farmer_suburb, po.farmer_state].filter(Boolean).join(', ')}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.colLabel}>Dates</Text>
            <View style={styles.dateRow}>
              <Text style={styles.dateKey}>Order placed:</Text>
              <Text style={styles.dateVal}>{fmtDate(po.created_at)}</Text>
            </View>
            <View style={styles.dateRow}>
              <Text style={styles.dateKey}>Fulfil by:</Text>
              <Text style={styles.dateVal}>{fmtDate(po.grower_fulfillment_date)}</Text>
            </View>
            <View style={styles.dateRow}>
              <Text style={styles.dateKey}>Delivery method:</Text>
              <Text style={styles.dateVal}>
                {po.fulfillment_type === 'hub_pickup'
                  ? po.hub_address ? `Hub drop-off — ${po.hub_address}` : 'Hub drop-off (TBC)'
                  : 'Direct delivery to florist'}
              </Text>
            </View>
          </View>
        </View>

        {/* Line items */}
        <View style={styles.tableHead}>
          <Text style={styles.thProduct}>Product</Text>
          <Text style={styles.thRight}>Qty</Text>
          <Text style={styles.thRight}>Unit</Text>
          <Text style={styles.thRight}>Unit Price</Text>
          <Text style={styles.thRight}>Subtotal</Text>
        </View>
        {po.items.map(item => (
          <View key={item.id} style={styles.tableRow}>
            <Text style={styles.tdProduct}>{item.product_name}</Text>
            <Text style={styles.tdRight}>{item.quantity}</Text>
            <Text style={styles.tdUnit}>{item.product_unit}</Text>
            <Text style={styles.tdRight}>{fmt(item.unit_price_cents)}</Text>
            <Text style={styles.tdRight}>{fmt(item.subtotal_cents)}</Text>
          </View>
        ))}

        {/* Commission summary */}
        <View style={styles.summaryOuter}>
          <View style={styles.summaryBox}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Gross value</Text>
              <Text style={styles.summaryVal}>{fmt(gross)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Platform commission ({commissionPct}%)</Text>
              <Text style={styles.deductVal}>− {fmt(commission)}</Text>
            </View>
            <View style={styles.summaryNetRow}>
              <Text style={styles.summaryNetLabel}>Net payable to you</Text>
              <Text style={styles.summaryNetVal}>{fmt(net)}</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>The Green Guild Market · This document constitutes a purchase order between The Green Guild and the above grower.</Text>
          <Text style={styles.footerText}>PO #{po.order_number}</Text>
        </View>
      </Page>
    </Document>
  )
}
