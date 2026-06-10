import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Returns the logged-in user identity for server component layouts/pages.
//
// Strategy:
// 1. Parse the session cookie directly — zero network calls, works for any token age.
//    @supabase/ssr stores the session as base64url-encoded JSON (potentially chunked).
//    Multiple decode strategies handle version differences.
// 2. If cookie parse fails, fall back to getSession() via the SSR client as a last resort.
export async function getSessionUserFromCookie(): Promise<{ id: string; email: string } | null> {
  const cookieStore = await cookies()

  // --- primary: parse cookie directly, no network call ---
  try {
    const projectRef = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
      .replace('https://', '').split('.')[0]

    if (projectRef) {
      // Reassemble chunked cookies (@supabase/ssr splits large values across .0 .1 .2 ...)
      let raw = cookieStore.get(`sb-${projectRef}-auth-token`)?.value
      if (!raw) {
        const parts: string[] = []
        for (let i = 0; i < 10; i++) {
          const c = cookieStore.get(`sb-${projectRef}-auth-token.${i}`)
          if (!c) break
          parts.push(c.value)
        }
        if (parts.length > 0) raw = parts.join('')
      }

      if (raw) {
        let parsed: Record<string, any> | null = null

        // Decode strategy 1: base64url-encoded JSON (current @supabase/ssr format)
        try {
          const b64 = raw.replace(/-/g, '+').replace(/_/g, '/')
          const padded = b64 + '='.repeat((4 - b64.length % 4) % 4)
          parsed = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'))
        } catch { /* try next */ }

        // Decode strategy 2: URL-encoded JSON
        if (!parsed?.user?.id) {
          try { parsed = JSON.parse(decodeURIComponent(raw)) } catch { /* try next */ }
        }

        // Decode strategy 3: plain JSON
        if (!parsed?.user?.id) {
          try { parsed = JSON.parse(raw) } catch { /* try next */ }
        }

        const userId = parsed?.user?.id as string | undefined
        if (userId) {
          return { id: userId, email: (parsed?.user?.email ?? '') as string }
        }

        // Decode strategy 4: extract from the access_token JWT payload (sub = user id)
        if (parsed?.access_token) {
          try {
            const jwtParts = (parsed.access_token as string).split('.')
            if (jwtParts.length === 3) {
              const payload = JSON.parse(
                Buffer.from(jwtParts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
              )
              if (payload?.sub) {
                return { id: payload.sub as string, email: (payload.email ?? '') as string }
              }
            }
          } catch { /* fall through */ }
        }
      }
    }
  } catch { /* fall through to SSR client */ }

  // --- fallback: SSR client getSession() — makes a network call when token is expired ---
  try {
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
  } catch { /* ignore */ }

  return null
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