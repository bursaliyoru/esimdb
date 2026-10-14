/**
 * Saily adapter (Nord Security).
 *
 * Source: one destination page per country, https://saily.com/esim-{slug}/ (e.g. /esim-japan/).
 * The page is server-rendered by Next.js; plans are read from the embedded __NEXT_DATA__ /
 * App Router flight JSON by field names (price, data/amount, validity/days), with JSON-LD Offer
 * blocks as a fallback.
 *
 * UNVERIFIED: the URL pattern and the embedded JSON shape must be confirmed on the first live run.
 * Override the URL with SAILY_URL_TEMPLATE (placeholders {slug} {iso2} {iso2lower} {name}); it can also
 * point at a JSON endpoint the site's frontend calls — JSON bodies are parsed with the same heuristics.
 * Caveat: if a country page also lists regional plans, they are attributed to that single country.
 */
import type { Adapter, CountryRef, ScrapedPlan } from '../types'
import { parseAnyPayload, perCountryPageAdapter } from './common'

export function parseSailyPage(body: string, country: CountryRef, url?: string): ScrapedPlan[] {
  return parseAnyPayload(body, {
    countries: [country.iso2],
    scope: 'single',
    scopeKey: country.iso2,
    defaultCurrency: process.env.SAILY_CURRENCY || 'USD',
    url,
    namespaceIds: true,
  })
}

export const saily: Adapter = perCountryPageAdapter({
  key: 'saily',
  providerSlug: 'saily',
  source: 'saily.com/esim-{slug}/ destination pages, embedded Next.js JSON / JSON-LD (UNVERIFIED)',
  urlTemplate: 'https://saily.com/esim-{slug}/',
  defaultCurrency: 'USD',
  parse: parseSailyPage,
})
