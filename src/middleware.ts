import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // Keep Supabase client alive so it can refresh tokens via setAll
  // (writes new cookies into supabaseResponse when access token expires)
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
            )
          },
        },
      }
    )
    // Fire-and-forget: just lets Supabase refresh the token if needed
    await supabase.auth.getSession()
  } catch {
    // Ignore — token refresh is best-effort; layouts do the real auth check
  }

  const { pathname } = request.nextUrl

  // Skip API routes, static files, and browser probes
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/.well-known') ||
    pathname.includes('chrome') ||
    pathname.includes('devtools') ||
    pathname.endsWith('.json') ||
    pathname.endsWith('.map')
  ) return supabaseResponse

  // Public routes — always accessible
  const isPublic =
    pathname === '/' ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/marketplace') ||
    pathname.startsWith('/growers')

  if (isPublic) return supabaseResponse

  // Auth gate: check for the Supabase session cookie directly.
  // Avoids the Supabase client call which can return null on Azure despite
  // valid cookies (chunking / cold-start issues). Layouts use getUser() for
  // proper server-side verification after this pass-through.
  const allCookies = request.cookies.getAll()
  const hasSession = allCookies.some(c =>
    c.name.startsWith('sb-') && c.name.includes('auth-token')
  )

  if (!hasSession) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/checkout')) {
      url.searchParams.set('redirect', pathname)
    }
    return NextResponse.redirect(url)
  }

  // Don't show login page to already-authenticated users
  if (pathname === '/auth/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
