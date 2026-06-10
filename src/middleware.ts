import { NextResponse, type NextRequest } from 'next/server'

// Minimal pass-through — no Supabase auth code here.
// Auth is checked in each layout's server component via getSessionUserFromCookie().
// Token refresh is handled client-side by createBrowserClient (autoRefreshToken: true).
export function middleware(request: NextRequest) {
  return NextResponse.next({ request })
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
