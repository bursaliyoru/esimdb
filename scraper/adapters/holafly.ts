/**
 * Holafly adapter.
 *
 * Holafly's store (esim.holafly.com) has historically run on Shopify, whose storefronts expose the
 * standard public catalogue endpoint:
 *     GET https://esim.holafly.com/products.json?limit=250&page=N
 * Each product is a destination ("eSIM United States", "eSIM Europe"), each variant a duration
 * ("7 days") — almost always with unlimited data.
 *
 * UNVERIFIED: confirm on the first live run that the endpoint still answers JSON. If Holafly has moved
 * off Shopify, set HOLAFLY_PRODUCTS_URL to the replacement or switch this adapter to the generic
 * per-country page parser in ./common.ts (template e.g. https://esim.holafly.com/esim-{slug}/).
 *
 * Currency: products.json returns the shop's base currency, which we can't see in the payload.
 * Default USD; override with HOLAFLY_CURRENCY (e.g. EUR).
 */
import type { Adapter, ScrapedPlan } from '../types'
import { validatePlans } from '../types'
import { countryNameToIso2, normIso2, parseDataSize, parsePrice, parseValidityDays, regionSlugFromName, slugify, totalDataMb } from '../parse'

type Json = Record<string, unknown>
const isObj = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v)
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

/** "eSIM United States" / "United States eSIM" / handle "esim-united-states" → "united-states". */
export function destinationKey(title: string, handle?: string): string {
  const fromTitle = slugify(title.replace(/\besims?\b/gi, '').replace(/\b(data|plan|prepaid|card|sim)\b/gi, ''))
  if (fromTitle) return fromTitle
  return slugify((handle ?? '').replace(/(^|-)esims?(-|$)/g, '-'))
}

export function parseHolaflyProducts(json: unknown, opts: { currency?: string; storeUrl?: string } = {}): ScrapedPlan[] {
  const currency = (opts.currency ?? 'USD').toUpperCase()
  const store = opts.storeUrl ?? 'https://esim.holafly.com'
  const products = arr(isObj(json) ? json.products : json).filter(isObj)
  const plans: Record<string, unknown>[] = []

  for (const prod of products) {
    const title = String(prod.title ?? '')
    const handle = typeof prod.handle === 'string' ? prod.handle : undefined
    const productType = String(prod.product_type ?? '')
    if (/gift|card\s*holder|accessor|insurance/i.test(`${title} ${productType}`)) continue
    const dest = destinationKey(title, handle)
    const tags: string[] = Array.isArray(prod.tags)
      ? prod.tags.map(String)
      : typeof prod.tags === 'string'
        ? prod.tags.split(',').map((t) => t.trim())
        : []

    const region = regionSlugFromName(dest)
    const iso = region ? undefined : countryNameToIso2(dest)
    // Regional products sometimes carry country codes as tags ("country:FR" or plain "FR").
    const tagCountries = tags.map((t) => normIso2(t.replace(/^(country|iso)[:_-]/i, ''))).filter((c): c is string => !!c)
    let scope: ScrapedPlan['scope']
    let countries: string[]
    if (region === 'global') {
      scope = 'global'
      countries = tagCountries
    } else if (region) {
      scope = 'regional'
      countries = tagCountries
    } else if (iso) {
      scope = 'single'
      countries = [iso]
    } else {
      continue // unknown destination — skip rather than guess
    }

    for (const v of arr(prod.variants).filter(isObj)) {
      if (v.available === false) continue
      const vTitle = [v.option1, v.option2, v.option3, v.title].filter((x) => typeof x === 'string').join(' ')
      const validity = vTitle.match(/(\d+)\s*(days?|d[ií]as?|jours?|weeks?|months?)/i)
      const validityDays = validity ? parseValidityDays(validity[0].replace(/d[ií]as?|jours?/i, 'days')) : undefined
      const price = parsePrice(v.price)
      if (!validityDays || !price) continue
      const data = /\d\s*(gb|mb)/i.test(vTitle) ? parseDataSize(vTitle) : { dataMb: null }
      if (!data) continue
      const compare = parsePrice(v.compare_at_price)
      plans.push({
        externalId: String(v.id ?? `${dest}-${validityDays}d`),
        name: `${title.trim()} – ${String(v.title ?? `${validityDays} days`).trim()}`,
        countries,
        scope,
        regionSlug: scope === 'regional' ? region : undefined,
        dataMb: totalDataMb({ dataMb: data.dataMb, dailyMb: data.dailyMb, validityDays }),
        dailyMb: data.dailyMb,
        validityDays,
        price: price.amount,
        currency,
        originalPrice: compare && compare.amount > price.amount ? compare.amount : undefined,
        // Holafly unlimited plans historically did not allow hotspot sharing (newer plans allow limited sharing).
        hotspot: data.dataMb === null ? false : undefined,
        url: handle ? `${store}/products/${handle}?variant=${String(v.id ?? '')}` : undefined,
      })
    }
  }
  return validatePlans(plans)
}

export const holafly: Adapter = {
  key: 'holafly',
  providerSlug: 'holafly',
  implemented: true,
  source: 'Shopify storefront esim.holafly.com/products.json (UNVERIFIED)',
  async fetchPlans(ctx) {
    const base = process.env.HOLAFLY_PRODUCTS_URL || 'https://esim.holafly.com/products.json'
    const store = new URL(base).origin
    const currency = process.env.HOLAFLY_CURRENCY || 'USD'
    const plans: ScrapedPlan[] = []
    for (let page = 1; page <= 20; page++) {
      const sep = base.includes('?') ? '&' : '?'
      const json = await ctx.http.getJson<{ products?: unknown[] }>(`${base}${sep}limit=250&page=${page}`)
      const products = arr(json.products)
      if (products.length === 0) break
      plans.push(...parseHolaflyProducts(json, { currency, storeUrl: store }))
      if (products.length < 250) break
    }
    return plans
  },
}
