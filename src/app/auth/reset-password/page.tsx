'use client'
import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

// The reset email now delivers a 6-digit code ({{ .Token }} in the Supabase
// template) rather than a clickable link — Supabase's recovery link is
// single-use, and Gmail (and most corporate mail gateways) silently
// pre-fetches links in incoming email to scan them for safety, which burns
// the token before the user ever clicks it. A code sitting as plain text
// in the email body can't be "visited" by a scanner, so it sidesteps the
// problem entirely.
function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState(searchParams.get('email') || '')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [verified, setVerified] = useState(false)

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' })
    if (error) {
      setError(
        error.message.toLowerCase().includes('expired') || error.message.toLowerCase().includes('invalid')
          ? 'That code is incorrect or has expired. Double-check it, or request a new one.'
          : error.message
      )
      setLoading(false)
      return
    }
    setVerified(true)
    setLoading(false)
  }

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
        <p className="type-label" style={{ color: 'var(--moss)', marginBottom: '2.5rem' }}>
          {verified ? 'Enter your new password below.' : 'Enter the code we emailed you.'}
        </p>

        {error && (
          <div className="badge badge-red" style={{ width: '100%', padding: '0.875rem 1rem', borderRadius: '0.75rem', marginBottom: '1.5rem', justifyContent: 'flex-start', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
            ⚠ {error}
          </div>
        )}

        {!verified ? (
          <form onSubmit={handleVerifyCode} style={{ display: 'grid', gap: '1.25rem' }}>
            <div>
              <label className="label">Email address</label>
              <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div>
              <label className="label">Code from email</label>
              <input
                className="input"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                placeholder="12345678"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                required
                autoFocus
                style={{ letterSpacing: '0.3em', textAlign: 'center', fontSize: '1.25rem', width: '100%' }}
              />
            </div>
            <button type="submit" className="btn btn-forest" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading || !email || code.length < 6}>
              {loading ? 'Verifying...' : 'Verify code'}
            </button>
            <p className="type-label-sm" style={{ textAlign: 'center', color: 'var(--moss)' }}>
              Didn&apos;t get a code?{' '}
              <Link href="/auth/forgot-password" style={{ color: 'var(--navy)', textDecoration: 'underline', textUnderlineOffset: '3px' }}>Request a new one</Link>
            </p>
          </form>
        ) : (
          <form onSubmit={handleReset} style={{ display: 'grid', gap: '1.25rem' }}>
            <div>
              <label className="label">New password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input" type={showPassword ? 'text' : 'password'} placeholder="Min. 6 characters"
                  value={password} onChange={e => setPassword(e.target.value)} required autoComplete="new-password"
                  style={{ paddingRight: '2.75rem', width: '100%' }}
                />
                <button
                  type="button" onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700, color: 'var(--moss)', padding: '0.375rem 0.5rem' }}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <div>
              <label className="label">Confirm password</label>
              <input className="input" type={showPassword ? 'text' : 'password'} placeholder="Repeat password" value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password" />
            </div>
            <button type="submit" className="btn btn-forest" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
              {loading ? 'Updating...' : 'Set new password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--cream)' }} />}>
      <ResetPasswordForm />
    </Suspense>
  )
}
