/**
 * Airalo adapter.
 *
 * Two modes:
 *  1. Official Partner API (preferred, compliant) when AIRALO_CLIENT_ID + AIRALO_CLIENT_SECRET are set:
 *       POST https://partners-api.airalo.com/v2/token   (client_credentials)
 *       GET  https://partners-api.airalo.com/v2/packages?limit=100&page=N
 *     Response shape follows Airalo's public Partner API docs (data[].operators[].packages[]).
 *     NOTE: `price` there is the partner's suggested retail price (USD); `net_price` is the partner cost.
 *  2. Website JSON that airalo.com's own frontend calls (UNVERIFIED — confirm on the first live run):
 *       GET https://www.airalo.com/api/v2/countries                  → list of { slug, country_code, ... }
 *       GET https://www.airalo.com/api/v2/countries/{slug}           → { packages[] } or { operators[].packages[] }
 *       GET https://www.airalo.com/api/v2/regions (+ /regions/{slug}) for regional / global eSIMs
 *     Override the base with AIRALO_WEB_API (default https://www.airalo.com/api/v2).
 *
 * Package fields we rely on (both modes): id|slug, title, data ("1 GB"), amount (MB), day, is_unlimited, price.
 */
import type { Adapter, AdapterContext, ScrapedPlan } from '../types'
import { validatePlans } from '../types'
import { normIso2, parseDataSize, parsePrice, regionSlugFromName, slugify, totalDataMb } from '../parse'
import { errorMessage } from '../log'

type Json = Record<string, unknown>
const isObj = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v)
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : undefined)

function countriesOf(group: Json, op: Json | undefined): string[] {
  const out = new Set<string>()
  const add = (v: unknown) => {
    const c = normIso2(v)
    if (c) out.add(c)
  }
  for (const src of [op?.countries, op?.coverages, group.countries, group.coverages]) {
    for (const c of arr(src)) {
      if (isObj(c)) add(c.country_code ?? c.code ?? c.iso ?? c.name)
      else add(c)
    }
  }
  if (out.size === 0) add(group.country_code)
  return [...out]
}

function networksOf(op: Json | undefined): string | undefined {
  if (!op) return undefined
  const names = new Set<string>()
  for (const cov of arr(op.coverages)) {
    if (!isObj(cov)) continue
    for (const n of arr(cov.networks)) if (isObj(n) && typeof n.name === 'string') names.add(n.name)
  }
  for (const n of arr(op.networks)) if (isObj(n) && typeof n.name === 'string') names.add(n.name)
  return names.size ? [...names].slice(0, 10).join(', ') : undefined
}

function has5g(op: Json | undefined): boolean | undefined {
  if (!op) return undefined
  const types: string[] = []
  for (const cov of arr(op.coverages)) {
    if (!isObj(cov)) continue
    for (const n of arr(cov.networks)) if (isObj(n) && typeof n.type === 'string') types.push(n.type)
  }
  for (const n of arr(op.networks)) if (isObj(n) && typeof n.type === 'string') types.push(n.type)
  if (types.length === 0) return undefined
  return types.some((t) => /5G/i.test(t))
}

/**
 * Parses one Airalo "group" (a country, region or global entry) into plans.
 * Accepts { packages: [...] } or { operators: [{ packages: [...] }] }.
 */
export function parseAiraloGroup(group: unknown, opts: { kind?: 'country' | 'region' | 'global'; baseUrl?: string } = {}): Record<string, unknown>[] {
  if (!isObj(group)) return []
  const groupSlug = str(group.slug) ?? slugify(str(group.title) ?? '')
  const groupTitle = str(group.title) ?? groupSlug
  const operators: (Json | undefined)[] = arr(group.operators).filter(isObj)
  if (operators.length === 0) operators.push(undefined)
  const plans: Record<string, unknown>[] = []

  for (const op of operators) {
    const packages = arr(op?.packages ?? group.packages).filter(isObj)
    const countries = countriesOf(group, op)
    const regionFromGroup = regionSlugFromName(groupSlug) ?? regionSlugFromName(groupTitle)
    const kind = opts.kind ?? (regionFromGroup === 'global' ? 'global' : countries.length > 1 || regionFromGroup ? 'region' : 'country')
    const scope: ScrapedPlan['scope'] = kind === 'global' ? 'global' : kind === 'region' ? 'regional' : 'single'
    const regionSlug = scope === 'regional' ? (regionFromGroup ?? slugify(groupSlug)) : undefined

    for (const p of packages) {
      const id = str(p.slug) ?? str(p.id)
      const validityDays = typeof p.day === 'number' ? p.day : Number(p.day ?? p.validity)
      const price = parsePrice(p.price)
      if (!id || !price || !validityDays) continue
      let dataMb: number | null
      let dailyMb: number | undefined
      if (p.is_unlimited === true || /unlimited/i.test(String(p.data ?? ''))) {
        dataMb = null
      } else {
        const parsed = parseDataSize(p.data) ?? (typeof p.amount === 'number' ? { dataMb: p.amount } : undefined)
        if (!parsed) continue
        dataMb = parsed.dataMb
        dailyMb = parsed.dailyMb
      }
      const voice = typeof p.voice === 'number' ? p.voice > 0 : undefined
      plans.push({
        externalId: id,
        name: `${groupTitle} ${str(p.title) ?? str(p.data) ?? ''}`.trim(),
        countries: scope === 'single' ? countries.slice(0, 1) : countries,
        scope,
        regionSlug,
        dataMb: totalDataMb({ dataMb, dailyMb, validityDays }),
        dailyMb,
        validityDays,
        price: price.amount,
        currency: (str(p.currency) ?? 'USD').toUpperCase(),
        fiveG: has5g(op),
        phoneNumber: voice,
        network: networksOf(op),
        url: opts.baseUrl && groupSlug ? `${opts.baseUrl}/${groupSlug}-esim` : undefined,
      })
    }
  }
  return plans
}

