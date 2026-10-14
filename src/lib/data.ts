import 'server-only'
import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { getPayload, type Where } from 'payload'
import config from '@payload-config'
import type { Country, Coupon, Plan, Provider, Ranking, Review } from '@/payload-types'
import { perGbUsd } from './format'
import { orderRanking, scoreProviders, type ScoreBreakdown } from './ranking'

export const db = cache(async () => getPayload({ config }))

export type PlanWithProvider = Plan & { provider: Provider }

const rel = <T extends { id: number | string }>(v: T | number | string | null | undefined): T | null =>
  v && typeof v === 'object' ? v : null

// Catalog reads are cached for 10 minutes; prices change once a day when the scraper runs.
const REVALIDATE = Number(process.env.CATALOG_CACHE_SECONDS || 600)
const cached = <A extends unknown[], R>(fn: (...a: A) => Promise<R>, key: string) =>
  cache(unstable_cache(fn, [key], { revalidate: REVALIDATE, tags: ['catalog'] }))

export const getCountries = cached(async (): Promise<Country[]> => {
  const p = await db()
  const r = await p.find({ collection: 'countries', limit: 500, sort: 'name', depth: 0 })
  return r.docs
}, 'countries')

export const getCountry = cache(async (slug: string): Promise<Country | null> => {
  const p = await db()
  const r = await p.find({ collection: 'countries', where: { slug: { equals: slug } }, limit: 1, depth: 1 })
  return r.docs[0] ?? null
})

export const getProviders = cached(async (): Promise<Provider[]> => {
  const p = await db()
  const r = await p.find({ collection: 'providers', where: { active: { equals: true } }, limit: 500, sort: 'name', depth: 1 })
  return r.docs
}, 'providers')

export const getProvider = cache(async (slug: string): Promise<Provider | null> => {
  const p = await db()
  const r = await p.find({ collection: 'providers', where: { slug: { equals: slug } }, limit: 1, depth: 1 })
  return r.docs[0] ?? null
})

export const getAllActivePlans = cached(async (): Promise<PlanWithProvider[]> => {
  const p = await db()
  const [r, providers] = await Promise.all([
    p.find({
      collection: 'plans',
      where: { active: { equals: true } },
      limit: 0,
      pagination: false,
      depth: 0,
      select: {
        name: true, scope: true, region: true, countries: true, dataMb: true, dailyMb: true, validityDays: true, priceUsd: true,
        originalPriceUsd: true, network: true, fiveG: true, hotspot: true, phoneNumber: true, newUsersOnly: true, url: true, provider: true, source: true,
      },
    }),
    getProviders(),
  ])
  const byId = new Map(providers.map((x) => [String(x.id), x]))
  const out: PlanWithProvider[] = []
  for (const d of r.docs) {
    const provider = byId.get(String(typeof d.provider === 'object' ? d.provider.id : d.provider))
    if (provider) out.push({ ...(d as Plan), provider })
  }
  return out
}, 'plans')

export function planCountryIds(plan: Plan): (number | string)[] {
  return (plan.countries ?? []).map((c) => (typeof c === 'object' && c ? c.id : c))
}

export const getPlansForCountry = cache(async (countryId: number | string): Promise<PlanWithProvider[]> => {
  const all = await getAllActivePlans()
  return all.filter((pl) => planCountryIds(pl).some((id) => String(id) === String(countryId)))
})

export const getPlansForProvider = cache(async (providerId: number | string): Promise<PlanWithProvider[]> => {
  const all = await getAllActivePlans()
  return all.filter((pl) => String(pl.provider.id) === String(providerId))
})

export const cheapestByCountry = cache(async (): Promise<Map<string, { min: number; count: number }>> => {
  const all = await getAllActivePlans()
  const m = new Map<string, { min: number; count: number }>()
  for (const pl of all) {
    for (const id of planCountryIds(pl)) {
      const k = String(id)
      const cur = m.get(k) ?? { min: Infinity, count: 0 }
      cur.count++
      if (pl.scope === 'single') cur.min = Math.min(cur.min, pl.priceUsd)
      m.set(k, cur)
    }
  }
  return m
})

export const hasSampleData = cache(async (): Promise<boolean> => {
  try {
    const p = await db()
    const r = await p.count({ collection: 'plans', where: { source: { equals: 'seed' }, active: { equals: true } } })
    return r.totalDocs > 0
  } catch {
    return false // no database during `next build`
  }
})

/* ---------- coupons ---------- */

export function isCouponLive(c: Coupon, now = new Date()): boolean {
  if (c.startsAt && new Date(c.startsAt) > now) return false
  if (c.expiresAt && new Date(c.expiresAt) < now) return false
  return true
}

export const getCoupons = cache(async (providerId?: number | string): Promise<(Coupon & { provider: Provider })[]> => {
  const p = await db()
  const where: Where = providerId ? { provider: { equals: providerId } } : {}
  const r = await p.find({ collection: 'coupons', where, limit: 500, sort: '-exclusive', depth: 1 })
  return r.docs as (Coupon & { provider: Provider })[]
})

/* ---------- reviews ---------- */

