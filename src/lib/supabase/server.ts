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
  const allCookies = cookieStore.getAll()

  const projectRef = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
    .replace('https://', '').split('.')[0]

  // Diagnostic: log cookie state on every call so Azure log stream shows what's present
  console.log('[auth] projectRef:', projectRef)
  console.log('[auth] all cookie names:', allCookies.map(c => c.name).join(', '))

  // --- primary: parse cookie directly, no network call ---
  try {
    if (projectRef) {
      // Reassemble chunked cookies (@supabase/ssr splits large values across .0 .1 .2 ...)
      let raw = cookieStore.get(`sb-${projectRef}-auth-token`)?.value
      if (raw) {
        console.log('[auth] found non-chunked cookie, length:', raw.length)
      } else {
        const parts: string[] = []
        for (let i = 0; i < 10; i++) {
          const c = cookieStore.get(`sb-${projectRef}-auth-token.${i}`)
          if (!c) break
          parts.push(c.value)
        }
        if (parts.length > 0) {
          raw = parts.join('')
          console.log('[auth] found', parts.length, 'chunks, total length:', raw.length)
        } else {
          console.log('[auth] no session cookie found at all')
        }
      }

      if (raw) {
        // Strategy 0: raw value is itself a JWT (3 dot-separated base64url parts)
        const dotParts = raw.split('.')
        if (dotParts.length === 3) {
          try {
            const payload = JSON.parse(
              Buffer.from(dotParts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
            )
            if (payload?.sub) {
              console.log('[auth] strategy 0 (raw JWT) succeeded')
              return { id: payload.sub as string, email: (payload.email ?? '') as string }
            }
          } catch { /* try next */ }
        }

        let parsed: Record<string, any> | null = null

        // Strategy 1: base64url-encoded JSON
        try {
          const b64 = raw.replace(/-/g, '+').replace(/_/g, '/')
          const padded = b64 + '='.repeat((4 - b64.length % 4) % 4)
          parsed = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'))
          console.log('[auth] strategy 1 (base64url) parsed, has user.id:', !!parsed?.user?.id)
        } catch (e) {
          console.log('[auth] strategy 1 (base64url) failed:', String(e).slice(0, 80))
        }

        // Strategy 2: URL-encoded JSON
        if (!parsed?.user?.id) {
          try {
            parsed = JSON.parse(decodeURIComponent(raw))
            console.log('[auth] strategy 2 (url-encoded) parsed, has user.id:', !!parsed?.user?.id)
          } catch (e) {
            console.log('[auth] strategy 2 (url-encoded) failed:', String(e).slice(0, 80))
          }
        }

        // Strategy 3: plain JSON
        if (!parsed?.user?.id) {
          try {
            parsed = JSON.parse(raw)
            console.log('[auth] strategy 3 (plain JSON) parsed, has user.id:', !!parsed?.user?.id)
          } catch (e) {
            console.log('[auth] strategy 3 (plain JSON) failed:', String(e).slice(0, 80))
          }
        }

        const userId = parsed?.user?.id as string | undefined
        if (userId) {
          console.log('[auth] returning user from parsed session')
          return { id: userId, email: (parsed?.user?.email ?? '') as string }
        }

        // Strategy 4: decode access_token JWT payload
        if (parsed?.access_token) {
          try {
            const jwtParts = (parsed.access_token as string).split('.')
            if (jwtParts.length === 3) {
              const payload = JSON.parse(
                Buffer.from(jwtParts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
              )
              if (payload?.sub) {
                console.log('[auth] strategy 4 (JWT payload) succeeded')
                return { id: payload.sub as string, email: (payload.email ?? '') as string }
              }
            }
          } catch { /* fall through */ }
        }

        console.log('[auth] all cookie parse strategies failed, raw prefix:', raw.slice(0, 30))
      }
    }
  } catch (e) {
    console.log('[auth] primary path threw:', String(e).slice(0, 120))
  }

  // --- fallback: SSR client getSession() — makes a network call when token is expired ---
  console.log('[auth] trying SSR client getSession fallback')
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
      console.log('[auth] SSR getSession succeeded')
      return { id: session.user.id, email: session.user.email ?? '' }
    }
    console.log('[auth] SSR getSession returned no session')
  } catch (e) {
    console.log('[auth] SSR getSession threw:', String(e).slice(0, 120))
  }

  console.log('[auth] returning null — user will be redirected to login')
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