/**
 * Trustpilot TrustScore + latest reviews.
 *
 * LEGAL NOTE: Trustpilot's Terms of Use restrict automated collection (scraping) of their pages and
 * content. The compliant route is the official Trustpilot API (Business Units endpoints), which needs an
 * API key from Trustpilot: set TRUSTPILOT_API_KEY and this module uses the API instead of the web page.
 *   GET https://api.trustpilot.com/v1/business-units/find?name=<domain>&apikey=KEY
 *   GET https://api.trustpilot.com/v1/business-units/{id}?apikey=KEY
 *   GET https://api.trustpilot.com/v1/business-units/{id}/reviews?apikey=KEY&perPage=20&orderBy=createdat.desc
 * (Trustpilot's docs write these as /business-units/; some older references say /businessunits/.)
 * Get the site owner's sign-off before enabling page scraping in production; disable it with
 * TRUSTPILOT_ENABLED=false. Displayed reviews must keep attribution + a link back to Trustpilot
 * (we store externalUrl for that).
 *
 * Web fallback (no key): https://www.trustpilot.com/review/<domain> (+ ?page=2), parsing the page's
 * Next.js __NEXT_DATA__ JSON: props.pageProps.businessUnit / props.pageProps.reviews.
 * The web shape is from memory and UNVERIFIED against today's site — confirm on the first live run.
 */
import type { Payload } from 'payload'
import type { HttpClient } from './http'
import type { Logger } from './log'
import { errorMessage } from './log'
import { extractNextData } from './parse'
import type { ProviderRow } from './providers'
import { recordRun, type JobResult } from './db'

export const MAX_REVIEWS_PER_PROVIDER = 20

export interface TpReview {
  id: string
  rating: number
  title?: string
  text: string
  authorName: string
  authorCountry?: string
  publishedAt: string
  experiencedAt?: string
}

export interface TpSummary {
  businessUnitId?: string
  trustScore?: number
  reviewCount?: number
  reviews: TpReview[]
}

type Json = Record<string, unknown>
const isObj = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v)
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : undefined)
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

function isoDate(v: unknown): string | undefined {
  const s = str(v)
  if (!s) return undefined
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

function normalizeReview(r: Json): TpReview | undefined {
  const id = str(r.id)
  const rating = num(r.rating ?? r.stars)
  const consumer = isObj(r.consumer) ? r.consumer : {}
  const dates = isObj(r.dates) ? r.dates : {}
  const publishedAt = isoDate(dates.publishedDate ?? r.createdAt ?? r.publishedDate ?? dates.submittedDate)
  const title = str(r.title)
  const text = str(r.text) ?? title
  if (!id || !rating || rating < 1 || rating > 5 || !publishedAt || !text) return undefined
  return {
    id,
    rating: Math.round(rating),
    title,
    text,
    authorName: str(consumer.displayName) ?? str(consumer.name) ?? 'Trustpilot user',
    authorCountry: str(consumer.countryCode)?.toUpperCase() ?? str(consumer.country) ?? str(r.location),
    publishedAt,
    experiencedAt: isoDate(dates.experiencedDate ?? r.experiencedAt),
  }
}

/** Parses a trustpilot.com/review/<domain> page (its __NEXT_DATA__ JSON). */
export function parseTrustpilotPage(html: string): TpSummary {
  const data = extractNextData(html)
  const pageProps = isObj(data) && isObj(data.props) && isObj(data.props.pageProps) ? data.props.pageProps : undefined
  if (!pageProps) throw new Error('Trustpilot page: __NEXT_DATA__ pageProps not found')
  const bu = isObj(pageProps.businessUnit) ? pageProps.businessUnit : {}
  const reviews = (Array.isArray(pageProps.reviews) ? pageProps.reviews : []).filter(isObj).map(normalizeReview).filter((r): r is TpReview => !!r)
  const score = isObj(bu.score) ? bu.score : undefined
  const count = isObj(bu.numberOfReviews) ? bu.numberOfReviews.total : bu.numberOfReviews
  const filters = isObj(pageProps.filters) && isObj(pageProps.filters.reviewStatistics) ? pageProps.filters.reviewStatistics : undefined
  return {
    businessUnitId: str(bu.id),
    trustScore: num(bu.trustScore ?? score?.trustScore),
    reviewCount: num(count) ?? num(isObj(filters?.ratings) ? filters.ratings.total : undefined),
    reviews,
  }
}

/** Parses the official API responses (business unit + reviews list). */
export function parseTrustpilotApi(bu: unknown, reviewsJson: unknown): TpSummary {
  const b = isObj(bu) ? bu : {}
  const score = isObj(b.score) ? b.score : {}
  const count = isObj(b.numberOfReviews) ? b.numberOfReviews.total : b.numberOfReviews
  const list = isObj(reviewsJson) && Array.isArray(reviewsJson.reviews) ? reviewsJson.reviews : []
  return {
    businessUnitId: str(b.id),
    trustScore: num(score.trustScore ?? b.trustScore),
    reviewCount: num(count),
    reviews: list.filter(isObj).map(normalizeReview).filter((r): r is TpReview => !!r),
  }
}

async function fetchViaApi(http: HttpClient, domain: string, apiKey: string): Promise<TpSummary> {
  const base = process.env.TRUSTPILOT_API_BASE || 'https://api.trustpilot.com/v1'
  const k = encodeURIComponent(apiKey)
  const headers = { apikey: apiKey }
  const found = await http.getJson<Json>(`${base}/business-units/find?name=${encodeURIComponent(domain)}&apikey=${k}`, { headers })
  const id = str(found.id)
  if (!id) throw new Error(`Trustpilot API: business unit not found for ${domain}`)
  const bu = await http.getJson<unknown>(`${base}/business-units/${id}?apikey=${k}`, { headers })
  const reviews = await http.getJson<unknown>(
    `${base}/business-units/${id}/reviews?apikey=${k}&perPage=${MAX_REVIEWS_PER_PROVIDER}&orderBy=createdat.desc`,
    { headers },
  )
  return parseTrustpilotApi(bu, reviews)
}

async function fetchViaWeb(http: HttpClient, domain: string, pages = 2): Promise<TpSummary> {
  const url = `https://www.trustpilot.com/review/${encodeURIComponent(domain)}`
  const first = parseTrustpilotPage(await http.getText(url))
  for (let page = 2; page <= pages && first.reviews.length < MAX_REVIEWS_PER_PROVIDER; page++) {
    try {
      const more = parseTrustpilotPage(await http.getText(`${url}?page=${page}`))
      first.reviews.push(...more.reviews.filter((r) => !first.reviews.some((x) => x.id === r.id)))
    } catch {
      break
    }
  }
  return first
}

export async function fetchTrustpilot(http: HttpClient, domain: string): Promise<TpSummary> {
  const key = process.env.TRUSTPILOT_API_KEY
  const s = key ? await fetchViaApi(http, domain, key) : await fetchViaWeb(http, domain, Number(process.env.TRUSTPILOT_PAGES || 2))
  s.reviews = s.reviews.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, MAX_REVIEWS_PER_PROVIDER)
  return s
}

