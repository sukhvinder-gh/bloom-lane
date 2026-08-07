'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)

  // Most common cause of an "invalid" link on the very first click: it's a
  // PKCE code, which can only be exchanged in the same browser that
  // requested the reset (that's where the matching code_verifier lives) —
  // opening the email on a different device/browser fails immediately,
  // regardless of real expiry.
  const CROSS_DEVICE_HINT = "This reset link didn't work — this usually happens when it's opened in a different browser or device than the one you requested it from. Try requesting a new link and opening it on the same device, or copy the full link into that browser."

  useEffect(() => {
    const supabase = createClient()
    const code = searchParams.get('code')
    const serverError = searchParams.get('error_description') || searchParams.get('error')

    if (serverError) {
      setError(decodeURIComponent(serverError.replace(/\+/g, ' ')))
      return
    }

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) setError(CROSS_DEVICE_HINT)
        else setReady(true)
      })
    } else {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) setReady(true)
        else setError(CROSS_DEVICE_HINT)
      })
    }
  }, [searchParams])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) return setError('Passwords do not match')
    if (password.length < 6) return setError('Password must be at least 6 characters')
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/auth/login?reset=success')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div className="reveal" style={{ width: '100%', maxWidth: '24rem' }}>
        <h1 className="type-subheading" style={{ color: 'var(--navy)', marginBottom: '0.5rem' }}>Reset password</h1>
        <p className="type-label" style={{ color: 'var(--moss)', marginBottom: '2.5rem' }}>Enter your new password below.</p>

        {error && (
          <div className="badge badge-red" style={{ width: '100%', padding: '0.875rem 1rem', borderRadius: '0.75rem', marginBottom: '1.5rem', justifyContent: 'flex-start', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
            ⚠ {error}
            {!ready && (
              <a href="/auth/forgot-password" style={{ marginLeft: '0.5rem', color: 'inherit', textDecoration: 'underline' }}>Request a new link</a>
            )}
          </div>
        )}

        <form onSubmit={handleReset} style={{ display: 'grid', gap: '1.25rem' }}>
          <div>
            <label className="label">New password</label>
            <input className="input" type="password" placeholder="Min. 6 characters" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password" />
          </div>
          <div>
            <label className="label">Confirm password</label>
            <input className="input" type="password" placeholder="Repeat password" value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password" />
          </div>
          <button type="submit" className="btn btn-forest" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading || !ready}>
            {loading ? 'Updating...' : 'Set new password'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
