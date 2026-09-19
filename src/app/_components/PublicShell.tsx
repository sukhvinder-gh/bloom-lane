import Link from 'next/link'
import { Lora, Work_Sans } from 'next/font/google'
import { getSessionUserFromCookie } from '@/lib/supabase/server'
import CommunitySection from './CommunitySection'
import styles from './publicShell.module.css'

const lora = Lora({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-lora', display: 'swap' })
const workSans = Work_Sans({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-work-sans', display: 'swap' })

export const PUBLIC_FG  = '#23402f'
export const PUBLIC_INK = '#3a4f41'

// Shared frame for the public info pages (FAQ, Contact, Privacy, Terms): the
// home page's own layout, with only the middle of the hero (title, subtitle
// and the page's content) supplied by each page.
export default async function PublicShell({
  title, intro, maxWidth = '46rem', card = false, compact = false, children,
}: {
  title: string
  intro?: React.ReactNode
  maxWidth?: string
  /** Wrap the content in one white card (for long text pages like Terms). */
  card?: boolean
  /** Tighter title area, for short pages that should fit one screen. */
  compact?: boolean
  children: React.ReactNode
}) {
  const sessionUser = await getSessionUserFromCookie()

  return (
    <main className={`${styles.page} ${compact ? styles.compact : ''} ${lora.variable} ${workSans.variable}`}>
      <section className={styles.hero}>
        <div aria-hidden="true" className={styles.botanicalLeft}>
          <img src="/botanicals-leaves.png" alt="" />
        </div>
        <div aria-hidden="true" className={styles.botanicalRight}>
          <img src="/botanicals.png" alt="" />
        </div>

        <header className={styles.header}>
          <div>
            <Link href="/" className={styles.logoLink}><h2 className={styles.logo}>The Green Guild</h2></Link>
            <p className={styles.tagline}>Direct. Local. Seasonal.</p>
          </div>
          <nav className={styles.nav}>
            <Link href="/#how-it-works">How the Green Guild works</Link>
            <Link href="/marketplace">Shop Now</Link>
            {sessionUser
              ? <Link href="/dashboard">My Account</Link>
              : <Link href="/auth/login">Login</Link>}
          </nav>
        </header>

        <div className={styles.heroContent}>
          <h1>{title}</h1>
          <div className={styles.divider}>
            <span />
            <svg width="30" height="30" viewBox="0 0 32 32" fill="none" stroke="#7a8473" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 27 V11" />
              <path d="M16 16 C16 10 20 6 26 5 C26 11 22 16 16 16 Z" />
              <path d="M16 19 C16 13.5 12.4 9.6 6.6 8.8 C6.6 14.6 10.4 19 16 19 Z" />
            </svg>
            <span />
          </div>
          {intro && <p className={styles.heroSubtitle}>{intro}</p>}

          <div className={styles.content} style={{ maxWidth }}>
            {card ? <div className="card" style={{ padding: '2rem', background: 'white' }}>{children}</div> : children}
          </div>
        </div>
      </section>

      <CommunitySection />
    </main>
  )
}
