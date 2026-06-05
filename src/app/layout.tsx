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

export const metadata: Metadata = {
  title: 'Bloom Lane — Farm-fresh flowers & produce, direct to you',
  description: "Australia's freshest B2B agricultural marketplace.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={``}>
      <body>{children}</body>
    </html>
  )
}
