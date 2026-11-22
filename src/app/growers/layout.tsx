import type { Metadata } from 'next'
import type { ReactNode } from 'react'

// growers/page.tsx is a client component, so its metadata has to live here —
// Next.js only reads `metadata` exports from server components/layouts.
export const metadata: Metadata = {
  title: 'Our Growers — The Green Guild',
  description: 'Meet the Australian flower and produce growers selling direct on The Green Guild. Browse growers by region and shop farm-fresh, straight from the source.',
  alternates: { canonical: '/growers' },
}

export default function GrowersLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
