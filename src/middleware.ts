import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Proactively refresh Supabase tokens so server components see fresh cookies.
// setAll only applies updates with real values — empty/delete calls (which happen
// when a refresh fails on Azure) are ignored, preserving the existing session.
export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
            // Skip empty/short values — those are deletions from a failed refresh.
            // We only want to save successfully refreshed tokens, never clear the session.
            const updates = cookiesToSet.filter(({ value }) => value && value.length > 10)
            if (updates.length === 0) return
            updates.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request })
            updates.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
            )
          },
        },
      }
    )
    await supabase.auth.getSession()
  } catch {
    // ignore — token refresh is best-effort
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
