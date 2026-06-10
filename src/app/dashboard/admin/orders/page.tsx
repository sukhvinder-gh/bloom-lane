import { createAdminClient } from '@/lib/supabase/server'
import OrdersContent from './OrdersContent'

export default async function AdminOrdersPage() {
  const admin = createAdminClient()

  const [{ data: initialOrders }, { data: rejectedPOs }] = await Promise.all([
    admin
      .from('orders')
      .select('*, profiles!orders_buyer_id_fkey(full_name), order_items(*, products(name, unit), farmers(business_name, brand_color))')
      .order('created_at', { ascending: false })
      .limit(100),
    admin
      .from('purchase_orders')
      .select('*, farmers(business_name), orders(order_number)')
      .eq('status', 'rejected')
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return (
    <OrdersContent
      initialOrders={initialOrders || []}
      initialRejectedPOs={rejectedPOs || []}
    />
  )
}
