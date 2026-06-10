import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { cache } from 'react'

// Memoised per React render pass so all layouts/pages in one request share the result.
export const getSessionUserFromCookie = cache(async (): Promise<{ id: string; email: string } | null> => {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        // Strict no-op: server components cannot write cookies. Any setAll call
        // (e.g. expiry cleanup inside getSession) is silently dropped, so the
        // browser's session cookies are never cleared by a server render.
        setAll: () => {},
      },
    }
  )

  // Strategy 1: getSession() — reads cookie locally, no network call.
  // Works for non-expired tokens.
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.id) {
      return { id: session.user.id, email: session.user.email ?? '' }
    }
  } catch {}

  // Strategy 2: access @supabase/ssr's storage adapter directly.
  // getSession() returns null for expired tokens AND clears its in-memory state,
  // but because setAll is no-op the cookie itself was never deleted. Calling
  // storage.getItem() re-reads from cookieStore (immutable request snapshot) and
  // decodes the session using @supabase/ssr's own decoder — no expiry check here.
  // This lets users continue navigating even when the access token has just expired
  // (the browser client will refresh the token in the background).
  try {
    const auth = supabase.auth as any
    const storageKey: string | undefined = auth.storageKey
    const storage: { getItem?: (key: string) => unknown } | undefined = auth.storage

    if (storage?.getItem && storageKey) {
      const raw = await Promise.resolve(storage.getItem(storageKey))
      if (raw && typeof raw === 'string') {
        const parsed = JSON.parse(raw)
        if (parsed?.user?.id) {
          return { id: parsed.user.id as string, email: (parsed.user.email ?? '') as string }
        }
        // Decode user ID from the access_token JWT payload (sub claim)
        if (parsed?.access_token) {
          const parts = (parsed.access_token as string).split('.')
          if (parts.length === 3) {
            const payload = JSON.parse(
              Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
            )
            if (payload?.sub) {
              return { id: payload.sub as string, email: (payload.email ?? '') as string }
            }
          }
        }
      }
    }
  } catch {}

  return null
})

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
            // Skip empty/delete values — @supabase/ssr calls setAll({value:'',maxAge:0})
            // when a token expires inside getSession(). In Route Handlers cookies CAN
            // be written, so without this filter those Set-Cookie responses would wipe
            // the browser's session cookie and log everyone out on their next navigation.
            // Explicit sign-out clears cookies directly via deleteAuthCookies().
            cookiesToSet
              .filter(({ value }) => value && value.length > 0)
              .forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // Silently ignored when called from a Server Component (can't set cookies there)
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

// Deletes all Supabase session cookies from the response.
// Call this explicitly in sign-out route handlers AFTER supabase.auth.signOut(),
// because createSupabaseServerClient's setAll skips empty values (to prevent
// accidental session wiping from expired-token getSession() calls in API routes).
export async function deleteAuthCookies() {
  const cookieStore = await cookies()
  const projectRef = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
    .replace('https://', '').split('.')[0]
  if (!projectRef) return
  const prefix = `sb-${projectRef}-auth-token`
  cookieStore.getAll()
    .filter(c => c.name === prefix || c.name.startsWith(`${prefix}.`))
    .forEach(c => {
      try { cookieStore.delete(c.name) } catch {}
    })
}

// Alias for backwards compatibility — many files import { createClient } from here
export { createSupabaseServerClient as createClient }
