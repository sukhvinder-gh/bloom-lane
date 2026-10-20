import type { Metadata } from 'next'
import Link from 'next/link'
import PublicShell, { PUBLIC_FG, PUBLIC_INK } from '../_components/PublicShell'

export const metadata: Metadata = {
  title: 'FAQ — The Green Guild',
  description: 'Answers to common questions about buying, selling, hubs, fees and payments on The Green Guild.',
}

type QA = { q: string; a: React.ReactNode }
type Group = { title: string; items: QA[] }

function link(href: string, text: string) {
  return <Link href={href} style={{ color: PUBLIC_FG, fontWeight: 600 }}>{text}</Link>
}

export default function FaqPage() {

  const groups: Group[] = [
    {
      title: 'About The Green Guild',
      items: [
        {
          q: 'What is The Green Guild?',
          a: 'An online marketplace that connects Australian growers directly with buyers. Growers list what they have each week, buyers order and pay online any time, and orders are delivered or picked up directly from the farm.',
        },
        {
          q: 'What can I buy or sell today?',
          a: 'The marketplace is flower-first: cut flowers, dried flowers, Australian natives and foliage are live. Vegetables, herbs, fruit, eggs and honey are planned and shown as "Coming soon".',
        },
        {
          q: 'Who can buy?',
          a: <>Business buyers such as florists, event stylists and other trade buyers can register now. Individual (retail) buying isn&rsquo;t open yet &mdash; it shows as &ldquo;Coming soon&rdquo; on the sign-up page. {link('/auth/register', 'Register here')}.</>,
        },
      ],
    },
    {
      title: 'For buyers',
      items: [
        {
          q: 'Why do I need a verified ABN?',
          a: 'Wholesale prices are for businesses. You can register and browse straight away, but checkout needs your ABN verified. Our team reviews this by hand, so if you can’t check out yet, your verification is still pending — contact us if it’s been a while.',
        },
        {
          q: 'How is pricing shown, and is GST included?',
          a: 'Wholesale buyers see each grower’s wholesale price excluding GST. GST of 10% is added at checkout for items where it applies: the product isn’t GST-free (raw, unprocessed food generally is) and the grower is registered for GST. Every line shows its GST clearly on your order and invoice.',
        },
        {
          q: 'When can I order?',
          a: 'Any time. There’s no weekly ordering window — as long as a product shows stock, you can add it to your cart and check out straight away.',
        },
        {
          q: 'Does adding to my cart reserve the stock?',
          a: 'Yes. Items you add are held for you for 60 minutes. If you don’t check out in that time the hold is released and the stock goes back on sale.',
        },
        {
          q: 'How do I pay?',
          a: 'At checkout you pay securely by card (and other methods shown there) through Stripe. We never see or store your full card details.',
        },
        {
          q: 'How do I get my order?',
          a: <>Two ways, and a grower may offer either or both:
            <ul style={{ margin: '0.6rem 0 0', paddingLeft: '1.25rem', lineHeight: 1.8 }}>
              <li><strong>Delivery</strong> &mdash; delivered to your address. Delivery costs are set by each grower, and you&rsquo;ll see the cost before you pay.</li>
              <li><strong>Farm pickup</strong> &mdash; collect directly from a grower who offers it, usually free.</li>
            </ul></>,
        },
        {
          q: 'What if there is a problem with my order?',
          a: `Contact us and our team will review it. If a refund is approved it goes back to your original payment method.`,
        },
      ],
    },
    {
      title: 'For growers',
      items: [
        {
          q: 'How do I start selling?',
          a: <>{link('/auth/register', 'Register')} as a grower, confirm your email, then complete your farm profile (&ldquo;Storefront&rdquo;) with your address and details. An admin reviews and approves new growers, usually within a day, and then you can choose a membership, connect your bank account and list products.</>,
        },
        {
          q: 'What does it cost?',
          a: <>New growers sign up on a <strong>Free Grower Listing</strong> — no membership fee. <strong>Hub Membership</strong> (hub trading days and weekly promotion) is coming soon and isn&rsquo;t open for new sign-ups yet. {link('/auth/register', 'Register')} for more details on pricing.</>,
        },
        {
          q: 'How much commission do you take?',
          a: <>A commission is deducted automatically from each sale before you are paid, and it&rsquo;s shown on every purchase order. {link('/auth/register', 'Register')} for more details.</>,
        },
        {
          q: 'How do I set my prices?',
          a: 'You set a wholesale price (excluding GST) per product, plus your own markup and B2B/B2C stock split for that product. Once retail buying opens, retail prices are calculated automatically from your wholesale price and markup — you never set a separate retail price.',
        },
        {
          q: 'How and when do I get paid?',
          a: `You connect a bank account through Stripe (about five minutes; Stripe verifies your identity). Once an order is marked delivered, your payout — sale value less commission — is sent automatically to your bank account.`,
        },
        {
          q: 'Do I have to join a hub?',
          a: 'No. Hub Membership is one option. You can also sell through farm pickup and your own delivery options without belonging to a hub. If you do join, you belong to one hub at a time and can switch from your Membership page.',
        },
        {
          q: 'What is the RCTI agreement?',
          a: 'If you are registered for GST, you authorise The Green Guild to issue Recipient Created Tax Invoices on your behalf for sales made through the platform. This is standard practice for produce marketplaces and you agree to it on your Membership page.',
        },
      ],
    },
    {
      title: 'Hubs & collectives',
      items: [
        {
          q: 'What is a hub?',
          a: 'A regional pickup point run by a coordinator that pools orders from several growers so buyers can collect everything in one place, on a set day.',
        },
        {
          q: 'How do I set up a hub?',
          a: <>{link('/auth/register', 'Register')} a coordinator account, then submit your hub&rsquo;s name and region. For details on any registration costs, register and we&rsquo;ll walk you through it. Every new hub is reviewed by an admin before it goes live, and you&rsquo;ll get an email as soon as it&rsquo;s approved. Growers can then join it.</>,
        },
      ],
    },
    {
      title: 'Your account',
      items: [
        {
          q: 'I forgot my password.',
          a: <>Use {link('/auth/forgot-password', 'Forgot password')} on the login page and we&rsquo;ll email you a reset link.</>,
        },
        {
          q: 'I can’t find the answer here.',
          a: <>{link('/contact', 'Contact us')} and we&rsquo;ll get back to you by email.</>,
        },
      ],
    },
  ]

  return (
    <PublicShell
      title="Frequently asked questions"
      intro="Quick answers about buying, selling and running a hub on The Green Guild."
    >
      {groups.map(group => (
        <section key={group.title} style={{ marginBottom: '2.5rem' }}>
          <h2 className="type-label-lg" style={{ color: PUBLIC_FG, marginBottom: '0.75rem' }}>
            {group.title}
          </h2>
          <div className="card" style={{ background: 'white', overflow: 'hidden' }}>
            {group.items.map((item, i) => (
              <details key={item.q} style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(27,58,45,0.08)' }}>
                <summary style={{ cursor: 'pointer', padding: '1.05rem 1.35rem', fontWeight: 600, fontSize: '0.95rem', color: PUBLIC_FG, listStylePosition: 'outside' }}>
                  {item.q}
                </summary>
                <div style={{ padding: '0 1.35rem 1.2rem', fontSize: '0.9rem', lineHeight: 1.75, color: PUBLIC_FG, opacity: 0.85 }}>
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}

      <p className="type-label-sm" style={{ color: PUBLIC_INK, textAlign: 'center' }}>
        For fees and pricing, please {link('/auth/register', 'register')} for more details.
      </p>
    </PublicShell>
  )
}
