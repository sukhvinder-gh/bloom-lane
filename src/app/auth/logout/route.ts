import { createSupabaseServerClient, deleteAuthCookies } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  // Explicitly wipe session cookies — createSupabaseServerClient's setAll skips
  // empty values to prevent accidental session clearing in API routes, so we
  // must delete them here manually.
  await deleteAuthCookies()
  const reqUrl = new URL(request.url)
  const host  = request.headers.get('x-forwarded-host')  ?? reqUrl.host
  const proto = request.headers.get('x-forwarded-proto') ?? reqUrl.protocol.replace(':', '')
  return NextResponse.redirect(new URL('/auth/login', `${proto}://${host}`), { status: 302 })
}
