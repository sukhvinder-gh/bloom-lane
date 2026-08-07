import { NextResponse, type NextRequest } from 'next/server'

// Minimal pass-through — no Supabase auth code here.
// Auth is checked in each layout's server component via getSessionUserFromCookie().
// Token refresh is handled client-side by createBrowserClient (autoRefreshToken: true).
//
// The one thing added here: forwarding the requested path+query as headers,
// since a server layout has no other way to read the URL that was actually
// requested (headers() alone doesn't expose it) — used by layouts that need
// to redirect unauthenticated visitors back to where they were headed
// (e.g. /marketplace?farmer_id=X) instead of dropping the destination.
export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', request.nextUrl.pathname)
  requestHeaders.set('x-search', request.nextUrl.search)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
