import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// Reads user identity directly from the Supabase session cookie — zero network calls.
// Works even when the access token is expired (avoids the refresh network call that
// fails intermittently on Azure). Use this for "is the user logged in" checks in
// server component layouts.
export async function getSessionUserFromCookie(): Promise<{ id: string; email: string } | null> {
  try {
    const cookieStore = await cookies()
    const projectRef = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
      .replace('https://', '').split('.')[0]
    if (!projectRef) return null

    // Reassemble potentially chunked Supabase session cookie
    let raw = cookieStore.get(`sb-${projectRef}-auth-token`)?.value
    if (!raw) {
      const parts: string[] = []
      for (let i = 0; i < 10; i++) {
        const chunk = cookieStore.get(`sb-${projectRef}-auth-token.${i}`)
        if (!chunk) break
        parts.push(chunk.value)
      }
      raw = parts.join('') || undefined
    }
    if (!raw) return null

    // The cookie value is JSON.stringify(session) where session has .user.id
    const parsed = JSON.parse(raw)
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