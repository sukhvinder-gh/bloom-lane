import { NextResponse, type NextRequest } from 'next/server'

// Token refresh is handled by the browser-side Supabase client automatically.
// Server-side auth reads the session cookie directly via getSessionUserFromCookie()
// and works regardless of token expiry — so no server-side refresh is needed here.
// Previously calling getSession() here caused Azure network failures to clear the
// session cookies via setAll(), which logged users out mid-session.
export function middleware(_request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
