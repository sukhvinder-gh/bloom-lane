import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/server'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://thegreenguild.com.au'

// Only the public, unauthenticated marketing pages — dashboard/cart/checkout/
// auth routes require a session and have nothing for a crawler to index.
// /marketplace is excluded too: its layout redirects logged-out visitors
// straight to /auth/login, so there's no public content there to list.
const STATIC_ROUTES = ['', '/growers', '/faq', '/contact', '/terms', '/privacy', '/register-interest/buyer', '/register-interest/grower']

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const admin = createAdminClient()
  const { data: farmers } = await admin
    .from('farmers')
    .select('id, updated_at')
    .eq('status', 'approved')

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map(route => ({
    url: `${siteUrl}${route}`,
    changeFrequency: route === '' ? 'daily' : 'weekly',
    priority: route === '' ? 1 : 0.7,
  }))

  const growerEntries: MetadataRoute.Sitemap = (farmers || []).map(f => ({
    url: `${siteUrl}/growers/${f.id}`,
    lastModified: f.updated_at ? new Date(f.updated_at) : undefined,
    changeFrequency: 'weekly',
    priority: 0.6,
  }))

  return [...staticEntries, ...growerEntries]
}
