import type { Metadata } from 'next'
import PublicShell from '../_components/PublicShell'

export const metadata: Metadata = {
  title: 'Privacy Policy — The Green Guild',
}

const FG = 'var(--navy)'

export default function PrivacyPage() {
  return (
    <PublicShell title="Privacy Policy" intro="Last updated: 1 June 2025" card>
        <Section title="1. Introduction">
          The Green Guild Pty Ltd (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;) operates the platform available at thegreenguild.com.au (the &ldquo;Platform&rdquo;). We are committed to protecting the personal information of all users, including growers, buyers, and hub coordinators. This Privacy Policy explains how we collect, use, disclose, and safeguard your information in accordance with the Australian Privacy Act 1988 (Cth) and the Australian Privacy Principles (APPs).
        </Section>

        <Section title="2. Information We Collect">
          We collect personal information you provide directly to us when you create an account, complete a transaction, or contact us. This may include:
          <ul style={listStyle}>
            <li>Full name, email address, and phone number</li>
            <li>Business name and ABN (for growers and B2B buyers)</li>
            <li>Delivery address and billing information</li>
            <li>Payment details (processed securely via our payment provider — we do not store card numbers)</li>
            <li>Profile and storefront information you choose to share</li>
            <li>Order history and marketplace activity</li>
          </ul>
          We also collect certain information automatically when you use the Platform, including IP address, browser type, device identifiers, and pages visited, primarily for security and analytics purposes.
        </Section>

        <Section title="3. How We Use Your Information">
          We use the information we collect to:
          <ul style={listStyle}>
            <li>Create and manage your account</li>
            <li>Process orders and facilitate payments between growers and buyers</li>
            <li>Send transactional emails (order confirmations, invoices, dispatch notifications)</li>
            <li>Send marketing communications where you have opted in</li>
            <li>Verify identity and prevent fraud</li>
            <li>Improve the Platform and understand how it is used</li>
            <li>Comply with legal obligations</li>
          </ul>
        </Section>

        <Section title="4. Disclosure of Your Information">
          We do not sell or rent your personal information to third parties. We may share your information with:
          <ul style={listStyle}>
            <li><strong>Other users</strong> — growers and buyers see limited profile information necessary to complete a transaction (e.g. business name, region, storefront details)</li>
            <li><strong>Service providers</strong> — payment processors, email delivery services, cloud hosting providers, and analytics tools that assist us in operating the Platform, under strict data processing agreements</li>
            <li><strong>Regulators and law enforcement</strong> — where required by law or to protect the rights, property, or safety of The Green Guild, our users, or the public</li>
          </ul>
        </Section>

        <Section title="5. Data Storage and Security">
          Your information is stored on secure servers located in Australia. We implement appropriate technical and organisational measures to protect your personal information against unauthorised access, disclosure, alteration, or destruction. However, no internet transmission is completely secure and we cannot guarantee absolute security.
        </Section>

        <Section title="6. Your Rights and Choices">
          Under the Australian Privacy Act you have the right to:
          <ul style={listStyle}>
            <li>Access the personal information we hold about you</li>
            <li>Request correction of inaccurate or incomplete information</li>
            <li>Request deletion of your account and associated data (subject to legal retention requirements)</li>
            <li>Opt out of marketing communications at any time via the unsubscribe link in any email</li>
          </ul>
          To exercise any of these rights, contact us at <a href="mailto:privacy@thegreenguild.com.au" style={{ color: FG }}>privacy@thegreenguild.com.au</a>.
        </Section>

        <Section title="7. Cookies">
          We use cookies and similar tracking technologies to maintain session state, remember preferences, and analyse Platform usage. You can control cookie settings through your browser; disabling cookies may affect Platform functionality.
        </Section>

        <Section title="8. Third-Party Links">
          The Platform may contain links to third-party websites. We are not responsible for the privacy practices of those sites and encourage you to review their privacy policies.
        </Section>

        <Section title="9. Children's Privacy">
          The Platform is not directed at children under 18. We do not knowingly collect personal information from children. If you believe a child has provided us personal information, please contact us and we will delete it.
        </Section>

        <Section title="10. Changes to This Policy">
          We may update this Privacy Policy from time to time. We will notify registered users of material changes by email or a prominent notice on the Platform. Continued use of the Platform after changes take effect constitutes acceptance of the updated policy.
        </Section>

        <Section title="11. Contact Us">
          If you have questions or complaints about this Privacy Policy or our privacy practices, please contact our Privacy Officer at:
          <br /><br />
          The Green Guild Pty Ltd<br />
          <a href="mailto:privacy@thegreenguild.com.au" style={{ color: FG }}>privacy@thegreenguild.com.au</a>
          <br /><br />
          If you are not satisfied with our response, you may lodge a complaint with the Office of the Australian Information Commissioner (OAIC) at <a href="https://www.oaic.gov.au" style={{ color: FG }}>oaic.gov.au</a>.
        </Section>
    </PublicShell>
  )
}

const listStyle: React.CSSProperties = {
  paddingLeft: '1.5rem',
  marginTop: '0.75rem',
  marginBottom: '0.75rem',
  lineHeight: 1.8,
  color: 'var(--moss)',
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
      <p style={{ color: 'var(--moss)', lineHeight: 1.8, fontSize: '0.95rem' }}>
        {children}
      </p>
    </div>
  )
}
