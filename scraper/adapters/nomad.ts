/**
 * Nomad adapter (getnomad.app).
 *
 * Source: one destination page per country, https://www.getnomad.app/{slug}-esim (e.g. /japan-esim).
 * Plans are read from the page's embedded Next.js JSON (__NEXT_DATA__ or App Router flight data) by
 * field names, with JSON-LD offers as a fallback.
 *
 * UNVERIFIED: the URL pattern is a best guess and must be confirmed on the first live run. Set
 * NOMAD_URL_TEMPLATE to fix it, or point it at the JSON API the Nomad web app calls for a destination
 * (find it in the browser's network tab) — JSON bodies are parsed with the same heuristics.
 */
import type { Adapter, CountryRef, ScrapedPlan } from '../types'
import { parseAnyPayload, perCountryPageAdapter } from './common'

export function parseNomadPage(body: string, country: CountryRef, url?: string): ScrapedPlan[] {
  return parseAnyPayload(body, {
    countries: [country.iso2],
    scope: 'single',
    scopeKey: country.iso2,
    defaultCurrency: process.env.NOMAD_CURRENCY || 'USD',
    url,
    namespaceIds: true,
  })
}

export const nomad: Adapter = perCountryPageAdapter({
  key: 'nomad',
  providerSlug: 'nomad',
  source: 'getnomad.app/{slug}-esim destination pages, embedded Next.js JSON / JSON-LD (UNVERIFIED)',
  urlTemplate: 'https://www.getnomad.app/{slug}-esim',
  defaultCurrency: 'USD',
  parse: parseNomadPage,
})
