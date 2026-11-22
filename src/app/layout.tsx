import type { Metadata } from 'next'
import { Anton, Inter } from 'next/font/google'
import './globals.css'

// Next.js 15: fonts must be loaded via next/font, not <link> tags in <head>
const anton = Anton({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://thegreenguild.com.au'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'The Green Guild — Farm-fresh flowers & produce, direct to you',
  description: "Australia's freshest B2B flower and produce marketplace — buy direct from local growers and hubs, or sell what you grow. Based in Australia.",
  keywords: [
    'The Green Guild', 'Green Guild Australia', 'flower marketplace Australia',
    'buy flowers direct from growers', 'Australian flower growers', 'wholesale flowers Australia',
    'farm fresh produce Australia', 'flower farm marketplace',
  ],
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    locale: 'en_AU',
    url: siteUrl,
    siteName: 'The Green Guild',
    title: 'The Green Guild — Farm-fresh flowers & produce, direct to you',
    description: "Australia's freshest B2B flower and produce marketplace — buy direct from local growers and hubs, or sell what you grow.",
  },
  twitter: {
    card: 'summary',
    title: 'The Green Guild — Farm-fresh flowers & produce, direct to you',
    description: "Australia's freshest B2B flower and produce marketplace.",
  },
}

// Organization structured data — tells search engines (and specifically
// disambiguates from unrelated same-name businesses, e.g. cannabis brands
// also using "Green Guild") that this is an Australian flower/produce
// marketplace, not a generic site.
const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'The Green Guild',
  url: siteUrl,
  logo: `${siteUrl}/favicon.ico`,
  description: "Australia's freshest B2B flower and produce marketplace, connecting local growers directly with buyers.",
  address: { '@type': 'PostalAddress', addressCountry: 'AU' },
  areaServed: 'AU',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU" data-scroll-behavior="smooth" className={``}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        {children}
      </body>
    </html>
  )
}
