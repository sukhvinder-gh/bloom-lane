// src/app/api/debug/route.ts - TEMPORARY DEBUG ROUTE
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ 
        step: 'auth',
        error: 'No user on server side',
        authError: authError?.message 
      })
    }

    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, order_number, status, buyer_id')
      .eq('buyer_id', user.id)

    return NextResponse.json({
      step: 'done',
      user_id: user.id,
      user_email: user.email,
      orders_count: orders?.length ?? 0,
      orders,
      orders_error: ordersError?.message ?? null,
    })
  } catch (err: any) {
    return NextResponse.json({ 
      step: 'crash',
      error: err?.message ?? 'Unknown error' 
    }, { status: 500 })
  }
}
