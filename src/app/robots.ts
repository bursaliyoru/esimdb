export const dynamic = 'force-dynamic'

import type { MetadataRoute } from 'next'
import { site } from '@/lib/site'

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api', '/go/', '/review-submit'] }], sitemap: `${site.url}/sitemap.xml` }
}
