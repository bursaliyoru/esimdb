import type { Payload } from 'payload'
import { DEFAULT_PROVIDERS } from './adapters'

export interface ProviderRow {
  /** Undefined for built-in defaults that are not in the DB yet (dry-run only). */
  id?: number
  slug: string
  name: string
  website: string
  trustpilotDomain?: string | null
  logoUrl?: string | null
  scraper?: string | null
  active: boolean
}

/**
 * Loads providers from the DB, optionally filtered by slug. In dry-run mode built-in defaults fill in
 * providers missing from the DB so the scrapers can be tried before seeding.
 */
export async function loadProviders(payload: Payload | null, opts: { slug?: string; includeDefaults?: boolean }): Promise<ProviderRow[]> {
  const rows: ProviderRow[] = []
  if (payload) {
    const res = await payload.find({
      collection: 'providers',
      limit: 500,
      depth: 0,
      pagination: false,
      where: opts.slug ? { slug: { equals: opts.slug } } : undefined,
    })
    for (const p of res.docs) {
      rows.push({
        id: p.id,
        slug: p.slug,
        name: p.name,
        website: p.website,
        trustpilotDomain: p.trustpilotDomain,
        logoUrl: p.logoUrl,
        scraper: p.scraper,
        active: p.active !== false,
      })
    }
  }
  if (opts.includeDefaults) {
    for (const d of DEFAULT_PROVIDERS) {
      if (opts.slug && d.slug !== opts.slug) continue
      if (!rows.some((r) => r.slug === d.slug)) rows.push({ ...d, active: true })
    }
  }
  return rows
}
