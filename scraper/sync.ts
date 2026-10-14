/**
 * Price job: runs adapters and writes results through the Payload Local API.
 *
 * Guarantees:
 *  - plans are upserted by key = `${providerSlug}:${externalId}`;
 *  - a price-snapshots row is written when a plan is new or its priceUsd changed;
 *  - previously active scraper plans (and seed sample plans) of that provider that were not seen in this run are deactivated —
 *    ONLY when the adapter succeeded and returned at least one valid plan (a failed/empty run never
 *    deactivates anything);
 *  - provider.lastScrapedAt / lastScrapeStatus are updated and one scrape-runs row is written per adapter.
 */
import type { Payload } from 'payload'
import type { Plan } from '../src/payload-types'
import { getAdapter } from './adapters'
import { toUsd, round2, type RateTable } from './currency'
import { recordRun, type JobResult } from './db'
import type { HttpClient } from './http'
import { errorMessage, type Logger } from './log'
import { countryName, slugify } from './parse'
import type { ProviderRow } from './providers'
import type { Adapter, CountryRef, ScrapedPlan } from './types'
import { validatePlans } from './types'

/** Used when the countries collection is empty (e.g. before seeding) for per-country adapters. */
export const DEFAULT_COUNTRY_CODES = [
  'US', 'GB', 'FR', 'ES', 'IT', 'DE', 'PT', 'NL', 'GR', 'TR', 'CH', 'AT', 'IE', 'JP', 'KR', 'CN', 'HK', 'TW', 'TH', 'VN',
  'ID', 'MY', 'SG', 'PH', 'IN', 'AE', 'SA', 'EG', 'MA', 'ZA', 'CA', 'MX', 'BR', 'AR', 'CO', 'PE', 'AU', 'NZ', 'IS', 'CZ',
]

export function countryRef(iso2: string, name?: string, slug?: string): CountryRef {
  const n = name ?? countryName(iso2)
  return { iso2: iso2.toUpperCase(), name: n, slug: slug ?? slugify(n) }
}

export async function loadCountryRefs(payload: Payload | null, only?: string[]): Promise<CountryRef[]> {
  let refs: CountryRef[] = []
  if (payload) {
    const res = await payload.find({ collection: 'countries', limit: 1000, depth: 0, pagination: false })
    refs = res.docs.map((c) => countryRef(c.iso2, c.name, c.slug))
  }
  if (refs.length === 0) refs = DEFAULT_COUNTRY_CODES.map((c) => countryRef(c))
  if (only?.length) {
    const want = new Set(only.map((c) => c.toUpperCase()))
    refs = refs.filter((r) => want.has(r.iso2))
    for (const c of want) if (!refs.some((r) => r.iso2 === c)) refs.push(countryRef(c))
  }
  const max = Number(process.env.SCRAPER_MAX_COUNTRIES || 0)
  return max > 0 ? refs.slice(0, max) : refs
}

/** Adds priceUsd to every plan; drops plans in unknown currencies. Pure. */
export function withUsd(plans: ScrapedPlan[], rates: RateTable, log?: Logger): (ScrapedPlan & { priceUsd: number })[] {
  const out: (ScrapedPlan & { priceUsd: number })[] = []
  for (const p of plans) {
    const usd = p.priceUsd ?? toUsd(p.price, p.currency, rates)
    if (!usd) {
      log?.warn(`${p.externalId}: unknown currency ${p.currency}, plan skipped`)
      continue
    }
    out.push({ ...p, priceUsd: round2(usd) })
  }
  return out
}

class RefCache {
  private countries = new Map<string, number>()
  private regions = new Map<string, number>()
  private loaded = false
  constructor(
    private readonly payload: Payload,
    private readonly log: Logger,
  ) {}

  private async load() {
    if (this.loaded) return
    const [c, r] = await Promise.all([
      this.payload.find({ collection: 'countries', limit: 1000, depth: 0, pagination: false }),
      this.payload.find({ collection: 'regions', limit: 500, depth: 0, pagination: false }),
    ])
    for (const d of c.docs) this.countries.set(d.iso2.toUpperCase(), d.id)
    for (const d of r.docs) this.regions.set(d.slug, d.id)
    this.loaded = true
  }

