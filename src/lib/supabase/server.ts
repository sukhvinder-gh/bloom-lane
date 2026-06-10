import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Returns the logged-in user identity for server component layouts/pages.
//
// Strategy:
// 1. getSession() — fast, reads JWT from cookie, no network call for valid tokens.
//    Covers the common case (fresh sign-in, active session).
// 2. If getSession() returns null (token expired AND refresh network call failed on
//    Azure), fall back to parsing the raw cookie so an expired-but-real session
//    doesn't wrongly redirect to login.
export async function getSessionUserFromCookie(): Promise<{ id: string; email: string } | null> {
  // --- primary: use the SSR client (handles all encoding, no network for valid tokens) ---
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => { /* server component — writes are no-ops */ },
        },
      }
    )
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.id) {
      return { id: session.user.id, email: session.user.email ?? '' }
    }
  } catch {
    // fall through to cookie fallback
  }

  // --- fallback: direct cookie parse for expired-token + failed-refresh scenario ---
  try {
    const cookieStore = await cookies()
    const projectRef = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
      .replace('https://', '').split('.')[0]
    if (!projectRef) return null

    // Supabase SSR chunks the session across multiple cookies when it exceeds ~3600 chars
    let raw = cookieStore.get(`sb-${projectRef}-auth-token`)?.value
    if (!raw) {
      const parts: string[] = []
      for (let i = 0; i < 10; i++) {
        const c = cookieStore.get(`sb-${projectRef}-auth-token.${i}`)
        if (!c) break
        parts.push(c.value)
      }
      raw = parts.join('') || undefined
    }
    if (!raw) return null

    // @supabase/ssr encodes cookie values as base64url (no-padding variant)
    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - b64.length % 4) % 4)
    let parsed: any
    try {
      parsed = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'))
    } catch {
      // Older/plain-JSON format fallback
      parsed = JSON.parse(raw)
    }

    const userId = parsed?.user?.id as string | undefined
    if (!userId) return null
    return { id: userId, email: (parsed?.user?.email ?? '') as string }
  } catch {
    return null
  }
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // Ignore — called from Server Component, cookies can't be set
          }
        },
      },
    }
  )
}

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

// Alias for backwards compatibility — many files import { createClient } from here
export { createSupabaseServerClient as createClient }