export function trustpilotEnabled(): boolean {
  return (process.env.TRUSTPILOT_ENABLED ?? 'true').toLowerCase() !== 'false'
}

export async function saveTrustpilot(payload: Payload, provider: ProviderRow & { id: number }, s: TpSummary): Promise<number> {
  const now = new Date().toISOString()
  await payload.update({
    collection: 'providers',
    id: provider.id,
    data: {
      ...(s.trustScore !== undefined ? { trustScore: s.trustScore } : {}),
      ...(s.reviewCount !== undefined ? { trustReviewCount: s.reviewCount } : {}),
      trustUpdatedAt: now,
    },
  })
  let changed = 0
  for (const r of s.reviews) {
    const externalId = `tp_${r.id}`
    const data = {
      provider: provider.id,
      source: 'trustpilot' as const,
      status: 'approved' as const,
      rating: r.rating,
      title: r.title ?? null,
      body: r.text,
      authorName: r.authorName,
      authorCountry: r.authorCountry ?? null,
      publishedAt: r.publishedAt,
      externalId,
      externalUrl: `https://www.trustpilot.com/reviews/${r.id}`,
    }
    const existing = await payload.find({ collection: 'reviews', where: { externalId: { equals: externalId } }, limit: 1, depth: 0 })
    const doc = existing.docs[0]
    if (doc) {
      if (doc.body !== data.body || doc.rating !== data.rating || doc.title !== data.title) {
        await payload.update({ collection: 'reviews', id: doc.id, data })
        changed++
      }
    } else {
      await payload.create({ collection: 'reviews', data })
      changed++
    }
  }
  // Keep only the latest N Trustpilot reviews for this provider.
  const all = await payload.find({
    collection: 'reviews',
    where: { and: [{ provider: { equals: provider.id } }, { source: { equals: 'trustpilot' } }] },
    sort: '-publishedAt',
    limit: 1000,
    depth: 0,
    pagination: false,
  })
  const extra = all.docs.slice(MAX_REVIEWS_PER_PROVIDER).map((d) => d.id)
  if (extra.length) await payload.delete({ collection: 'reviews', where: { id: { in: extra } } })
  return changed
}

/** Runs the Trustpilot job for the given providers. Returns one result per provider. */
export async function runTrustpilot(opts: {
  payload: Payload | null
  http: HttpClient
  providers: ProviderRow[]
  log: Logger
  dryRun: boolean
}): Promise<JobResult[]> {
  const results: JobResult[] = []
  if (!trustpilotEnabled()) {
    opts.log.info('TRUSTPILOT_ENABLED=false — skipping')
    return results
  }
  opts.log.info(`mode: ${process.env.TRUSTPILOT_API_KEY ? 'official API' : 'web page (__NEXT_DATA__)'}`)
  for (const p of opts.providers) {
    if (!p.trustpilotDomain) continue
    const job = `trustpilot:${p.slug}`
    const log = opts.log.child(p.slug)
    const started = new Date().toISOString()
    try {
      const s = await fetchTrustpilot(opts.http, p.trustpilotDomain)
      log.info(`TrustScore ${s.trustScore ?? '?'} from ${s.reviewCount ?? '?'} reviews; ${s.reviews.length} latest reviews parsed`)
      let changed = 0
      if (opts.dryRun || !opts.payload || p.id === undefined) {
        for (const r of s.reviews.slice(0, 5)) log.info(`  ${r.rating}★ ${r.authorName} (${r.authorCountry ?? '-'}) ${r.publishedAt.slice(0, 10)}: ${r.title ?? r.text.slice(0, 60)}`)
      } else {
        changed = await saveTrustpilot(opts.payload, { ...p, id: p.id }, s)
        await recordRun(opts.payload, job, started, 'ok', s.reviews.length, changed)
      }
      results.push({ job, ok: true, found: s.reviews.length, changed })
    } catch (err) {
      const msg = errorMessage(err)
      log.error(msg)
      if (!opts.dryRun && opts.payload) await recordRun(opts.payload, job, started, 'failed', 0, 0, msg).catch(() => {})
      results.push({ job, ok: false, found: 0, changed: 0, error: msg })
    }
  }
  return results
}