  async countryId(iso2: string): Promise<number> {
    await this.load()
    const code = iso2.toUpperCase()
    const hit = this.countries.get(code)
    if (hit) return hit
    const name = countryName(code)
    let slug = slugify(name) || code.toLowerCase()
    const clash = await this.payload.find({ collection: 'countries', where: { slug: { equals: slug } }, limit: 1, depth: 0 })
    if (clash.docs.length) slug = `${slug}-${code.toLowerCase()}`
    const doc = await this.payload.create({ collection: 'countries', data: { name, slug, iso2: code } })
    this.log.info(`created country ${code} (${name})`)
    this.countries.set(code, doc.id)
    return doc.id
  }

  async regionId(slug: string): Promise<number> {
    await this.load()
    const hit = this.regions.get(slug)
    if (hit) return hit
    const name = slug
      .split('-')
      .map((w) => (w === 'and' ? w : w.charAt(0).toUpperCase() + w.slice(1)))
      .join(' ')
    const doc = await this.payload.create({ collection: 'regions', data: { name, slug } })
    this.log.info(`created region ${slug}`)
    this.regions.set(slug, doc.id)
    return doc.id
  }
}

export interface SyncStats {
  found: number
  created: number
  priceChanged: number
  reactivated: number
  deactivated: number
}

export async function syncProviderPlans(
  payload: Payload,
  provider: ProviderRow & { id: number },
  plans: (ScrapedPlan & { priceUsd: number })[],
  rates: RateTable,
  log: Logger,
  refs = new RefCache(payload, log),
): Promise<SyncStats> {
  const now = new Date().toISOString()
  const stats: SyncStats = { found: plans.length, created: 0, priceChanged: 0, reactivated: 0, deactivated: 0 }

  const existing = await payload.find({
    collection: 'plans',
    where: { provider: { equals: provider.id } },
    limit: 100_000,
    depth: 0,
    pagination: false,
  })
  const byKey = new Map<string, Plan>(existing.docs.map((d) => [d.key, d]))
  const seen = new Set<string>()

  for (const p of plans) {
    const key = `${provider.slug}:${p.externalId}`
    seen.add(key)
    const countryIds: number[] = []
    for (const iso of p.countries) countryIds.push(await refs.countryId(iso))
    const regionId = p.regionSlug ? await refs.regionId(p.regionSlug) : null
    const originalUsd = p.originalPrice ? toUsd(p.originalPrice, p.currency, rates) : undefined

    const data = {
      key,
      provider: provider.id,
      externalId: p.externalId,
      name: p.name,
      scope: p.scope,
      region: regionId,
      countries: countryIds,
      dataMb: p.dataMb,
      dailyMb: p.dailyMb ?? null,
      validityDays: p.validityDays,
      priceUsd: p.priceUsd,
      originalPriceUsd: originalUsd ?? null,
      price: p.price,
      currency: p.currency,
      network: p.network ?? null,
      ...(p.fiveG !== undefined ? { fiveG: p.fiveG } : {}),
      ...(p.hotspot !== undefined ? { hotspot: p.hotspot } : {}),
      ...(p.phoneNumber !== undefined ? { phoneNumber: p.phoneNumber } : {}),
      ...(p.newUsersOnly !== undefined ? { newUsersOnly: p.newUsersOnly } : {}),
      url: p.url ?? null,
      active: true,
      lastSeenAt: now,
      source: 'scraper' as const,
    }

    const prev = byKey.get(key)
    let planId: number
    let snapshot = false
    if (!prev) {
      const doc = await payload.create({ collection: 'plans', data })
      planId = doc.id
      stats.created++
      snapshot = true
    } else {
      planId = prev.id
      if (Math.abs((prev.priceUsd ?? 0) - p.priceUsd) >= 0.005) {
        stats.priceChanged++
        snapshot = true
      }
      if (prev.active === false) stats.reactivated++
      await payload.update({ collection: 'plans', id: prev.id, data })
    }
    if (snapshot) await payload.create({ collection: 'price-snapshots', data: { plan: planId, priceUsd: p.priceUsd, capturedAt: now } })
  }

  // Deactivate this provider's scraper plans that disappeared. Callers only reach here on success.
  // Sample plans from scripts/seed.ts (source 'seed') are retired too once real data exists for the
  // provider (disable with SCRAPER_DEACTIVATE_SEED=false). Manual plans are never touched.
  const retireSeed = (process.env.SCRAPER_DEACTIVATE_SEED ?? 'true') !== 'false'
  for (const d of existing.docs) {
    const retirable = d.source === 'scraper' || (retireSeed && d.source === 'seed')
    if (retirable && d.active !== false && !seen.has(d.key)) {
      await payload.update({ collection: 'plans', id: d.id, data: { active: false } })
      stats.deactivated++
    }
  }
  return stats
}

