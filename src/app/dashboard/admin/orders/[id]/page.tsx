import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import AdminOrderDetail from './AdminOrderDetail'

export const dynamic = 'force-dynamic'

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()

  const { data: order, error } = await admin
    .from('orders')
    .select(`
      *,
      profiles!orders_buyer_id_fkey(id, full_name, email, role),
      order_items(
        id, quantity, unit_price_cents, subtotal_cents, is_b2b, farmer_id,
        products(name, unit, category, is_gst_free),
        farmers(id, business_name, email, abn, suburb, state)
      )
    `)
    .eq('id', id)
    .single()

  if (error || !order) notFound()

  return <AdminOrderDetail order={order} />
}
