import { z } from 'zod'
import type { HttpClient } from './http'
import type { Logger } from './log'

/** A plan exactly as an adapter scraped it. Prices are in the provider's own currency. */
export const ScrapedPlanSchema = z.object({
  externalId: z.string().min(1).max(200),
  name: z.string().min(1).max(300),
  /** ISO 3166-1 alpha-2, upper case. */
  countries: z.array(z.string().regex(/^[A-Z]{2}$/)),
  scope: z.enum(['single', 'regional', 'global']),
  regionSlug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  /** Total data in MB. null = unlimited. */
  dataMb: z.number().nonnegative().nullable(),
  /** For "X GB per day" plans. */
  dailyMb: z.number().positive().optional(),
  validityDays: z.number().int().positive().max(3650),
  price: z.number().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  priceUsd: z.number().positive().optional(),
  originalPrice: z.number().positive().optional(),
  fiveG: z.boolean().optional(),
  hotspot: z.boolean().optional(),
  phoneNumber: z.boolean().optional(),
  newUsersOnly: z.boolean().optional(),
  network: z.string().max(500).optional(),
  url: z.string().url().optional(),
})

export type ScrapedPlan = z.infer<typeof ScrapedPlanSchema>

/** Minimal country info adapters can use to build per-country URLs. */
export interface CountryRef {
  iso2: string
  name: string
  slug: string
}

export interface AdapterContext {
  http: HttpClient
  log: Logger
  /** Countries to cover for adapters that scrape one page per destination. */
  countries: CountryRef[]
  /** The provider's website from the DB (or the built-in default). */
  website: string
}

export interface Adapter {
  key: string
  providerSlug: string
  /** false = stub; skipped in full runs unless explicitly requested with --provider. */
  implemented: boolean
  /** Short human description of the data source, shown in logs and README. */
  source: string
  fetchPlans(ctx: AdapterContext): Promise<ScrapedPlan[]>
}

/** Validate a list of raw plans, dropping (and logging) invalid ones and duplicate externalIds. */
export function validatePlans(raw: unknown[], log?: Logger): ScrapedPlan[] {
  const out: ScrapedPlan[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const res = ScrapedPlanSchema.safeParse(item)
    if (!res.success) {
      log?.warn(`invalid plan dropped: ${res.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`)
      continue
    }
    if (seen.has(res.data.externalId)) continue
    seen.add(res.data.externalId)
    out.push(res.data)
  }
  return out
}
