import Link from 'next/link'
import { isMarketOpen } from '@/lib/utils/timezone'
import NewsletterSection from './_components/NewsletterSection'

const CREAM  = '#EDE8DC'
const FOREST = '#1B3A2D'
const SAGE   = '#7A8F6A'

export default function HomePage() {
  const marketOpen = isMarketOpen()

  return (
    <main style={{ fontFamily: 'var(--font-body)', background: CREAM, minHeight: '100vh' }}>

      {/* ── Nav ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: CREAM,
        borderBottom: `1px solid rgba(27,58,45,0.1)`,
        padding: '0 3rem', height: '72px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Brand */}
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 700, color: FOREST, lineHeight: 1, marginBottom: '0.15rem', letterSpacing: '-0.01em' }}>
            The Green Guild
          </p>
          <p style={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.2em', color: SAGE, textTransform: 'uppercase' }}>
            Direct. Local. Seasonal.
          </p>
        </div>

        {/* Links */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <Link href="#how-it-works" style={{ color: FOREST, textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500, padding: '0.5rem 1rem' }}>
            How the Green Guild works
          </Link>
          <Link href="/marketplace" style={{
            color: FOREST, textDecoration: 'none', fontSize: '0.875rem', fontWeight: 600,
            padding: '0.5rem 1.375rem', border: `1.5px solid ${FOREST}`, borderRadius: '6px',
            transition: 'all 0.15s',
          }}>
            Shop Now
          </Link>
          <Link href="/auth/login" style={{ color: FOREST, textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500, padding: '0.5rem 1rem' }}>
            Login
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{
        minHeight: 'calc(100vh - 72px)',
        background: CREAM,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '4rem 2rem 3rem',
      }}>

        {/* Left botanical illustration */}
        <svg
          style={{ position: 'absolute', left: 0, bottom: 0, width: 'min(38vw, 520px)', pointerEvents: 'none', userSelect: 'none' }}
          viewBox="0 0 480 580" fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Pumpkin */}
          <ellipse cx="95" cy="530" rx="42" ry="32" stroke={SAGE} strokeWidth="1.2" />
          <ellipse cx="95" cy="530" rx="28" ry="31" stroke={SAGE} strokeWidth="1" />
          <ellipse cx="95" cy="530" rx="14" ry="30" stroke={SAGE} strokeWidth="1" />
          <ellipse cx="68" cy="530" rx="14" ry="24" stroke={SAGE} strokeWidth="1" />
          <ellipse cx="122" cy="530" rx="14" ry="24" stroke={SAGE} strokeWidth="1" />
          <path d="M95 498 Q98 488 95 480 Q99 472 103 476" stroke={SAGE} strokeWidth="1.2" />
          <path d="M95 480 Q108 465 120 470" stroke={SAGE} strokeWidth="1" />
          {/* Large leaf stems from bottom */}
          <path d="M40 580 Q55 520 70 460 Q80 410 60 360" stroke={SAGE} strokeWidth="1.5" fill="none" />
          <path d="M70 460 Q100 430 130 420 Q155 415 170 400" stroke={SAGE} strokeWidth="1.2" fill="none" />
          {/* Big leaf shape left */}
          <path d="M60 360 Q20 330 10 290 Q5 260 30 245 Q55 230 80 255 Q100 275 85 310 Q75 340 60 360Z" stroke={SAGE} strokeWidth="1.2" fill="none" />
          <path d="M60 360 Q45 320 35 285 Q30 260 42 248" stroke={SAGE} strokeWidth="0.8" />
          <path d="M60 360 Q70 325 75 295 Q78 270 68 252" stroke={SAGE} strokeWidth="0.8" />
          {/* Sunflower */}
          <circle cx="175" cy="200" r="22" stroke={SAGE} strokeWidth="1.3" fill="none" />
          <circle cx="175" cy="200" r="13" stroke={SAGE} strokeWidth="1" fill="none" />
          {[0,30,60,90,120,150,180,210,240,270,300,330].map((deg, i) => {
            const rad = (deg * Math.PI) / 180
            const x1 = 175 + 13 * Math.cos(rad), y1 = 200 + 13 * Math.sin(rad)
            const x2 = 175 + 24 * Math.cos(rad), y2 = 200 + 24 * Math.sin(rad)
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={SAGE} strokeWidth="1" />
          })}
          {/* Sunflower stem */}
          <path d="M175 222 Q170 280 165 340 Q160 400 150 460 Q140 510 130 560" stroke={SAGE} strokeWidth="1.4" fill="none" />
          {/* Sunflower leaves */}
          <path d="M170 290 Q135 270 115 245 Q105 225 120 215 Q138 207 155 225 Q168 242 170 265Z" stroke={SAGE} strokeWidth="1.1" fill="none" />
          <path d="M170 290 Q148 275 138 255 Q132 238 140 228" stroke={SAGE} strokeWidth="0.7" />
          <path d="M163 350 Q195 335 215 315 Q225 298 215 285 Q202 275 185 283 Q172 292 165 310Z" stroke={SAGE} strokeWidth="1.1" fill="none" />
          {/* Small daisy left */}
          <circle cx="42" cy="200" r="8" stroke={SAGE} strokeWidth="1" fill="none" />
          {[0,45,90,135,180,225,270,315].map((deg, i) => {
            const rad = (deg * Math.PI) / 180
            const x1 = 42 + 8 * Math.cos(rad), y1 = 200 + 8 * Math.sin(rad)
            const x2 = 42 + 15 * Math.cos(rad), y2 = 200 + 15 * Math.sin(rad)
            return <ellipse key={i} cx={(x1+x2)/2} cy={(y1+y2)/2} rx="4" ry="2.5" transform={`rotate(${deg+90} ${(x1+x2)/2} ${(y1+y2)/2})`} stroke={SAGE} strokeWidth="0.9" fill="none" />
          })}
          <path d="M42 208 Q40 250 35 290 Q30 330 25 370" stroke={SAGE} strokeWidth="1.1" fill="none" />
          {/* Delicate stems top left */}
          <path d="M10 150 Q25 120 20 90 Q18 70 25 55" stroke={SAGE} strokeWidth="1" fill="none" />
          <path d="M25 55 Q15 35 20 20" stroke={SAGE} strokeWidth="0.8" fill="none" />
          {/* Small flower top */}
          <circle cx="20" cy="18" r="5" stroke={SAGE} strokeWidth="0.9" fill="none" />
          {[0,60,120,180,240,300].map((deg, i) => {
            const rad = (deg * Math.PI) / 180
            return <ellipse key={i} cx={20 + 9*Math.cos(rad)} cy={18 + 9*Math.sin(rad)} rx="3.5" ry="2" transform={`rotate(${deg+90} ${20 + 9*Math.cos(rad)} ${18 + 9*Math.sin(rad)})`} stroke={SAGE} strokeWidth="0.8" fill="none" />
          })}
          {/* Extra foliage */}
          <path d="M200 480 Q235 460 250 440 Q260 420 245 408 Q230 398 215 410 Q202 422 200 445Z" stroke={SAGE} strokeWidth="1" fill="none" />
          <path d="M200 480 Q222 460 235 445 Q243 433 238 420" stroke={SAGE} strokeWidth="0.7" />
        </svg>

        {/* Right botanical illustration */}
        <svg
          style={{ position: 'absolute', right: 0, bottom: 0, width: 'min(34vw, 460px)', pointerEvents: 'none', userSelect: 'none' }}
          viewBox="0 0 440 580" fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Dandelion / allium seed head */}
          <circle cx="300" cy="55" r="48" stroke={SAGE} strokeWidth="0.9" strokeDasharray="2 3" />
          {[...Array(18)].map((_, i) => {
            const deg = (i / 18) * 360
            const rad = (deg * Math.PI) / 180
            const x1 = 300 + 6 * Math.cos(rad), y1 = 55 + 6 * Math.sin(rad)
            const x2 = 300 + 46 * Math.cos(rad), y2 = 55 + 46 * Math.sin(rad)
            const mx = 300 + 48 * Math.cos(rad), my = 55 + 48 * Math.sin(rad)
            return (
              <g key={i}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={SAGE} strokeWidth="0.7" />
                <circle cx={mx} cy={my} r="2.5" stroke={SAGE} strokeWidth="0.7" fill="none" />
              </g>
            )
          })}
          {/* Dandelion stem */}
          <path d="M300 103 Q295 200 290 300 Q285 400 280 500 Q275 540 270 580" stroke={SAGE} strokeWidth="1.4" fill="none" />
          {/* Dandelion leaves */}
          <path d="M292 220 Q258 205 240 182 Q228 165 238 152 Q252 142 268 155 Q282 168 288 192Z" stroke={SAGE} strokeWidth="1.1" fill="none" />
          <path d="M288 270 Q318 258 332 238 Q340 222 330 210 Q318 200 304 210 Q293 222 290 248Z" stroke={SAGE} strokeWidth="1.1" fill="none" />
          {/* Garlic bulb */}
          <ellipse cx="360" cy="530" rx="30" ry="26" stroke={SAGE} strokeWidth="1.2" fill="none" />
          <path d="M345 510 Q360 500 375 510" stroke={SAGE} strokeWidth="1" fill="none" />
          <ellipse cx="348" cy="522" rx="12" ry="16" stroke={SAGE} strokeWidth="1" fill="none" />
          <ellipse cx="366" cy="519" rx="13" ry="18" stroke={SAGE} strokeWidth="1" fill="none" />
          <ellipse cx="381" cy="525" rx="10" ry="14" stroke={SAGE} strokeWidth="1" fill="none" />
          <path d="M360 504 Q358 490 360 480" stroke={SAGE} strokeWidth="1.1" />
          <path d="M360 480 Q350 465 345 450" stroke={SAGE} strokeWidth="1" />
          <path d="M360 480 Q368 462 372 448" stroke={SAGE} strokeWidth="1" />
          {/* Round root vegetable (radish) */}
          <circle cx="410" cy="470" r="22" stroke={SAGE} strokeWidth="1.2" fill="none" />
          <path d="M410 492 Q412 510 408 525" stroke={SAGE} strokeWidth="1.1" />
          <path d="M405 470 Q398 462 393 455 Q385 445 388 437 Q394 430 402 436 Q408 443 408 455Z" stroke={SAGE} strokeWidth="1" fill="none" />
          <path d="M415 468 Q422 458 428 450 Q436 440 432 432 Q426 426 419 432 Q413 439 414 453Z" stroke={SAGE} strokeWidth="1" fill="none" />
          {/* Tall stem right */}
          <path d="M420 580 Q422 500 418 420 Q415 360 420 290 Q424 230 418 160 Q414 110 420 60" stroke={SAGE} strokeWidth="1.3" fill="none" />
          <path d="M418 300 Q440 280 438 255" stroke={SAGE} strokeWidth="1" fill="none" />
          {/* Small flower on right stem */}
          <circle cx="438" cy="252" r="6" stroke={SAGE} strokeWidth="0.9" fill="none" />
          {[0,60,120,180,240,300].map((deg, i) => {
            const rad = (deg * Math.PI) / 180
            return <ellipse key={i} cx={438 + 10*Math.cos(rad)} cy={252 + 10*Math.sin(rad)} rx="3.5" ry="2" transform={`rotate(${deg+90} ${438 + 10*Math.cos(rad)} ${252 + 10*Math.sin(rad)})`} stroke={SAGE} strokeWidth="0.8" fill="none" />
          })}
          {/* Extra leaf */}
          <path d="M390 380 Q365 360 355 335 Q348 315 360 305 Q375 297 390 312 Q402 327 398 355Z" stroke={SAGE} strokeWidth="1" fill="none" />
        </svg>

        {/* Hero text — centered */}
        <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', maxWidth: '720px' }}>
          {marketOpen && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#4CAF50', display: 'inline-block', animation: 'pulse-dot 1.8s ease infinite' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: SAGE, letterSpacing: '0.04em' }}>Market open · Order now</span>
            </div>
          )}

          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2.8rem, 6vw, 5rem)',
            fontWeight: 700,
            color: FOREST,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            marginBottom: '1.5rem',
          }}>
            Fresh harvest,<br />direct from the growers
          </h1>

          {/* Leaf divider */}
          <svg style={{ display: 'block', margin: '0 auto 1.5rem' }} width="80" height="28" viewBox="0 0 80 28" fill="none">
            <line x1="0" y1="14" x2="28" y2="14" stroke={SAGE} strokeWidth="1" />
            <line x1="52" y1="14" x2="80" y2="14" stroke={SAGE} strokeWidth="1" />
            <path d="M34 5 Q40 14 34 23 Q40 14 46 5 Q40 14 46 23 Q40 14 34 5Z" stroke={SAGE} strokeWidth="1.1" fill="none" />
            <circle cx="40" cy="14" r="2" fill={SAGE} />
          </svg>

          <p style={{
            fontSize: 'clamp(1rem, 2vw, 1.25rem)',
            color: SAGE,
            lineHeight: 1.7,
            marginBottom: '2.5rem',
            fontStyle: 'italic',
          }}>
            From farm to buyer, made simple.
          </p>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/marketplace" style={{
              background: FOREST, color: '#EDE8DC',
              textDecoration: 'none', padding: '0.875rem 2.25rem',
              borderRadius: '6px', fontWeight: 600, fontSize: '0.95rem',
            }}>
              Shop Now
            </Link>
            <Link href="/auth/register" style={{
              background: 'transparent', color: FOREST,
              textDecoration: 'none', padding: '0.875rem 2.25rem',
              border: `1.5px solid ${FOREST}`, borderRadius: '6px', fontWeight: 600, fontSize: '0.95rem',
            }}>
              Create free account
            </Link>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" style={{ padding: '6rem 2rem', background: '#F7F3EC' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: SAGE, marginBottom: '0.75rem' }}>How it works</p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 3vw, 2.25rem)', fontWeight: 700, color: FOREST, letterSpacing: '-0.02em' }}>
              From field to buyer in 3 steps
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {[
              { num: '01', icon: '🌱', title: 'Growers list weekly', desc: 'Australian growers list fresh produce every Sunday to Tuesday. Flowers, herbs, vegetables, and more.' },
              { num: '02', icon: '🛒', title: 'Order on Wednesday', desc: 'Buyers browse and order during the Wednesday market window. See who grew it and what you\'re paying.' },
              { num: '03', icon: '🚚', title: 'Delivered fresh', desc: 'Growers harvest to order and dispatch direct. Hub pickup or home delivery anywhere in the zone.' },
            ].map(s => (
              <div key={s.num} style={{
                background: 'white', borderRadius: '16px', padding: '2.25rem',
                border: `1px solid rgba(27,58,45,0.08)`,
                position: 'relative', overflow: 'hidden',
              }}>
                <div style={{ position: 'absolute', top: '-12px', right: '1.5rem', fontFamily: 'var(--font-display)', fontSize: '5rem', fontWeight: 900, color: `rgba(27,58,45,0.04)`, lineHeight: 1, userSelect: 'none' }}>{s.num}</div>
                <div style={{ width: '3rem', height: '3rem', borderRadius: '12px', background: `rgba(122,143,106,0.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.375rem', marginBottom: '1.5rem' }}>{s.icon}</div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600, color: FOREST, marginBottom: '0.75rem' }}>{s.title}</h3>
                <p style={{ fontSize: '0.9rem', color: SAGE, lineHeight: 1.8 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Buyer types ── */}
      <section style={{ background: 'white', padding: '5rem 2rem', borderTop: `1px solid rgba(27,58,45,0.08)` }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
            <p style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: SAGE, marginBottom: '0.75rem' }}>Who shops here</p>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 3vw, 2.25rem)', fontWeight: 700, color: FOREST, letterSpacing: '-0.02em' }}>A market for everyone</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
            <div style={{ background: FOREST, borderRadius: '16px', padding: '2.75rem', position: 'relative', overflow: 'hidden' }}>
              <div style={{ fontSize: '1.875rem', marginBottom: '1.5rem' }}>💼</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 600, color: CREAM, marginBottom: '1rem' }}>Florists & businesses</h3>
              <ul style={{ listStyle: 'none', marginBottom: '2.25rem', padding: 0 }}>
                {['Wholesale pricing ex-GST', 'ABN-verified accounts', 'No minimum spend', 'Weekly fresh stock'].map(f => (
                  <li key={f} style={{ color: 'rgba(237,232,220,0.65)', fontSize: '0.9rem', marginBottom: '0.625rem', paddingLeft: '1.5rem', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0, color: '#a8d5a2', fontWeight: 700 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/auth/register?role=buyer_b2b" style={{ background: CREAM, color: FOREST, textDecoration: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.875rem', display: 'inline-block' }}>
                Open wholesale account
              </Link>
            </div>
            <div style={{ background: `rgba(122,143,106,0.1)`, borderRadius: '16px', padding: '2.75rem', border: `1px solid rgba(122,143,106,0.2)` }}>
              <div style={{ fontSize: '1.875rem', marginBottom: '1.5rem' }}>🌸</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 600, color: FOREST, marginBottom: '1rem' }}>Flower & produce lovers</h3>
              <ul style={{ listStyle: 'none', marginBottom: '2.25rem', padding: 0 }}>
                {['Retail pricing inc-GST', 'No subscription needed', 'Know your grower', 'Fresh, seasonal varieties'].map(f => (
                  <li key={f} style={{ color: SAGE, fontSize: '0.9rem', marginBottom: '0.625rem', paddingLeft: '1.5rem', position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0, color: FOREST, fontWeight: 700 }}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/auth/register?role=buyer_b2c" style={{ background: FOREST, color: CREAM, textDecoration: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.875rem', display: 'inline-block' }}>
                Start shopping
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Grower CTA ── */}
      <section style={{ padding: '6rem 2rem', background: '#F7F3EC' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ background: FOREST, borderRadius: '20px', padding: '5rem 3rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '-60px', left: '50%', transform: 'translateX(-50%)', width: '500px', height: '300px', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(168,213,162,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1.25rem' }}>🌻</div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 3.5vw, 2.25rem)', fontWeight: 700, color: CREAM, marginBottom: '1rem', letterSpacing: '-0.02em' }}>
                Grow your sales,{' '}
                <em style={{ color: '#a8d5a2', fontStyle: 'italic' }}>not your overheads</em>
              </h2>
              <p style={{ color: 'rgba(237,232,220,0.55)', maxWidth: '480px', margin: '0 auto 2.5rem', lineHeight: 1.8, fontSize: '1rem' }}>
                List your produce for free. Set your own price.<br />
                5% commission only when you sell. Payouts land automatically.
              </p>
              <Link href="/auth/register?role=farmer" style={{
                background: '#a8d5a2', color: FOREST,
                textDecoration: 'none', padding: '0.925rem 2.25rem',
                borderRadius: '8px', fontWeight: 700, fontSize: '0.95rem',
                display: 'inline-block',
              }}>
                List your produce for free →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Join section ── */}
      <section style={{ background: FOREST, padding: '5rem 2rem' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 700, color: CREAM, marginBottom: '3.5rem', letterSpacing: '-0.01em' }}>
            Join the Green Guild community
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '2.5rem' }}>
            {[
              {
                icon: (
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="17" stroke={CREAM} strokeWidth="1.2" /><path d="M18 26 Q14 20 14 16 Q14 12 18 10 Q22 12 22 16 Q22 20 18 26Z" stroke={CREAM} strokeWidth="1.2" fill="none" /><path d="M18 10 Q14 8 12 11" stroke={CREAM} strokeWidth="1" fill="none" /></svg>
                ),
                title: 'Register – Grower',
                desc: 'Join our network of trusted growers.',
                href: '/auth/register?role=farmer',
              },
              {
                icon: (
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="17" stroke={CREAM} strokeWidth="1.2" /><rect x="10" y="16" width="16" height="11" rx="1" stroke={CREAM} strokeWidth="1.2" /><path d="M13 16 V13 Q13 9 18 9 Q23 9 23 13 V16" stroke={CREAM} strokeWidth="1.2" fill="none" /><line x1="18" y1="19" x2="18" y2="24" stroke={CREAM} strokeWidth="1" /></svg>
                ),
                title: 'Register – Hub',
                desc: 'Become a hub and connect your region.',
                href: '/auth/register?role=coordinator',
              },
              {
                icon: (
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none"><circle cx="18" cy="18" r="17" stroke={CREAM} strokeWidth="1.2" /><path d="M10 14 H13 L15 24 H23 L25 16 H15" stroke={CREAM} strokeWidth="1.2" fill="none" strokeLinejoin="round" /><circle cx="16" cy="26.5" r="1.5" stroke={CREAM} strokeWidth="1" /><circle cx="22" cy="26.5" r="1.5" stroke={CREAM} strokeWidth="1" /></svg>
                ),
                title: 'Register – Buyer (free)',
                desc: 'Source fresh produce direct from growers.',
                href: '/auth/register',
              },
            ].map(item => (
              <Link key={item.title} href={item.href} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', color: 'inherit' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', border: `1.5px solid rgba(237,232,220,0.35)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.icon}
                </div>
                <div>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 600, color: CREAM, marginBottom: '0.375rem' }}>{item.title}</p>
                  <p style={{ fontSize: '0.85rem', color: 'rgba(237,232,220,0.5)', lineHeight: 1.5 }}>{item.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Newsletter ── */}
      <NewsletterSection />

      {/* ── Footer ── */}
      <footer style={{ background: FOREST, borderTop: `1px solid rgba(237,232,220,0.1)`, padding: '1.5rem 2rem' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link href="/privacy" style={{ color: 'rgba(237,232,220,0.5)', textDecoration: 'none', fontSize: '0.8rem' }}>Privacy Policy</Link>
          <span style={{ color: 'rgba(237,232,220,0.25)', fontSize: '0.8rem' }}>|</span>
          <Link href="/terms" style={{ color: 'rgba(237,232,220,0.5)', textDecoration: 'none', fontSize: '0.8rem' }}>Terms &amp; Conditions</Link>
          <span style={{ color: 'rgba(237,232,220,0.2)', fontSize: '0.8rem', marginLeft: '1rem' }}>© {new Date().getFullYear()} The Green Guild Pty Ltd · Australia</span>
        </div>
      </footer>

    </main>
  )
}
