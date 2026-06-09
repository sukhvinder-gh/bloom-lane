import Link from 'next/link'
import { isMarketOpen } from '@/lib/utils/timezone'

export default function HomePage() {
  const marketOpen = isMarketOpen()

  return (
    <main style={{ fontFamily: 'var(--font-body)', background: 'var(--bg)', minHeight: '100vh' }}>

      {/* ── Nav ── */}
      <nav className="home-nav" style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#1a3328',
        padding: '0 2rem', height: '64px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <span style={{ fontSize: '1.3rem' }}>🌸</span>
          <span className="home-nav-logo" style={{
            fontFamily: 'var(--font-body)', fontSize: '1.05rem', fontWeight: 800,
            color: 'white', letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap',
          }}>
            Bloom Lane
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
          <Link href="/growers" className="home-nav-mkt" style={{ color: 'rgba(255,255,255,0.65)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500, whiteSpace: 'nowrap' }}>
            Growers
          </Link>
          <Link href="/marketplace" className="home-nav-mkt" style={{ color: 'rgba(255,255,255,0.65)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500, whiteSpace: 'nowrap' }}>
            Marketplace
          </Link>
          <Link href="/auth/login" style={{ color: 'rgba(255,255,255,0.65)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500, whiteSpace: 'nowrap' }}>
            Sign in
          </Link>
          <Link href="/auth/register" className="btn btn-sm" style={{ background: 'var(--green)', color: 'white', whiteSpace: 'nowrap' }}>
            Join free
          </Link>
        </div>
      </nav>

      {/* ── Market status bar ── */}
      <div style={{
        background: marketOpen ? 'var(--green)' : 'var(--surface-2)',
        padding: '0.55rem 2rem',
        textAlign: 'center',
        borderBottom: '1px solid rgba(0,0,0,0.08)',
      }}>
        {marketOpen ? (
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'white', letterSpacing: '0.02em' }}>
            <span style={{ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: '#a5f3c0', marginRight: '0.5rem', verticalAlign: 'middle', animation: 'pulse-dot 1.8s ease infinite' }} />
            Market is OPEN · Order before Wednesday 8:00 PM AEST
          </span>
        ) : (
          <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-2)' }}>
            🕐 Market closed · Opens Wednesday 8:00 AM AEST · Browse now, order Wednesday
          </span>
        )}
      </div>

      {/* ── Hero ── */}
      <section style={{ background: '#1a3328', padding: '5.5rem 2rem 6rem', textAlign: 'center' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          <h1 style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'clamp(2.1rem, 5.5vw, 3.5rem)',
            fontWeight: 800,
            color: 'white',
            lineHeight: 1.15,
            marginBottom: '1.25rem',
            letterSpacing: '-0.025em',
          }}>
            Fresh Australian flowers,{' '}
            <span style={{ color: '#7dcf9a' }}>direct from the grower</span>
          </h1>
          <p style={{ fontSize: '1.05rem', color: 'rgba(255,255,255,0.55)', maxWidth: '520px', margin: '0 auto 2.5rem', lineHeight: 1.75 }}>
            Weekly market window. Wholesale pricing for florists, retail for flower lovers.
            Know who grew your flowers and what they were paid.
          </p>
          <div style={{ display: 'flex', gap: '0.875rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/marketplace" className="btn" style={{ background: 'var(--green)', color: 'white', padding: '0.9rem 2.25rem', fontSize: '1rem', fontWeight: 700 }}>
              Browse the market →
            </Link>
            <Link href="/auth/register" style={{
              display: 'inline-flex', alignItems: 'center', padding: '0.9rem 1.75rem',
              fontSize: '0.95rem', fontWeight: 500,
              color: 'rgba(255,255,255,0.6)', textDecoration: 'none',
            }}>
              Create free account
            </Link>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ padding: '5rem 2rem', background: 'var(--bg)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--green)', marginBottom: '0.625rem' }}>
              How it works
            </p>
            <h2 style={{ fontFamily: 'var(--font-body)', fontSize: 'clamp(1.5rem, 3vw, 2.1rem)', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.025em' }}>
              From field to florist in 3 steps
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {[
              { num: '01', icon: '🌱', title: 'Growers list weekly', desc: 'Australian flower growers list their fresh-cut stems every Sunday to Tuesday. Roses, sunflowers, natives, and more.' },
              { num: '02', icon: '🛒', title: 'Order on Wednesday', desc: "Florists and flower lovers browse and order during the Wednesday market window. See who grew it and what you're paying." },
              { num: '03', icon: '🚚', title: 'Delivered fresh', desc: 'Growers harvest to order and dispatch direct. Hub pickup or home delivery anywhere in the zone.' },
            ].map(s => (
              <div key={s.num} style={{
                background: 'white',
                borderRadius: '16px',
                padding: '2rem',
                border: '1px solid rgba(0,0,0,0.07)',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                  <div style={{ width: '2.75rem', height: '2.75rem', borderRadius: '10px', background: 'var(--green-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
                    {s.icon}
                  </div>
                  <span style={{ fontSize: '2.25rem', fontWeight: 900, color: 'rgba(0,0,0,0.05)', letterSpacing: '-0.05em', lineHeight: 1 }}>{s.num}</span>
                </div>
                <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-1)', marginBottom: '0.625rem' }}>{s.title}</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-2)', lineHeight: 1.75 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Buyer types ── */}
      <section style={{ background: 'white', padding: '4.5rem 2rem', borderTop: '1px solid rgba(0,0,0,0.06)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--green)', marginBottom: '0.625rem' }}>
              Who shops here
            </p>
            <h2 style={{ fontFamily: 'var(--font-body)', fontSize: 'clamp(1.5rem, 3vw, 2.1rem)', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.025em' }}>
              A market for everyone
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
            {/* Florists */}
            <div style={{ background: '#1a3328', borderRadius: '16px', padding: '2.5rem' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '1.25rem' }}>💼</div>
              <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '1.2rem', fontWeight: 700, color: 'white', marginBottom: '0.875rem' }}>Florists & businesses</h3>
              <ul style={{ listStyle: 'none', marginBottom: '2rem' }}>
                {['Wholesale pricing ex-GST', 'ABN-verified accounts', 'No minimum spend', 'Weekly fresh stock'].map(f => (
                  <li key={f} style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginBottom: '0.5rem', paddingLeft: '1.375rem', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0, color: '#7dcf9a', fontWeight: 700 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/auth/register?role=buyer_b2b" className="btn btn-sm" style={{ background: 'var(--green)', color: 'white', width: '100%', display: 'flex', justifyContent: 'center' }}>
                Open wholesale account
              </Link>
            </div>
            {/* Flower lovers */}
            <div style={{ background: 'var(--bg)', borderRadius: '16px', padding: '2.5rem', border: '1px solid rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize: '1.75rem', marginBottom: '1.25rem' }}>🌸</div>
              <h3 style={{ fontFamily: 'var(--font-body)', fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-1)', marginBottom: '0.875rem' }}>Flower lovers</h3>
              <ul style={{ listStyle: 'none', marginBottom: '2rem' }}>
                {['Retail pricing inc-GST', 'No subscription needed', 'Know your grower', 'Fresh, seasonal varieties'].map(f => (
                  <li key={f} style={{ color: 'var(--text-2)', fontSize: '0.9rem', marginBottom: '0.5rem', paddingLeft: '1.375rem', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0, color: 'var(--green)', fontWeight: 700 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/auth/register?role=buyer_b2c" className="btn btn-sm" style={{ background: 'var(--green)', color: 'white', width: '100%', display: 'flex', justifyContent: 'center' }}>
                Start shopping
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Grower CTA ── */}
      <section style={{ padding: '5rem 2rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{
            background: 'var(--green-soft)',
            borderRadius: '20px',
            padding: '4rem 2.5rem',
            textAlign: 'center',
            border: '1px solid var(--green-mid)',
          }}>
            <div style={{ fontSize: '2.25rem', marginBottom: '1rem' }}>🌻</div>
            <h2 style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'clamp(1.4rem, 3vw, 2rem)',
              fontWeight: 800,
              color: 'var(--text-1)',
              marginBottom: '1rem',
              letterSpacing: '-0.025em',
            }}>
              Grow your sales, not your overheads
            </h2>
            <p style={{ color: 'var(--text-2)', maxWidth: '480px', margin: '0 auto 2rem', lineHeight: 1.75 }}>
              List your flowers for free. Set your own wholesale price. 5% commission only when you sell.
              Payouts land in your account automatically.
            </p>
            <Link href="/auth/register?role=farmer" className="btn" style={{ background: 'var(--green)', color: 'white', padding: '0.875rem 2.25rem', fontSize: '0.95rem', fontWeight: 700 }}>
              List your flowers for free →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: '#1a3328', color: 'rgba(255,255,255,0.4)', padding: '2.5rem 2rem', textAlign: 'center', fontSize: '0.8rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.875rem' }}>
          <span style={{ fontSize: '1.1rem' }}>🌸</span>
          <span style={{ fontFamily: 'var(--font-body)', color: 'white', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: '0.9rem' }}>Bloom Lane</span>
        </div>
        <p>© {new Date().getFullYear()} Bloom Lane Pty Ltd · ABN · Australia</p>
        <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginTop: '0.875rem', flexWrap: 'wrap' }}>
          <Link href="/auth/login" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Sign in</Link>
          <Link href="/auth/register" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Register</Link>
          <Link href="/marketplace" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Marketplace</Link>
          <Link href="/growers" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Growers</Link>
        </div>
      </footer>
    </main>
  )
}
