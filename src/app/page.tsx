import Link from 'next/link'

export default function HomePage() {
  return (
    <main style={{ fontFamily: 'var(--font-body)', background: 'var(--petal)', minHeight: '100vh' }}>

      {/* ── Nav ── */}
      <nav className="home-nav" style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'var(--navy)',
        padding: '0 2rem', height: '64px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 2px 16px rgba(30,37,53,0.18)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <span style={{ fontSize: '1.2rem' }}>🌸</span>
          <span className="home-nav-logo" style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700, color: 'white', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
            Bloom Lane
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
          <Link href="/growers" className="home-nav-mkt" style={{ color: 'rgba(255,255,255,0.75)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500, whiteSpace: 'nowrap' }}>
            Growers
          </Link>
          <Link href="/marketplace" className="home-nav-mkt" style={{ color: 'rgba(255,255,255,0.75)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500, whiteSpace: 'nowrap' }}>
            Marketplace
          </Link>
          <Link href="/auth/login" style={{ color: 'rgba(255,255,255,0.75)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500, whiteSpace: 'nowrap' }}>
            Sign in
          </Link>
          <Link href="/auth/register" className="btn btn-bloom btn-sm" style={{ whiteSpace: 'nowrap' }}>
            Get started
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{
        background: 'var(--navy)',
        padding: '5rem 2rem 6rem',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* decorative petal blobs */}
        <div style={{ position: 'absolute', top: '-80px', right: '-80px', width: '320px', height: '320px', borderRadius: '50%', background: 'rgba(232,93,122,0.12)', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', bottom: '-60px', left: '-60px', width: '240px', height: '240px', borderRadius: '50%', background: 'rgba(232,93,122,0.08)', filter: 'blur(50px)' }} />

        <div style={{ position: 'relative', maxWidth: '720px', margin: '0 auto' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(232,93,122,0.18)', borderRadius: '99px', padding: '0.375rem 1rem', marginBottom: '1.5rem' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--bloom)', animation: 'pulse-dot 1.5s ease-in-out infinite' }} />
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--bloom)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Market is live · Order before Wed 8pm AEST</span>
          </div>

          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.5rem, 6vw, 4rem)', fontWeight: 700, color: 'white', lineHeight: 1.1, marginBottom: '1.25rem', letterSpacing: '-0.02em' }}>
            Farm-fresh flowers<br />
            <em style={{ color: 'var(--bloom)', fontStyle: 'italic' }}>direct to your door</em>
          </h1>
          <p style={{ fontSize: '1.125rem', color: 'rgba(255,255,255,0.65)', maxWidth: '520px', margin: '0 auto 2.5rem', lineHeight: 1.7 }}>
            Australian growers. Weekly market window. Wholesale for florists,<br />retail for flower lovers. No middlemen.
          </p>
          <div style={{ display: 'flex', gap: '0.875rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/auth/register?role=buyer_b2b" className="btn btn-bloom" style={{ padding: '0.875rem 2rem', fontSize: '1rem' }}>
              Shop wholesale →
            </Link>
            <Link href="/auth/register?role=farmer" className="btn btn-outline" style={{ padding: '0.875rem 2rem', fontSize: '1rem', color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}>
              List your flowers
            </Link>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ padding: '5rem 2rem', maxWidth: '1100px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <p className="type-label-lg" style={{ color: 'var(--bloom)', marginBottom: '0.75rem' }}>How it works</p>
          <h2 className="type-heading" style={{ color: 'var(--navy)' }}>From field to florist in 3 steps</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {[
            { num: '1', icon: '🌱', title: 'Growers list weekly', desc: 'Australian flower growers list their fresh-cut stems every Sunday–Tuesday. Roses, sunflowers, natives, and more.' },
            { num: '2', icon: '🛒', title: 'Buyers order Wednesday', desc: 'Florists and flower lovers browse and order during the Wednesday market window. Wholesale or retail pricing.' },
            { num: '3', icon: '🚚', title: 'Direct delivery', desc: 'Growers pick, pack, and dispatch. Hub pickup is free. Home delivery is flat $20 anywhere in the zone.' },
          ].map(s => (
            <div key={s.num} className="card" style={{ padding: '2rem', position: 'relative', overflow: 'hidden' }}>
              <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: 'var(--bloom-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', marginBottom: '1.25rem' }}>
                {s.icon}
              </div>
              <div style={{ position: 'absolute', top: '1.25rem', right: '1.5rem', fontFamily: 'var(--font-display)', fontSize: '4rem', fontWeight: 700, color: 'var(--bloom-soft)', lineHeight: 1 }}>{s.num}</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 600, color: 'var(--navy)', marginBottom: '0.625rem' }}>{s.title}</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Buyer types ── */}
      <section style={{ background: 'var(--offwhite)', padding: '5rem 2rem' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <p className="type-label-lg" style={{ color: 'var(--bloom)', marginBottom: '0.75rem' }}>Who shops on Bloom Lane</p>
            <h2 className="type-heading" style={{ color: 'var(--navy)' }}>A market for everyone</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="card" style={{ padding: '2.5rem', background: 'var(--navy)', color: 'white' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>💼</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.875rem' }}>Florists & businesses</h3>
              <p style={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, marginBottom: '1.5rem' }}>Wholesale pricing ex-GST. ABN-verified accounts. Weekly orders to keep your studio stocked with the freshest Australian-grown stems.</p>
              <Link href="/auth/register?role=buyer_b2b" className="btn btn-bloom btn-sm">Open a wholesale account</Link>
            </div>
            <div className="card" style={{ padding: '2.5rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🌸</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 600, color: 'var(--navy)', marginBottom: '0.875rem' }}>Flower lovers</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '1.5rem' }}>Retail pricing inc-GST. No subscription needed. Order fresh flowers direct from the grower and skip the supermarket.</p>
              <Link href="/auth/register?role=buyer_b2c" className="btn btn-navy btn-sm">Start shopping</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Grower CTA ── */}
      <section style={{ padding: '5rem 2rem', maxWidth: '1100px', margin: '0 auto', textAlign: 'center' }}>
        <div className="card" style={{ padding: '4rem 2rem', background: 'linear-gradient(135deg, var(--bloom-soft) 0%, var(--petal) 100%)', border: '1px solid var(--bloom-mid)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🌻</div>
          <h2 className="type-heading" style={{ color: 'var(--navy)', marginBottom: '1rem' }}>Grow your sales, not your overheads</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '520px', margin: '0 auto 2rem', lineHeight: 1.7 }}>
            List your flowers for free. Set your own wholesale price. We take a small commission only when you sell. Payouts land in your account automatically.
          </p>
          <Link href="/auth/register?role=farmer" className="btn btn-navy" style={{ padding: '0.875rem 2rem' }}>
            List your flowers for free →
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: 'var(--navy)', color: 'rgba(255,255,255,0.5)', padding: '2.5rem 2rem', textAlign: 'center', fontSize: '0.8rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <span>🌸</span>
          <span style={{ fontFamily: 'var(--font-display)', color: 'white', fontWeight: 600 }}>Bloom Lane</span>
        </div>
        <p>© {new Date().getFullYear()} Bloom Lane Pty Ltd · ABN · Australia</p>
        <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginTop: '0.75rem' }}>
          <Link href="/auth/login" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: '0.8rem' }}>Sign in</Link>
          <Link href="/auth/register" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: '0.8rem' }}>Register</Link>
          <Link href="/marketplace" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', fontSize: '0.8rem' }}>Marketplace</Link>
        </div>
      </footer>
    </main>
  )
}