function adapterFor(p: ProviderRow): Adapter | undefined {
  return getAdapter(p.scraper || p.slug)
}

function summarize(plans: ScrapedPlan[]): string {
  const byScope = plans.reduce<Record<string, number>>((acc, p) => ((acc[p.scope] = (acc[p.scope] ?? 0) + 1), acc), {})
  return Object.entries(byScope)
    .map(([k, v]) => `${v} ${k}`)
    .join(', ')
}

export async function runPrices(opts: {
  payload: Payload | null
  http: HttpClient
  providers: ProviderRow[]
  countries: CountryRef[]
  rates: RateTable
  log: Logger
  dryRun: boolean
  /** true when the user asked for one provider explicitly — stubs then run (and fail) instead of being skipped. */
  explicit: boolean
}): Promise<JobResult[]> {
  const results: JobResult[] = []
  const refs = opts.payload ? new RefCache(opts.payload, opts.log) : undefined

  for (const provider of opts.providers) {
    const adapter = adapterFor(provider)
    const job = `prices:${provider.slug}`
    const log = opts.log.child(provider.slug)
    if (!adapter) {
      if (opts.explicit) results.push({ job, ok: false, found: 0, changed: 0, error: 'no adapter registered' })
      log.debug('no adapter registered — skipped')
      continue
    }
    if (!provider.active && !opts.explicit) {
      log.info('provider inactive — skipped')
      continue
    }
    if (!adapter.implemented && !opts.explicit) {
      log.info('adapter not implemented yet — skipped')
      results.push({ job, ok: false, skipped: true, found: 0, changed: 0 })
      continue
    }

    const started = new Date().toISOString()
    log.info(`fetching via ${adapter.source}`)
    try {
      const raw = await adapter.fetchPlans({ http: opts.http, log, countries: opts.countries, website: provider.website })
      const plans = withUsd(validatePlans(raw, log), opts.rates, log)
      if (plans.length === 0) throw new Error('adapter returned 0 valid plans (treated as failure; nothing deactivated)')
      log.info(`${plans.length} plans (${summarize(plans)})`)

      if (opts.dryRun || !opts.payload || provider.id === undefined) {
        for (const p of plans.slice(0, 15)) {
          const data = p.dataMb === null ? 'unlimited' : `${p.dataMb}MB`
          log.info(`  ${p.externalId} | ${p.name} | ${p.countries.slice(0, 5).join(',')}${p.countries.length > 5 ? '…' : ''} | ${data} | ${p.validityDays}d | ${p.price} ${p.currency} = $${p.priceUsd}`)
        }
        if (plans.length > 15) log.info(`  … and ${plans.length - 15} more`)
        if (!opts.dryRun && provider.id === undefined) log.warn('provider is not in the DB — nothing written (seed providers first)')
        results.push({ job, ok: true, found: plans.length, changed: 0 })
        continue
      }

      const stats = await syncProviderPlans(opts.payload, { ...provider, id: provider.id }, plans, opts.rates, log, refs)
      const changed = stats.created + stats.priceChanged + stats.reactivated + stats.deactivated
      log.info(`saved: ${stats.created} new, ${stats.priceChanged} price changes, ${stats.reactivated} reactivated, ${stats.deactivated} deactivated`)
      await opts.payload.update({
        collection: 'providers',
        id: provider.id,
        data: { lastScrapedAt: new Date().toISOString(), lastScrapeStatus: `ok: ${plans.length} plans` },
      })
      await recordRun(opts.payload, job, started, 'ok', plans.length, changed)
      results.push({ job, ok: true, found: plans.length, changed })
    } catch (err) {
      const msg = errorMessage(err)
      log.error(msg)
      if (!opts.dryRun && opts.payload && provider.id !== undefined) {
        await opts.payload
          .update({
            collection: 'providers',
            id: provider.id,
            data: { lastScrapedAt: new Date().toISOString(), lastScrapeStatus: `error: ${msg.slice(0, 200)}` },
          })
          .catch((e) => log.error(`could not update provider status: ${errorMessage(e)}`))
        await recordRun(opts.payload, job, started, 'failed', 0, 0, msg).catch(() => {})
      }
      results.push({ job, ok: false, found: 0, changed: 0, error: msg })
    }
  }
  return results
}
