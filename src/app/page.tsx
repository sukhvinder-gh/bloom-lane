import Link from 'next/link'
import { Lora, Work_Sans } from 'next/font/google'
import { isMarketOpen } from '@/lib/utils/timezone'
import { getSessionUserFromCookie } from '@/lib/supabase/server'
import NewsletterSection from './_components/NewsletterSection'
import CommunitySection from './_components/CommunitySection'
import styles from './page.module.css'

const lora = Lora({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-lora',
  display: 'swap',
})

const workSans = Work_Sans({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-work-sans',
  display: 'swap',
})

const FG = '#23402f'
const INK = '#3a4f41'

export default async function HomePage() {
  const marketOpen = isMarketOpen()
  const sessionUser = await getSessionUserFromCookie()

  return (
    <main className={`${styles.page} ${lora.variable} ${workSans.variable}`}>
      <div className={styles.firstScreen}>

        {/* ── HERO (header + botanicals live inside) ── */}
        <section className={styles.hero}>

          <div aria-hidden="true" className={styles.botanicalLeft}>
            <img src="/botanicals-leaves.png" alt="" />
          </div>
          <div aria-hidden="true" className={styles.botanicalRight}>
            <img src="/botanicals.png" alt="" />
          </div>

          <header className={styles.header}>
            <div>
              <h1 className={styles.logo}>The Green Guild</h1>
              <p className={styles.heroSubtitle}>Direct. Local. Seasonal.</p>
            </div>
            <nav className={styles.nav}>
              <Link href="#how-it-works">How the Green Guild works</Link>
              <Link href="/marketplace">Shop Now</Link>
              {sessionUser
                ? <Link href="/dashboard">My Account</Link>
                : <Link href="/auth/login">Login</Link>
              }
            </nav>
          </header>

          <div className={styles.heroContent}>
            <h2>
              Fresh harvest,<br />
              direct from the growers
            </h2>

            <div className={styles.divider}>
              <span />
              <svg width="30" height="30" viewBox="0 0 32 32" fill="none" stroke="#7a8473" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 27 V11" />
                <path d="M16 16 C16 10 20 6 26 5 C26 11 22 16 16 16 Z" />
                <path d="M16 19 C16 13.5 12.4 9.6 6.6 8.8 C6.6 14.6 10.4 19 16 19 Z" />
              </svg>
              <span />
            </div>

            <p className={styles.heroSubtitle}>From farm to buyer, made simple.</p>

            {marketOpen && (
              <p suppressHydrationWarning className={styles.marketOpen}>
                <span className={styles.marketDot} />
                Market open · Order now
              </p>
            )}
          </div>
        </section>

        <CommunitySection />
      </div>{/* /firstScreen */}

      {/* ════════════════════════════════
          HOW IT WORKS
      ════════════════════════════════ */}
      <section id="how-it-works" style={{ padding: '4rem 2rem', background: '#f3f0e4' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <p style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: INK, marginBottom: '0.6rem' }}>How it works</p>
            <h2 style={{ fontFamily: 'var(--font-lora), Georgia, serif', fontSize: 'clamp(1.6rem, 3vw, 2.25rem)', fontWeight: 500, color: FG }}>
              From field to buyer in 3 steps
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
            {[
              { num: '01', icon: '🌱', title: 'Growers list weekly', desc: 'Australian growers list fresh produce every Sunday to Tuesday. Flowers, herbs, vegetables, and more.' },
              { num: '02', icon: '🛒', title: 'Order on Wednesday', desc: "Buyers browse and order during the Wednesday market window. See who grew it and what you're paying." },
              { num: '03', icon: '🚚', title: 'Delivered fresh', desc: 'Growers harvest to order and dispatch direct. Hub pickup or home delivery anywhere in the zone.' },
            ].map(s => (
              <div key={s.num} style={{ background: 'white', borderRadius: '12px', padding: '2rem', border: '1px solid rgba(35,64,47,0.08)', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: '-10px', right: '1.25rem', fontFamily: 'var(--font-lora), Georgia, serif', fontSize: '4.5rem', fontWeight: 900, color: 'rgba(35,64,47,0.04)', lineHeight: 1, userSelect: 'none' }}>{s.num}</div>
                <div style={{ width: '48px', height: '48px', borderRadius: '999px', border: '1px solid rgba(35,64,47,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', marginBottom: '1.25rem' }}>{s.icon}</div>
                <h3 style={{ fontFamily: 'var(--font-lora), Georgia, serif', fontSize: '1.05rem', fontWeight: 500, color: FG, marginBottom: '0.6rem' }}>{s.title}</h3>
                <p style={{ fontSize: '0.88rem', color: INK, lineHeight: 1.75 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <NewsletterSection />
    </main>
  )
}