export const getReviews = cache(async (providerId: number | string, source: 'site' | 'trustpilot', limit = 20) => {
  const p = await db()
  const r = await p.find({
    collection: 'reviews',
    where: { and: [{ provider: { equals: providerId } }, { source: { equals: source } }, { status: { equals: 'approved' } }] },
    sort: '-publishedAt',
    limit,
    depth: 0,
  })
  return { docs: r.docs as Review[], total: r.totalDocs }
})

export const siteRatingSummary = cache(async (providerId: number | string) => {
  const p = await db()
  const r = await p.find({
    collection: 'reviews',
    where: { and: [{ provider: { equals: providerId } }, { source: { equals: 'site' } }, { status: { equals: 'approved' } }] },
    limit: 0,
    pagination: false,
    depth: 0,
    select: { rating: true },
  })
  if (!r.docs.length) return null
  const avg = r.docs.reduce((s, d) => s + (d.rating ?? 0), 0) / r.docs.length
  return { avg: Math.round(avg * 10) / 10, count: r.docs.length }
})

/* ---------- rankings ---------- */

export type RankedRow = {
  position: number
  provider: Provider
  score: ScoreBreakdown
  bestPlan: PlanWithProvider | null
  cheapestPlan: PlanWithProvider | null
  planCount: number
  coupon: Coupon | null
  entry: NonNullable<Ranking['entries']>[number] | null
}

export const getRanking = cache(async (slug: string) => {
  const p = await db()
  const r = await p.find({ collection: 'rankings', where: { slug: { equals: slug } }, limit: 1, depth: 2 })
  return r.docs[0] ?? null
})

export async function buildRanking(opts: {
  ranking: Ranking | null
  country?: Country | null
}): Promise<RankedRow[]> {
  const { ranking, country } = opts
  const providers = await getProviders()
  const plans = country ? await getPlansForCountry(country.id) : await getAllActivePlans()
  const coupons = await getCoupons()

  const byProvider = new Map<string, PlanWithProvider[]>()
  for (const pl of plans) {
    const k = String(pl.provider.id)
    byProvider.set(k, [...(byProvider.get(k) ?? []), pl])
  }
  const allPlans = await getAllActivePlans()
  const coverage = new Map<string, Set<string>>()
  for (const pl of allPlans) {
    const k = String(pl.provider.id)
    const s = coverage.get(k) ?? new Set<string>()
    planCountryIds(pl).forEach((id) => s.add(String(id)))
    coverage.set(k, s)
  }

  const candidates = providers.filter((pr) => (byProvider.get(String(pr.id)) ?? []).length > 0)
  const scores = scoreProviders(
    candidates.map((pr) => {
      const mine = byProvider.get(String(pr.id)) ?? []
      const per = mine.map((m) => perGbUsd(m)).filter((v): v is number => v != null && (v as number) > 0)
      return {
        id: pr.id,
        bestPerGbUsd: per.length ? Math.min(...per) : null,
        trustScore: pr.trustScore ?? null,
        countryCount: coverage.get(String(pr.id))?.size ?? 0,
        planCount: mine.length,
        features: {
          topUp: pr.topUp,
          hotspot: pr.hotspot,
          phoneNumber: pr.phoneNumber,
          hasApp: pr.hasApp,
          fiveGShare: mine.length ? mine.filter((m) => m.fiveG).length / mine.length : 0,
        },
      }
    }),
  )
  const autoOrder = [...candidates].sort((a, b) => (scores.get(b.id)?.total ?? 0) - (scores.get(a.id)?.total ?? 0)).map((x) => x.id)
  const entries = ranking?.entries ?? []
  const order = orderRanking(
    (ranking?.mode as 'auto' | 'hybrid' | 'manual') ?? 'hybrid',
    autoOrder,
    entries.map((e) => ({ providerId: rel<Provider>(e.provider)?.id ?? (e.provider as number), pinnedPosition: e.pinnedPosition, excluded: e.excluded })),
    ranking?.size ?? 10,
  )

  const now = new Date()
  return order
    .map((id, i): RankedRow | null => {
      const provider = providers.find((x) => String(x.id) === String(id))
      if (!provider) return null
      const mine = byProvider.get(String(id)) ?? []
      const withPer = mine.filter((m) => perGbUsd(m) != null && (m.dataMb ?? 0) >= 3 * 1024)
      const bestPlan = withPer.sort((a, b) => (perGbUsd(a) as number) - (perGbUsd(b) as number))[0] ?? null
      const cheapestPlan = [...mine].sort((a, b) => a.priceUsd - b.priceUsd)[0] ?? null
      const coupon = coupons.find((c) => String(c.provider.id) === String(id) && isCouponLive(c, now)) ?? null
      const entry = entries.find((e) => String(rel<Provider>(e.provider)?.id ?? e.provider) === String(id)) ?? null
      return {
        position: i + 1,
        provider,
        score: scores.get(id) ?? { price: 0, trust: 0, coverage: 0, features: 0, choice: 0, total: 0 },
        bestPlan,
        cheapestPlan,
        planCount: mine.length,
        coupon,
        entry,
      }
    })
    .filter((x): x is RankedRow => x !== null)
}
