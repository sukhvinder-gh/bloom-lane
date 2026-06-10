import { createSupabaseServerClient, deleteAuthCookies } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  await deleteAuthCookies()
  const reqUrl = new URL(request.url)
  const host  = request.headers.get('x-forwarded-host')  ?? reqUrl.host
  const proto = request.headers.get('x-forwarded-proto') ?? reqUrl.protocol.replace(':', '')
  return NextResponse.redirect(new URL('/auth/login', `${proto}://${host}`), { status: 302 })
}