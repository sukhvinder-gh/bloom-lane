import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  const url = new URL('/auth/login', request.url)
  return NextResponse.redirect(url, { status: 302 })
}
