/**
 * Ubigi adapter (Transatel / NTT).
 *
 * Source: one destination page per country on the Ubigi web shop,
 * https://cellulardata.ubigi.com/destinations/{slug}/ . Plans are read from embedded JSON
 * (Next.js data, JSON-LD Product offers) by field names.
 *
 * UNVERIFIED: the URL pattern and markup must be confirmed on the first live run. Override with
 * UBIGI_URL_TEMPLATE (placeholders {slug} {iso2} {iso2lower} {name}); a JSON endpoint also works.
 * Ubigi shows prices in the visitor's currency (often EUR in Europe) — the currency is taken from the
 * payload when present, else UBIGI_CURRENCY (default USD). Pin the proxy region to keep it stable.
 */
import type { Adapter, CountryRef, ScrapedPlan } from '../types'
import { parseAnyPayload, perCountryPageAdapter } from './common'

export function parseUbigiPage(body: string, country: CountryRef, url?: string): ScrapedPlan[] {
  return parseAnyPayload(body, {
    countries: [country.iso2],
    scope: 'single',
    scopeKey: country.iso2,
    defaultCurrency: process.env.UBIGI_CURRENCY || 'USD',
    url,
    namespaceIds: true,
  })
}

export const ubigi: Adapter = perCountryPageAdapter({
  key: 'ubigi',
  providerSlug: 'ubigi',
  source: 'cellulardata.ubigi.com/destinations/{slug}/ pages, embedded JSON / JSON-LD (UNVERIFIED)',
  urlTemplate: 'https://cellulardata.ubigi.com/destinations/{slug}/',
  defaultCurrency: 'USD',
  parse: parseUbigiPage,
})
