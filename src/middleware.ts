import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          )
        },
      },
    }
  )

  // getUser() makes a live Supabase network call on every request.
  // If it times out (Azure cold-start, transient network), fall back to
  // getSession() which reads the JWT from cookies locally without a round-trip.
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] | null = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    try {
      const { data } = await supabase.auth.getSession()
      user = data.session?.user ?? null
    } catch {
      // both failed — treat as no session; page-level auth will redirect if needed
    }
  }
  const { pathname } = request.nextUrl

  // Skip ALL API routes — they handle their own auth
  if (pathname.startsWith('/api/')) return supabaseResponse

  // Skip browser/extension probes
  if (
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

  // Redirect unauthenticated users to login
  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/checkout')) {
      url.searchParams.set('redirect', pathname)
    }
    return NextResponse.redirect(url)
  }

  // Redirect logged-in users away from login page only
  if (user && pathname === '/auth/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}