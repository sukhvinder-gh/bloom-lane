import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { cache } from 'react'

// Memoised per React render pass so all layouts/pages in one request share one getUser() call.
export const getSessionUserFromCookie = cache(async (): Promise<{ id: string; email: string } | null> => {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )

  // getUser() verifies the JWT with the Supabase Auth server — secure and warning-free.
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.id) return { id: user.id, email: user.email ?? '' }
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
