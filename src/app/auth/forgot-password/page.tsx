'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const supabase = createClient()
    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/auth/reset-password`
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) { setError(error.message); setLoading(false); return }
    setSent(true)
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', padding: '2rem' }}>
      <div className="reveal" style={{ width: '100%', maxWidth: '24rem' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', marginBottom: '3rem' }}>
          <div style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', color: 'var(--cream)', fontSize: '1rem' }}>B</div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '-0.03em' }}>Bloom Lane</span>
        </Link>

        {sent ? (
          <div>
            <div style={{ width: '3rem', height: '3rem', borderRadius: '50%', background: 'var(--sage)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', marginBottom: '1.5rem' }}>✓</div>
            <h1 className="type-subheading" style={{ color: 'var(--navy)', marginBottom: '0.5rem' }}>Check your email</h1>
            <p className="type-label" style={{ color: 'var(--moss)', marginBottom: '2rem' }}>
              We sent a reset link to <strong>{email}</strong>. Click it to set a new password.
            </p>
            <Link href="/auth/login" style={{ color: 'var(--navy)', fontSize: '0.875rem', textDecoration: 'underline', textUnderlineOffset: '3px' }}>
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="type-subheading" style={{ color: 'var(--navy)', marginBottom: '0.5rem' }}>Forgot password?</h1>
            <p className="type-label" style={{ color: 'var(--moss)', marginBottom: '2.5rem' }}>
              Enter your email and we&apos;ll send you a reset link.{' '}
              <Link href="/auth/login" style={{ color: 'var(--navy)', textDecoration: 'underline', textUnderlineOffset: '3px' }}>Back to sign in</Link>
            </p>

            {error && (
              <div className="badge badge-red" style={{ width: '100%', padding: '0.875rem 1rem', borderRadius: '0.75rem', marginBottom: '1.5rem', justifyContent: 'flex-start', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                ⚠ {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1.25rem' }}>
              <div>
                <label className="label">Email address</label>
                <input className="input" type="email" placeholder="you@yourbusiness.com.au" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <button type="submit" className="btn btn-forest" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
