import type { MetadataRoute } from 'next'
import { getCountries, getProviders } from '@/lib/data'
import { site } from '@/lib/site'

export const dynamic = 'force-dynamic'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [countries, providers] = await Promise.all([getCountries(), getProviders()])
  const u = (path: string, priority = 0.6): MetadataRoute.Sitemap[number] => ({ url: `${site.url}${path}`, changeFrequency: 'daily', priority })
  return [
    u('/', 1),
    u('/best-esim', 0.9),
    u('/promo-codes', 0.9),
    u('/providers', 0.7),
    ...countries.flatMap((c) => [u(`/esim/${c.slug}`, 0.9), u(`/best-esim/${c.slug}`, 0.8)]),
    ...providers.flatMap((p) => [u(`/providers/${p.slug}`, 0.7), u(`/promo-codes/${p.slug}`, 0.8)]),
  ]
}
