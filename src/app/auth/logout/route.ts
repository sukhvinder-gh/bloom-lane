import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  // request.url is the internal container address on Azure App Service.
  // x-forwarded-host/proto contain the actual public hostname.
  const reqUrl = new URL(request.url)
  const host  = request.headers.get('x-forwarded-host')  ?? reqUrl.host
  const proto = request.headers.get('x-forwarded-proto') ?? reqUrl.protocol.replace(':', '')
  return NextResponse.redirect(new URL('/auth/login', `${proto}://${host}`), { status: 302 })
}
