import Link from 'next/link'
import styles from '../page.module.css'

// The dark "Join the Green Guild community" band at the bottom of the home
// page, shared with the public info pages (FAQ, Contact, Privacy, Terms) so
// they end the same way.
export default function CommunitySection() {
  return (
    <>
        <section className={styles.community}>
          <h3>Join the Green Guild community</h3>

          <div className={styles.cards}>

            <Link href="/register-interest/grower" className={styles.card}>
              <div className={styles.icon}>
                <svg width="34" height="34" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 27 V12" />
                  <path d="M16 27 C13 27 11 25.5 11 23" />
                  <path d="M16 17 C16 11 20 7 26 6 C26 12 22 17 16 17 Z" />
                  <path d="M16 20 C16 14.5 12.4 10.6 6.6 9.8 C6.6 15.6 10.4 20 16 20 Z" />
                </svg>
              </div>
              <div>
                <h4>Register Interest – Grower</h4>
                <p>Join our network of trusted growers.</p>
              </div>
            </Link>

            <div className={styles.cardDivider} aria-hidden="true" />

            <Link href="/auth/register?role=coordinator" className={styles.card}>
              <div className={styles.icon}>
                <svg width="34" height="34" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13 16 5l11 8" />
                  <path d="M7 12v14h18V12" />
                  <path d="M5 13h22" />
                  <path d="M13 26v-7h6v7" />
                  <path d="M16 19v7" />
                </svg>
              </div>
              <div>
                <h4>Register – Hub / Collective</h4>
                <p>Become a hub or collective and connect your region.</p>
              </div>
            </Link>

            <div className={styles.cardDivider} aria-hidden="true" />

            <Link href="/register-interest/buyer" className={styles.card}>
              <div className={styles.icon}>
                <svg width="34" height="34" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13 C10 8.5 13 6 16 6 C19 6 22 8.5 22 13" />
                  <path d="M5 13h22" />
                  <path d="M7 13l1.6 11.4a2 2 0 0 0 2 1.6h10.8a2 2 0 0 0 2-1.6L25 13Z" />
                  <path d="M12 16.5v6M16 16.5v6M20 16.5v6" />
                  <path d="M11 19.5h10" />
                </svg>
              </div>
              <div>
                <h4>Register Interest – Buyer</h4>
                <p>Source fresh produce direct from growers.</p>
              </div>
            </Link>

          </div>

          <div className={styles.footerLinks}>
            <Link href="/faq">FAQ</Link>
            <span className={styles.footerDivider} aria-hidden="true" />
            <Link href="/contact">Contact us</Link>
            <span className={styles.footerDivider} aria-hidden="true" />
            <Link href="/privacy">Privacy Policy</Link>
            <span className={styles.footerDivider} aria-hidden="true" />
            <Link href="/terms">Terms &amp; Conditions</Link>
          </div>
        </section>
    </>
  )
}