/** Parses a Partner API /v2/packages page or any list of groups. */
export function parseAiraloPackages(json: unknown): ScrapedPlan[] {
  const groups = isObj(json) ? arr(json.data) : arr(json)
  return validatePlans(groups.flatMap((g) => parseAiraloGroup(g, { baseUrl: 'https://www.airalo.com' })))
}

async function viaPartnerApi(ctx: AdapterContext, clientId: string, clientSecret: string): Promise<ScrapedPlan[]> {
  const base = process.env.AIRALO_PARTNER_API || 'https://partners-api.airalo.com/v2'
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'client_credentials' }).toString()
  const tok = await ctx.http.getJson<{ data?: { access_token?: string } }>(`${base}/token`, {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  })
  const token = tok.data?.access_token
  if (!token) throw new Error('Airalo Partner API: no access_token in token response')
  const plans: ScrapedPlan[] = []
  for (let page = 1; page <= 50; page++) {
    const json = await ctx.http.getJson<{ meta?: { last_page?: number } }>(`${base}/packages?limit=100&page=${page}`, {
      headers: { authorization: `Bearer ${token}` },
    })
    plans.push(...parseAiraloPackages(json))
    const last = json.meta?.last_page
    if (!last || page >= last) break
  }
  return plans
}

async function viaWebsite(ctx: AdapterContext): Promise<ScrapedPlan[]> {
  const base = process.env.AIRALO_WEB_API || 'https://www.airalo.com/api/v2'
  const plans: ScrapedPlan[] = []
  const wanted = new Set(ctx.countries.map((c) => c.iso2))
  let failures = 0
  let successes = 0

  const listOf = async (path: string): Promise<Json[]> => {
    const j = await ctx.http.getJson<unknown>(`${base}/${path}`)
    return (isObj(j) ? arr(j.data) : arr(j)).filter(isObj)
  }

  const groups: { slug: string; kind: 'country' | 'region' | 'global'; path: string }[] = []
  const countryList = await listOf('countries')
  for (const c of countryList) {
    const iso = normIso2(c.country_code)
    const slug = str(c.slug)
    if (slug && (!iso || wanted.size === 0 || wanted.has(iso))) groups.push({ slug, kind: 'country', path: `countries/${slug}` })
  }
  try {
    for (const r of await listOf('regions')) {
      const slug = str(r.slug)
      if (slug) groups.push({ slug, kind: regionSlugFromName(slug) === 'global' ? 'global' : 'region', path: `regions/${slug}` })
    }
  } catch (err) {
    ctx.log.warn(`regions list failed: ${errorMessage(err)}`)
  }

  for (const g of groups) {
    try {
      const j = await ctx.http.getJson<unknown>(`${base}/${g.path}`)
      const group = isObj(j) && isObj(j.data) ? j.data : j
      plans.push(...validatePlans(parseAiraloGroup(group, { kind: g.kind, baseUrl: 'https://www.airalo.com' }), ctx.log))
      successes++
    } catch (err) {
      failures++
      ctx.log.warn(`${g.path}: ${errorMessage(err)}`)
      if (successes === 0 && failures >= 3) throw new Error(`Airalo website API looks blocked: ${errorMessage(err)}`)
    }
  }
  return plans
}

export const airalo: Adapter = {
  key: 'airalo',
  providerSlug: 'airalo',
  implemented: true,
  source: 'Airalo Partner API (if AIRALO_CLIENT_ID/SECRET) else www.airalo.com/api/v2 countries + regions JSON (UNVERIFIED)',
  async fetchPlans(ctx) {
    const id = process.env.AIRALO_CLIENT_ID
    const secret = process.env.AIRALO_CLIENT_SECRET
    const plans = id && secret ? await viaPartnerApi(ctx, id, secret) : await viaWebsite(ctx)
    const seen = new Set<string>()
    return plans.filter((p) => (seen.has(p.externalId) ? false : (seen.add(p.externalId), true)))
  },
}
