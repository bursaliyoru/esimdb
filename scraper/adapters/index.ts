import type { Adapter } from '../types'
import { airalo } from './airalo'
import { holafly } from './holafly'
import { nomad } from './nomad'
import { saily } from './saily'
import { ubigi } from './ubigi'
import { maya } from './maya'
import { yesim } from './yesim'
import { jetpac } from './jetpac'
import { gigsky } from './gigsky'
import { bnesim } from './bnesim'

/** All adapters, keyed by adapter key (matches providers.scraper, or the provider slug when that is empty). */
export const adapters: Record<string, Adapter> = Object.fromEntries(
  [airalo, holafly, nomad, saily, ubigi, maya, yesim, jetpac, gigsky, bnesim].map((a) => [a.key, a]),
)

export function getAdapter(key: string | null | undefined): Adapter | undefined {
  return key ? adapters[key] : undefined
}

/**
 * Built-in provider defaults, used only when the providers collection is empty or lacks a provider
 * (e.g. a --dry-run before seeding). The DB always wins.
 */
export const DEFAULT_PROVIDERS: { slug: string; name: string; website: string; trustpilotDomain: string }[] = [
  { slug: 'airalo', name: 'Airalo', website: 'https://www.airalo.com', trustpilotDomain: 'airalo.com' },
  { slug: 'holafly', name: 'Holafly', website: 'https://esim.holafly.com', trustpilotDomain: 'holafly.com' },
  { slug: 'nomad', name: 'Nomad', website: 'https://www.getnomad.app', trustpilotDomain: 'getnomad.app' },
  { slug: 'saily', name: 'Saily', website: 'https://saily.com', trustpilotDomain: 'saily.com' },
  { slug: 'ubigi', name: 'Ubigi', website: 'https://cellulardata.ubigi.com', trustpilotDomain: 'ubigi.com' },
  { slug: 'maya', name: 'Maya Mobile', website: 'https://maya.net', trustpilotDomain: 'maya.net' },
  { slug: 'yesim', name: 'Yesim', website: 'https://yesim.app', trustpilotDomain: 'yesim.app' },
  { slug: 'jetpac', name: 'Jetpac', website: 'https://www.jetpacglobal.com', trustpilotDomain: 'jetpacglobal.com' },
  { slug: 'gigsky', name: 'GigSky', website: 'https://www.gigsky.com', trustpilotDomain: 'gigsky.com' },
  { slug: 'bnesim', name: 'BNESIM', website: 'https://bnesim.com', trustpilotDomain: 'bnesim.com' },
]
