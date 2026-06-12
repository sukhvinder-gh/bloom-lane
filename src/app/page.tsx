import Link from 'next/link'
import { isMarketOpen } from '@/lib/utils/timezone'
import NewsletterSection from './_components/NewsletterSection'

export default function HomePage() {
  const marketOpen = isMarketOpen()

  return (
    <main style={{ fontFamily: 'var(--font-body)', background: 'var(--cream)', minHeight: '100vh' }}>

      {/* ── Nav ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(14, 27, 18, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        padding: '0 2.5rem', height: '64px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{ width: '2rem', height: '2rem', borderRadius: '8px', background: 'var(--bloom)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', color: 'white', fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.02em' }}>G</div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 700, color: 'white', letterSpacing: '-0.01em' }}>The Green Guild</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <Link href="/growers" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500, padding: '0.5rem 0.875rem', borderRadius: '8px', transition: 'color 0.15s' }}>Growers</Link>
          <Link href="/marketplace" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500, padding: '0.5rem 0.875rem', borderRadius: '8px', transition: 'color 0.15s' }}>Marketplace</Link>
          <Link href="/auth/login" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500, padding: '0.5rem 0.875rem', borderRadius: '8px' }}>Sign in</Link>
          <Link href="/auth/register" style={{ background: 'var(--bloom)', color: 'white', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600, padding: '0.5rem 1.125rem', borderRadius: '8px', marginLeft: '0.5rem' }}>Join free</Link>
        </div>
      </nav>

      {/* ── Hero ── full viewport, dark nature green */}
      <section style={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #091510 0%, #0e2318 35%, #142b1b 60%, #0b1d12 100%)',
        display: 'flex', alignItems: 'center',
        position: 'relative', overflow: 'hidden',
        paddingTop: '64px',
      }}>

        {/* Atmospheric glow blobs */}
        <div style={{ position: 'absolute', top: '10%', right: '5%', width: '520px', height: '520px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(90,160,100,0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '5%', left: '2%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(232,93,122,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: '40%', left: '25%', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(60,130,80,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Subtle grid texture */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)', backgroundSize: '60px 60px', pointerEvents: 'none' }} />

        {/* Decorative botanical stems — left edge */}
        <svg style={{ position: 'absolute', left: 0, bottom: 0, height: '70%', opacity: 0.12, pointerEvents: 'none' }} width="120" viewBox="0 0 120 600" fill="none">
          <path d="M20 600 Q30 480 15 380 Q5 300 25 220 Q40 160 20 80" stroke="#a8d5a2" strokeWidth="2.5" fill="none" />
          <path d="M25 380 Q60 340 80 310" stroke="#a8d5a2" strokeWidth="2" fill="none" />
          <path d="M18 280 Q-10 240 5 200" stroke="#a8d5a2" strokeWidth="1.5" fill="none" />
          <circle cx="80" cy="308" r="8" fill="#a8d5a2" opacity="0.5" />
          <circle cx="5" cy="198" r="6" fill="#e8c5cd" opacity="0.5" />
          <path d="M60 600 Q75 500 55 410 Q40 340 65 260" stroke="#7db87a" strokeWidth="2" fill="none" />
          <path d="M58 410 Q90 380 105 360" stroke="#7db87a" strokeWidth="1.5" fill="none" />
          <circle cx="106" cy="358" r="7" fill="#e8c5cd" opacity="0.4" />
        </svg>

        {/* Decorative botanical — right edge */}
        <svg style={{ position: 'absolute', right: 0, bottom: 0, height: '60%', opacity: 0.1, pointerEvents: 'none' }} width="100" viewBox="0 0 100 500" fill="none">
          <path d="M80 500 Q70 400 85 310 Q95 240 75 150 Q60 90 80 20" stroke="#a8d5a2" strokeWidth="2.5" fill="none" />
          <path d="M82 310 Q50 280 30 265" stroke="#a8d5a2" strokeWidth="2" fill="none" />
          <circle cx="29" cy="264" r="8" fill="#e8c5cd" opacity="0.5" />
          <path d="M78 200 Q105 170 100 140" stroke="#a8d5a2" strokeWidth="1.5" fill="none" />
          <circle cx="100" cy="138" r="5" fill="#a8d5a2" opacity="0.4" />
        </svg>

        {/* Content */}
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '4rem 2.5rem', width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center' }}>

          {/* Left — text */}
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(168,213,162,0.12)', border: '1px solid rgba(168,213,162,0.25)', borderRadius: '99px', padding: '0.375rem 0.875rem', marginBottom: '2rem' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: marketOpen ? '#6fcf7a' : 'rgba(255,255,255,0.3)', display: 'inline-block', animation: marketOpen ? 'pulse-dot 1.8s ease infinite' : 'none' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(168,213,162,0.85)', letterSpacing: '0.04em' }}>
                {marketOpen ? 'Market open · Order now' : "Australia's B2B flower market"}
              </span>
            </div>

            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(2.4rem, 4.5vw, 3.8rem)',
              fontWeight: 700,
              color: 'white',
              lineHeight: 1.08,
              marginBottom: '1.5rem',
              letterSpacing: '-0.03em',
            }}>
              Fresh flowers,<br />
              <em style={{ color: '#a8d5a2', fontStyle: 'italic' }}>direct from<br />the grower</em>
            </h1>

            <p style={{ fontSize: '1.05rem', color: 'rgba(255,255,255,0.5)', maxWidth: '440px', lineHeight: 1.8, marginBottom: '2.5rem' }}>
              Weekly market window. Wholesale for florists, retail for flower lovers.
              Know exactly who grew your flowers and what they were paid.
            </p>

            <div style={{ display: 'flex', gap: '0.875rem', flexWrap: 'wrap', marginBottom: '3rem' }}>
              <Link href="/marketplace" style={{
                background: 'var(--bloom)', color: 'white', textDecoration: 'none',
                padding: '0.875rem 2rem', borderRadius: '10px', fontWeight: 700,
                fontSize: '0.95rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                boxShadow: '0 4px 24px rgba(232,93,122,0.35)',
              }}>
                Browse the market
                <span style={{ fontSize: '1rem' }}>→</span>
              </Link>
              <Link href="/auth/register" style={{
                background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)',
                textDecoration: 'none', padding: '0.875rem 1.75rem',
                borderRadius: '10px', fontWeight: 500, fontSize: '0.95rem',
                border: '1px solid rgba(255,255,255,0.12)',
              }}>
                Create free account
              </Link>
            </div>

            {/* Social proof / stats */}
            <div style={{ display: 'flex', gap: '2.5rem' }}>
              {[
                { num: '50+', label: 'Growers' },
                { num: 'Weekly', label: 'Fresh stock' },
                { num: '5%', label: 'Commission only' },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 700, color: 'white', letterSpacing: '-0.03em' }}>{s.num}</div>
                  <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', marginTop: '0.1rem', fontWeight: 500 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — floating product cards */}
          <div style={{ position: 'relative', height: '480px' }}>

            {/* Card 1 — back left */}
            <div style={{
              position: 'absolute', top: '60px', left: '-10px',
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px', padding: '1.25rem',
              width: '175px',
              transform: 'rotate(-4deg)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🌸</div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Rosa Farm</div>
              <div style={{ fontSize: '0.9rem', color: 'white', fontWeight: 700, marginBottom: '0.5rem' }}>Mixed Roses</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: '#a8d5a2', letterSpacing: '-0.02em' }}>$4.50</span>
                <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)' }}>/ stem</span>
              </div>
            </div>

            {/* Card 2 — center main */}
            <div style={{
              position: 'absolute', top: '20px', left: '120px',
              background: 'rgba(255,255,255,0.09)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '20px', padding: '1.5rem',
              width: '200px',
              boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
              zIndex: 2,
            }}>
              <div style={{ height: '110px', background: 'linear-gradient(135deg, rgba(232,93,122,0.3), rgba(168,213,162,0.2))', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3.5rem', marginBottom: '1rem' }}>🌻</div>
              <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Sunridge Farm</div>
              <div style={{ fontSize: '0.95rem', color: 'white', fontWeight: 700, marginBottom: '0.75rem' }}>Sunflowers</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.875rem' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'white', letterSpacing: '-0.02em' }}>$3.20</div>
                  <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)' }}>wholesale / stem</div>
                </div>
                <span style={{ background: 'rgba(168,213,162,0.2)', color: '#a8d5a2', fontSize: '0.65rem', fontWeight: 700, padding: '0.25rem 0.625rem', borderRadius: '99px', border: '1px solid rgba(168,213,162,0.25)' }}>42 left</span>
              </div>
              <div style={{ background: 'var(--bloom)', color: 'white', borderRadius: '8px', padding: '0.5rem', textAlign: 'center', fontSize: '0.8rem', fontWeight: 700 }}>Add to cart</div>
            </div>

            {/* Card 3 — back right */}
            <div style={{
              position: 'absolute', top: '80px', right: '-20px',
              background: 'rgba(255,255,255,0.05)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '16px', padding: '1.25rem',
              width: '165px',
              transform: 'rotate(3.5deg)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>💐</div>
              <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Valley Blooms</div>
              <div style={{ fontSize: '0.9rem', color: 'white', fontWeight: 700, marginBottom: '0.5rem' }}>Natives Mix</div>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: '#a8d5a2', letterSpacing: '-0.02em' }}>$8.00</span>
            </div>

            {/* Card 4 — bottom */}
            <div style={{
              position: 'absolute', bottom: '30px', left: '60px',
              background: 'rgba(232,93,122,0.12)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(232,93,122,0.2)',
              borderRadius: '14px', padding: '1rem 1.25rem',
              display: 'flex', alignItems: 'center', gap: '0.875rem',
              zIndex: 3,
              boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
            }}>
              <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '8px', background: 'rgba(232,93,122,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>🌿</div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'white', fontWeight: 700, marginBottom: '0.1rem' }}>Order confirmed</div>
                <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)' }}>Dispatching Friday · Eucalyptus</div>
              </div>
            </div>

            {/* Floating badge */}
            <div style={{
              position: 'absolute', top: 0, right: '30px',
              background: 'rgba(168,213,162,0.15)',
              border: '1px solid rgba(168,213,162,0.3)',
              borderRadius: '99px', padding: '0.375rem 0.875rem',
              fontSize: '0.72rem', fontWeight: 700,
              color: '#a8d5a2', letterSpacing: '0.04em',
            }}>
              GST invoicing auto
            </div>

          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ padding: '6rem 2rem', background: 'var(--cream)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--bloom)', marginBottom: '0.75rem' }}>How it works</p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 3vw, 2.25rem)', fontWeight: 700, color: 'var(--navy)', letterSpacing: '-0.02em' }}>
              From field to florist in 3 steps
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {[
              { num: '01', icon: '🌱', title: 'Growers list weekly', desc: 'Australian flower growers list fresh-cut stems every Sunday to Tuesday. Roses, sunflowers, natives, and more.' },
              { num: '02', icon: '🛒', title: 'Order on Wednesday', desc: "Florists and flower lovers browse and order during the Wednesday market window. See who grew it and what you're paying." },
              { num: '03', icon: '🚚', title: 'Delivered fresh', desc: 'Growers harvest to order and dispatch direct. Hub pickup or home delivery anywhere in the zone.' },
            ].map((s, i) => (
              <div key={s.num} style={{
                background: 'white',
                borderRadius: '20px',
                padding: '2.25rem',
                border: '1px solid rgba(0,0,0,0.06)',
                boxShadow: '0 2px 16px rgba(0,0,0,0.04)',
                position: 'relative',
                overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', top: '-12px', right: '1.5rem', fontFamily: 'var(--font-display)', fontSize: '5rem', fontWeight: 900, color: 'rgba(0,0,0,0.04)', lineHeight: 1, letterSpacing: '-0.05em', userSelect: 'none' }}>{s.num}</div>
                <div style={{ width: '3rem', height: '3rem', borderRadius: '12px', background: 'var(--bloom-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.375rem', marginBottom: '1.5rem' }}>{s.icon}</div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600, color: 'var(--navy)', marginBottom: '0.75rem' }}>{s.title}</h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Buyer types ── */}
      <section style={{ background: 'white', padding: '5rem 2rem', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--bloom)', marginBottom: '0.75rem' }}>Who shops here</p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 3vw, 2.25rem)', fontWeight: 700, color: 'var(--navy)', letterSpacing: '-0.02em' }}>A market for everyone</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
            <div style={{
              background: 'linear-gradient(145deg, #0e2318 0%, #1a3020 100%)',
              borderRadius: '20px', padding: '2.75rem',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '180px', height: '180px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(232,93,122,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
              <div style={{ fontSize: '1.875rem', marginBottom: '1.5rem' }}>💼</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 600, color: 'white', marginBottom: '1rem' }}>Florists & businesses</h3>
              <ul style={{ listStyle: 'none', marginBottom: '2.25rem', padding: 0 }}>
                {['Wholesale pricing ex-GST', 'ABN-verified accounts', 'No minimum spend', 'Weekly fresh stock'].map(f => (
                  <li key={f} style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginBottom: '0.625rem', paddingLeft: '1.5rem', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0, color: '#a8d5a2', fontWeight: 700 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/auth/register?role=buyer_b2b" style={{ background: 'var(--bloom)', color: 'white', textDecoration: 'none', padding: '0.75rem 1.5rem', borderRadius: '10px', fontWeight: 700, fontSize: '0.875rem', display: 'inline-block' }}>
                Open wholesale account
              </Link>
            </div>
            <div style={{ background: 'var(--bloom-soft)', borderRadius: '20px', padding: '2.75rem', border: '1px solid var(--bloom-mid)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: '-40px', right: '-40px', width: '180px', height: '180px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(232,93,122,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
              <div style={{ fontSize: '1.875rem', marginBottom: '1.5rem' }}>🌸</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 600, color: 'var(--navy)', marginBottom: '1rem' }}>Flower lovers</h3>
              <ul style={{ listStyle: 'none', marginBottom: '2.25rem', padding: 0 }}>
                {['Retail pricing inc-GST', 'No subscription needed', 'Know your grower', 'Fresh, seasonal varieties'].map(f => (
                  <li key={f} style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.625rem', paddingLeft: '1.5rem', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0, color: 'var(--bloom)', fontWeight: 700 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/auth/register?role=buyer_b2c" style={{ background: 'var(--navy)', color: 'white', textDecoration: 'none', padding: '0.75rem 1.5rem', borderRadius: '10px', fontWeight: 700, fontSize: '0.875rem', display: 'inline-block' }}>
                Start shopping
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Grower CTA ── */}
      <section style={{ padding: '6rem 2rem', background: 'var(--cream)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{
            background: 'linear-gradient(145deg, #0e2318 0%, #1a3020 50%, #0e2318 100%)',
            borderRadius: '24px',
            padding: '5rem 3rem',
            textAlign: 'center',
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: '-60px', left: '50%', transform: 'translateX(-50%)', width: '500px', height: '300px', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(168,213,162,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-40px', left: '10%', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(232,93,122,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1.25rem' }}>🌻</div>
              <h2 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.5rem, 3.5vw, 2.25rem)',
                fontWeight: 700, color: 'white',
                marginBottom: '1rem', letterSpacing: '-0.02em',
              }}>
                Grow your sales,{' '}
                <em style={{ color: '#a8d5a2', fontStyle: 'italic' }}>not your overheads</em>
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.5)', maxWidth: '480px', margin: '0 auto 2.5rem', lineHeight: 1.8, fontSize: '1rem' }}>
                List your flowers for free. Set your own wholesale price.<br />
                5% commission only when you sell. Payouts land automatically.
              </p>
              <Link href="/auth/register?role=farmer" style={{
                background: '#a8d5a2', color: '#0e2318',
                textDecoration: 'none', padding: '0.925rem 2.25rem',
                borderRadius: '10px', fontWeight: 700, fontSize: '0.95rem',
                display: 'inline-block',
                boxShadow: '0 4px 24px rgba(168,213,162,0.3)',
              }}>
                List your flowers for free →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Newsletter ── */}
      <NewsletterSection />

      {/* ── Footer ── */}
      <footer style={{ background: '#091510', color: 'rgba(255,255,255,0.35)', padding: '3rem 2.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <div style={{ width: '1.75rem', height: '1.75rem', borderRadius: '6px', background: 'var(--bloom)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', color: 'white', fontSize: '0.875rem', fontWeight: 700 }}>G</div>
            <span style={{ fontFamily: 'var(--font-display)', color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>The Green Guild</span>
          </div>
          <p style={{ fontSize: '0.8rem' }}>© {new Date().getFullYear()} The Green Guild Pty Ltd · Australia</p>
          <div style={{ display: 'flex', gap: '1.5rem' }}>
            {[['Sign in', '/auth/login'], ['Register', '/auth/register'], ['Marketplace', '/marketplace'], ['Growers', '/growers']].map(([label, href]) => (
              <Link key={href} href={href} style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none', fontSize: '0.8rem', transition: 'color 0.15s' }}>{label}</Link>
            ))}
          </div>
        </div>
      </footer>

    </main>
  )
}
