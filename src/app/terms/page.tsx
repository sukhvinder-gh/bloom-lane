import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms & Conditions — The Green Guild',
}

const BG  = '#EDE9DF'
const FG  = '#1B3A2D'
const INK = '#898C62'

export default function TermsPage() {
  return (
    <main style={{ fontFamily: 'var(--font-body)', background: BG, minHeight: '100vh' }}>

      {/* Nav */}
      <nav style={{
        padding: '1rem 2.5rem',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: `1px solid rgba(27,58,45,0.1)`,
      }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', fontWeight: 700, color: FG, margin: 0 }}>
            The Green Guild
          </p>
          <p style={{ fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.22em', color: INK, textTransform: 'uppercase', margin: 0 }}>
            Direct. Local. Seasonal.
          </p>
        </Link>
        <Link href="/" style={{ color: FG, textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500 }}>
          ← Back to home
        </Link>
      </nav>

      {/* Content */}
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '4rem 2rem 6rem' }}>

        <p style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: INK, marginBottom: '0.75rem' }}>
          Legal
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 4vw, 2.75rem)', fontWeight: 400, color: FG, marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
          Terms &amp; Conditions
        </h1>
        <p style={{ color: INK, fontSize: '0.875rem', marginBottom: '3rem' }}>
          Last updated: 1 June 2025
        </p>

        <Section title="1. Acceptance of Terms">
          By accessing or using The Green Guild platform (&ldquo;Platform&rdquo;) operated by The Green Guild Pty Ltd (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;), you agree to be bound by these Terms &amp; Conditions. If you do not agree to these terms, you must not use the Platform. These terms apply to all users including growers, buyers, and hub coordinators.
        </Section>

        <Section title="2. The Platform">
          The Green Guild is an online marketplace that connects Australian growers of fresh produce and flowers directly with buyers including florists, restaurants, food businesses, and retail consumers. We facilitate transactions between growers and buyers but are not a party to any sale contract formed between them. Growers and buyers contract directly with each other.
        </Section>

        <Section title="3. Account Registration">
          To access the Platform&rsquo;s full features you must register for an account. You agree to:
          <ul style={listStyle}>
            <li>Provide accurate, complete, and current registration information</li>
            <li>Maintain the confidentiality of your account credentials</li>
            <li>Notify us immediately of any unauthorised access to your account</li>
            <li>Be responsible for all activity that occurs under your account</li>
          </ul>
          You must be at least 18 years of age to register. Business accounts must be associated with a valid Australian Business Number (ABN).
        </Section>

        <Section title="4. Grower Obligations">
          Growers using the Platform to list produce agree to:
          <ul style={listStyle}>
            <li>List only produce that they have grown or have authority to sell</li>
            <li>Provide accurate descriptions, quantities, and pricing</li>
            <li>Fulfil confirmed orders in full and on time</li>
            <li>Comply with all applicable food safety, agricultural, and business regulations</li>
            <li>Hold appropriate insurance for their operations</li>
            <li>Harvest produce to order only after receiving a confirmed purchase order</li>
          </ul>
          Growers acknowledge that The Green Guild charges a commission of 5% on each completed sale, deducted from payout amounts.
        </Section>

        <Section title="5. Buyer Obligations">
          Buyers using the Platform agree to:
          <ul style={listStyle}>
            <li>Provide accurate delivery and billing information</li>
            <li>Pay for orders in full at the time of purchase</li>
            <li>Inspect deliveries promptly and report issues within 24 hours of receipt</li>
            <li>Use the Platform only for lawful purposes</li>
          </ul>
          B2B buyers with ABN-verified accounts purchasing ex-GST are responsible for their own GST obligations.
        </Section>

        <Section title="6. Orders and Payment">
          Orders placed through the Platform constitute a binding offer to purchase. An order is confirmed when the grower accepts it and you receive an order confirmation email. Payment is processed at the time of order. We use a third-party payment processor and do not store card details. All prices are displayed in Australian dollars (AUD). GST is included in retail prices and excluded from wholesale (ex-GST) prices where indicated.
        </Section>

        <Section title="7. Delivery and Fulfilment">
          Delivery is arranged between the grower and buyer based on the terms specified in the listing. The Green Guild is not responsible for delivery delays or failures caused by growers, logistics providers, or circumstances outside our control. Hub pickup options are subject to hub availability as indicated at checkout.
        </Section>

        <Section title="8. Cancellations and Refunds">
          Because produce is harvested to order, cancellations after a grower has confirmed an order may not be possible. If you need to cancel an order, contact us as soon as possible at <a href="mailto:support@thegreenguild.com.au" style={{ color: FG }}>support@thegreenguild.com.au</a>. Refunds for goods that arrive damaged, incorrect, or not as described will be assessed on a case-by-case basis. We aim to resolve all disputes fairly and promptly.
        </Section>

        <Section title="9. Intellectual Property">
          All content on the Platform including the brand, logo, illustrations, software, and written content is the property of The Green Guild Pty Ltd or its licensors and is protected by Australian and international intellectual property laws. You may not reproduce, distribute, or create derivative works from any Platform content without our prior written consent. Growers and buyers retain ownership of content they upload (product photos, descriptions) but grant us a non-exclusive licence to display such content on the Platform.
        </Section>

        <Section title="10. Prohibited Conduct">
          You must not:
          <ul style={listStyle}>
            <li>Use the Platform for any unlawful purpose</li>
            <li>Misrepresent your identity, ABN, or the nature of your produce</li>
            <li>Circumvent the Platform to transact directly with users you discovered through the Platform</li>
            <li>Interfere with or disrupt the Platform&rsquo;s security or operation</li>
            <li>Post false, misleading, or defamatory reviews or content</li>
            <li>Scrape or systematically extract data from the Platform</li>
          </ul>
          We reserve the right to suspend or terminate accounts that violate these terms.
        </Section>

        <Section title="11. Limitation of Liability">
          To the maximum extent permitted by Australian Consumer Law, The Green Guild&rsquo;s liability for any claim arising from use of the Platform is limited to the amount you paid in the transaction giving rise to the claim. We are not liable for indirect, consequential, incidental, or special damages including loss of profit or business opportunity. Nothing in these terms excludes rights that cannot be excluded under the Australian Consumer Law, including statutory guarantees relating to the supply of goods and services.
        </Section>

        <Section title="12. Indemnity">
          You agree to indemnify and hold harmless The Green Guild Pty Ltd, its officers, employees, and agents from any claims, losses, or expenses (including reasonable legal fees) arising from your breach of these terms or your use of the Platform.
        </Section>

        <Section title="13. Termination">
          We may suspend or terminate your account at any time for breach of these terms, conduct that we reasonably consider harmful to other users or the Platform, or for any other reason with reasonable notice. You may close your account at any time by contacting us. Outstanding obligations (including payment for confirmed orders) survive termination.
        </Section>

        <Section title="14. Governing Law">
          These terms are governed by the laws of Victoria, Australia. You submit to the non-exclusive jurisdiction of the courts of Victoria for any dispute arising under these terms.
        </Section>

        <Section title="15. Changes to These Terms">
          We may update these Terms &amp; Conditions from time to time. We will notify registered users of material changes by email or a prominent notice on the Platform at least 14 days before the changes take effect. Continued use of the Platform after that date constitutes acceptance of the updated terms.
        </Section>

        <Section title="16. Contact">
          For any questions about these Terms &amp; Conditions, contact us at:
          <br /><br />
          The Green Guild Pty Ltd<br />
          <a href="mailto:support@thegreenguild.com.au" style={{ color: FG }}>support@thegreenguild.com.au</a>
        </Section>

        <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: `1px solid rgba(27,58,45,0.12)`, display: 'flex', gap: '2rem' }}>
          <Link href="/privacy" style={{ color: INK, fontSize: '0.875rem' }}>Privacy Policy →</Link>
          <Link href="/" style={{ color: INK, fontSize: '0.875rem' }}>Back to home →</Link>
        </div>
      </div>
    </main>
  )
}

const listStyle: React.CSSProperties = {
  paddingLeft: '1.5rem',
  marginTop: '0.75rem',
  marginBottom: '0.75rem',
  lineHeight: 1.8,
  color: '#4A5240',
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '2.5rem' }}>
      <h2 style={{
        fontFamily: 'var(--font-display)',
        fontSize: '1.1rem', fontWeight: 600, color: FG,
        marginBottom: '0.75rem', letterSpacing: '-0.01em',
      }}>
        {title}
      </h2>
      <p style={{ color: '#4A5240', lineHeight: 1.8, fontSize: '0.95rem' }}>
        {children}
      </p>
    </div>
  )
}
