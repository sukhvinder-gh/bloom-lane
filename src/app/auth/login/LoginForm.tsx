'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/dashboard'
  const resetSuccess = searchParams.get('reset') === 'success'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  // A confirmation/reset link that failed to exchange for a session lands
  // here via /auth/callback?error=invalid_link — most often because it was
  // opened in a different browser/device than the one the email was
  // requested from. Surface that instead of a silent, unexplained landing.
  const [error, setError] = useState(() =>
    searchParams.get('error') === 'invalid_link'
      ? "That link didn't work — this usually happens when it's opened in a different browser or device than the one you signed up or requested it from. Try opening the email and clicking the link on the same device, or request a new one below."
      : ''
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push(redirectTo); router.refresh()
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'transparent' }}>
      {/* Left — forest panel */}
      <div className="section-forest" style={{
        display: 'none', flex: '0 0 48%',
        padding: '4rem', flexDirection: 'column', justifyContent: 'space-between',
        position: 'relative', overflow: 'hidden',
      }} data-lg="flex">
        <style>{`@media (min-width: 1024px) { [data-lg="flex"] { display: flex !important; } }`}</style>
        <div style={{ position: 'absolute', top: '-20%', right: '-20%', width: '70%', height: '70%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(163,177,138,0.15), transparent)', pointerEvents: 'none' }} />
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none' }}>
          <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.625rem', background: 'var(--sage)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', color: 'var(--navy)', fontSize: '1.1rem' }}>T</div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', color: 'var(--cream)', textTransform: 'uppercase', letterSpacing: '-0.03em' }}>The Green Guild</span>
        </Link>
        <div>
          <h2 className="type-heading reveal" style={{ color: 'var(--cream)', marginBottom: '1.5rem' }}>
            Fresh from<br />the farm,<br />fast.
          </h2>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {['No middlemen markup', 'Automated GST invoicing', 'Photo proof of delivery', '6-hour dispute protection'].map((f, i) => (
              <div key={f} className={`reveal reveal-d${i + 1}`} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ width: '1.375rem', height: '1.375rem', borderRadius: '50%', background: 'var(--sage)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.625rem', flexShrink: 0, color: 'var(--navy)', fontWeight: 700 }}>✓</div>
                <span className="type-label" style={{ color: 'rgba(254,250,224,0.7)' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>
        <span className="type-label-sm" style={{ color: 'var(--moss)' }}>Australia's B2B Agri Marketplace</span>
      </div>

      {/* Right — form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem 2rem' }}>
        <div className="reveal" style={{ width: '100%', maxWidth: '24rem' }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', marginBottom: '3rem' }}>
            <div style={{ width: '2rem', height: '2rem', borderRadius: '0.5rem', background: 'var(--forest)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', color: 'var(--cream)', fontSize: '1rem' }}>T</div>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--navy)', textTransform: 'uppercase', letterSpacing: '-0.03em' }}>The Green Guild</span>
          </Link>
          <h1 className="type-subheading" style={{ color: 'var(--navy)', marginBottom: '0.5rem' }}>Welcome back</h1>
          <p className="type-label" style={{ color: 'var(--moss)', marginBottom: '2.5rem' }}>
            No account?{' '}
            <Link href="/auth/register" style={{ color: 'var(--navy)', textDecoration: 'underline', textUnderlineOffset: '3px' }}>Sign up</Link>
          </p>
          {resetSuccess && (
            <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '0.75rem', padding: '0.875rem 1rem', marginBottom: '1.5rem', fontSize: '0.75rem', color: '#166534', letterSpacing: '0.05em' }}>
              ✓ Password updated — sign in with your new password
            </div>
          )}
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
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label className="label" style={{ margin: 0 }}>Password</label>
                <Link href="/auth/forgot-password" style={{ fontSize: '0.75rem', color: 'var(--moss)', textDecoration: 'underline', textUnderlineOffset: '3px' }}>Forgot password?</Link>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  className="input" type={showPassword ? 'text' : 'password'} placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password"
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
            <button type="submit" className="btn btn-forest" style={{ width: '100%', marginTop: '0.5rem' }} disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
          <p className="type-label-sm" style={{ color: 'var(--moss)', textAlign: 'center', marginTop: '2rem' }}>
            By signing in you agree to our Terms of Service
          </p>
        </div>
      </div>
    </div>
  )
}
