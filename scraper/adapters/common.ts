import type { Adapter, AdapterContext, CountryRef, ScrapedPlan } from '../types'
import { validatePlans } from '../types'
import {
  extractJsonLd,
  extractNextData,
  extractNextFlightJson,
  findPlanCandidates,
  planLabel,
  plansFromJsonLd,
  syntheticId,
  totalDataMb,
  type PlanCandidate,
} from '../parse'
import { HttpError } from '../http'
import { errorMessage } from '../log'

export interface CandidateTarget {
  countries: string[]
  scope: ScrapedPlan['scope']
  regionSlug?: string
  /** Used for synthetic ids and to namespace source ids that are only unique per page. */
  scopeKey: string
  defaultCurrency: string
  url?: string
  /** Prefix source ids with scopeKey (when the source id is only unique within one destination page). */
  namespaceIds?: boolean
}

export function candidateToPlan(c: PlanCandidate, t: CandidateTarget): Record<string, unknown> {
  const sourceId = c.id ? (t.namespaceIds ? `${t.scopeKey.toLowerCase()}-${c.id}` : c.id) : syntheticId(t.scopeKey, c)
  return {
    externalId: sourceId,
    name: c.name?.trim() || planLabel(c),
    countries: c.countries?.length ? c.countries : t.countries,
    scope: t.scope,
    regionSlug: t.regionSlug,
    dataMb: totalDataMb(c),
    dailyMb: c.dailyMb,
    validityDays: c.validityDays,
    price: c.price,
    currency: (c.currency || t.defaultCurrency).toUpperCase(),
    originalPrice: c.originalPrice,
    fiveG: c.fiveG,
    hotspot: c.hotspot,
    phoneNumber: c.phoneNumber,
    newUsersOnly: c.newUsersOnly,
    network: c.network,
    url: t.url,
  }
}

/**
 * Generic page parser: tries Next.js __NEXT_DATA__, then App Router flight data, then JSON-LD offers,
 * and keeps the first source that yields plan-like objects.
 */
export function parsePlanPage(html: string, target: CandidateTarget): ScrapedPlan[] {
  let candidates: PlanCandidate[] = []
  const next = extractNextData(html)
  if (next) candidates = findPlanCandidates(next)
  if (candidates.length === 0) {
    for (const chunk of extractNextFlightJson(html)) candidates.push(...findPlanCandidates(chunk))
  }
  if (candidates.length === 0) candidates = plansFromJsonLd(extractJsonLd(html))
  return validatePlans(candidates.map((c) => candidateToPlan(c, target)))
}

/** Like parsePlanPage but also accepts a raw JSON body (for adapters pointed at a JSON endpoint). */
export function parseAnyPayload(body: string, target: CandidateTarget): ScrapedPlan[] {
  const t = body.trimStart()
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      return validatePlans(findPlanCandidates(JSON.parse(t)).map((c) => candidateToPlan(c, target)))
    } catch {
      /* fall through to HTML parsing */
    }
  }
  return parsePlanPage(body, target)
}

/** Fills a URL template: {slug} {iso2} {iso2lower} {name}. */
export function fillTemplate(tpl: string, c: CountryRef): string {
  return tpl
    .replaceAll('{slug}', c.slug)
    .replaceAll('{iso2}', c.iso2.toUpperCase())
    .replaceAll('{iso2lower}', c.iso2.toLowerCase())
    .replaceAll('{name}', encodeURIComponent(c.name))
}

export interface PerCountryAdapterOptions {
  key: string
  providerSlug: string
  source: string
  /** URL template; can be overridden with env `<KEY>_URL_TEMPLATE`. */
  urlTemplate: string
  defaultCurrency: string
  parse: (html: string, country: CountryRef, url: string) => ScrapedPlan[]
}

/**
 * Adapter that fetches one page per destination country. 404s are skipped silently (destination not sold);
 * the adapter fails only if every page failed or nothing at all was found.
 */
export function perCountryPageAdapter(o: PerCountryAdapterOptions): Adapter {
  return {
    key: o.key,
    providerSlug: o.providerSlug,
    implemented: true,
    source: o.source,
    async fetchPlans(ctx: AdapterContext): Promise<ScrapedPlan[]> {
      const tpl = process.env[`${o.key.toUpperCase()}_URL_TEMPLATE`] || o.urlTemplate
      const plans: ScrapedPlan[] = []
      let ok = 0
      let failed = 0
      let lastErr = ''
      for (const country of ctx.countries) {
        const url = fillTemplate(tpl, country)
        try {
          const res = await ctx.http.request(url, { accept: 'html', okStatuses: [404, 410] })
          if (res.status === 404 || res.status === 410) {
            ctx.log.debug(`${country.iso2}: not sold (${res.status})`)
            ok++
            continue
          }
          ok++
          const found = o.parse(res.body.toString('utf8'), country, res.url || url)
          ctx.log.debug(`${country.iso2}: ${found.length} plans`)
          plans.push(...found)
        } catch (err) {
          failed++
          lastErr = errorMessage(err)
          ctx.log.warn(`${country.iso2} ${url}: ${lastErr}`)
          // A hard block on the first few pages usually means everything will fail; bail early.
          if (ok === 0 && failed >= 3 && err instanceof HttpError) break
        }
      }
      if (ok === 0 && failed > 0) throw new Error(`all ${failed} page requests failed; last error: ${lastErr}`)
      return dedupe(plans)
    },
  }
}

export function dedupe(plans: ScrapedPlan[]): ScrapedPlan[] {
  const map = new Map<string, ScrapedPlan>()
  for (const p of plans) if (!map.has(p.externalId)) map.set(p.externalId, p)
  return [...map.values()]
}

export function notImplemented(key: string, providerSlug: string): Adapter {
  return {
    key,
    providerSlug,
    implemented: false,
    source: 'STUB — not implemented yet',
    async fetchPlans() {
      throw new Error(`adapter not implemented yet: ${key}`)
    },
  }
}
