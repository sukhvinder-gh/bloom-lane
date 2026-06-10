// TEMPORARY DEBUG ROUTE — remove after auth issue is diagnosed
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSessionUserFromCookie } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()

  const projectRef = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')
    .replace('https://', '').split('.')[0]

  // Which auth cookies exist and how long are their values
  const authCookies = allCookies
    .filter(c => c.name.startsWith('sb-') && c.name.includes('auth-token'))
    .map(c => ({
      name: c.name,
      valueLength: c.value.length,
      valuePrefix: c.value.slice(0, 30),  // first 30 chars to identify encoding
    }))

  // Build a strict no-op SSR client for inspection
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},  // strict no-op — never modifies cookies
      },
    }
  )

  // Test 1: getSession()
  let sessionResult: any = null
  let sessionError: string | null = null
  try {
    const { data, error } = await supabase.auth.getSession()
    sessionResult = data.session
      ? { userId: data.session.user.id, email: data.session.user.email, expiresAt: data.session.expires_at }
      : null
    sessionError = error?.message ?? null
  } catch (e: any) {
    sessionError = e?.message ?? 'threw'
  }

  // Test 2: storage.getItem() bypass
  let storageResult: any = null
  let storageKey: string | null = null
  let storageError: string | null = null
  try {
    const auth = supabase.auth as any
    storageKey = auth.storageKey ?? null
    const storage = auth.storage
    if (storage?.getItem && storageKey) {
      const raw = await Promise.resolve(storage.getItem(storageKey))
      if (raw && typeof raw === 'string') {
        const parsed = JSON.parse(raw)
        storageResult = {
          hasUser: !!parsed?.user?.id,
          userId: parsed?.user?.id ?? null,
          hasAccessToken: !!parsed?.access_token,
          rawLength: raw.length,
        }
      } else {
        storageResult = { raw: raw ?? 'null/undefined' }
      }
    } else {
      storageResult = { reason: 'storage or storageKey not accessible', storageType: typeof storage, storageKeyValue: storageKey }
    }
  } catch (e: any) {
    storageError = e?.message ?? 'threw'
  }

  // Test 3: getSessionUserFromCookie() — the actual function used by layouts
  let mainFnResult: any = null
  let mainFnError: string | null = null
  try {
    const user = await getSessionUserFromCookie()
    mainFnResult = user ? { id: user.id, email: user.email } : null
  } catch (e: any) {
    mainFnError = e?.message ?? 'threw'
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    projectRef,
    authCookiesFound: authCookies.length,
    authCookies,
    totalCookies: allCookies.length,
    test1_getSession: { result: sessionResult, error: sessionError },
    test2_storageBypass: { storageKey, result: storageResult, error: storageError },
    test3_mainFunction: { result: mainFnResult, error: mainFnError },
    verdict: mainFnResult
      ? '✅ AUTHENTICATED — getSessionUserFromCookie() returned a user'
      : '❌ NOT AUTHENTICATED — getSessionUserFromCookie() returned null',
  })
}
