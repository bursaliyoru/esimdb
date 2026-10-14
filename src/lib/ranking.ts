/**
 * Top-10 scoring. Pure functions so the order can be unit tested and explained on the page.
 *
 * Automatic score (0–10) per provider:
 *   35% price      best $/GB among its plans, relative to the cheapest provider
 *   25% trust      Trustpilot TrustScore (0–5)
 *   15% coverage   number of countries it sells plans for, relative to the widest
 *   15% features   top-up, hotspot, phone number, app, 5G share
 *   10% choice     number of plans on offer, relative to the largest catalogue
 *
 * Modes: 'auto' uses the score only. 'hybrid' removes excluded providers and moves pinned ones to
 * their pinned position, everything else keeps the automatic order. 'manual' uses the editor order.
 */

export type ScoreInput = {
  id: number | string
  bestPerGbUsd: number | null
  trustScore: number | null
  countryCount: number
  planCount: number
  features: { topUp?: boolean | null; hotspot?: boolean | null; phoneNumber?: boolean | null; hasApp?: boolean | null; fiveGShare?: number }
}

export type ScoreBreakdown = { price: number; trust: number; coverage: number; features: number; choice: number; total: number }

export const WEIGHTS = { price: 0.35, trust: 0.25, coverage: 0.15, features: 0.15, choice: 0.1 }

export function scoreProviders(items: ScoreInput[]): Map<ScoreInput['id'], ScoreBreakdown> {
  const prices = items.map((i) => i.bestPerGbUsd).filter((v): v is number => v != null && v > 0)
  const cheapest = prices.length ? Math.min(...prices) : null
  const maxCountries = Math.max(1, ...items.map((i) => i.countryCount))
  const maxPlans = Math.max(1, ...items.map((i) => i.planCount))
  const out = new Map<ScoreInput['id'], ScoreBreakdown>()
  for (const i of items) {
    const price = cheapest && i.bestPerGbUsd ? cheapest / i.bestPerGbUsd : 0.3
    const trust = i.trustScore != null ? Math.max(0, Math.min(1, i.trustScore / 5)) : 0.6
    const coverage = i.countryCount / maxCountries
    const f = i.features
    const features = ([f.topUp, f.hotspot, f.phoneNumber, f.hasApp].filter(Boolean).length + (f.fiveGShare ?? 0)) / 5
    const choice = i.planCount / maxPlans
    const total =
      10 * (WEIGHTS.price * price + WEIGHTS.trust * trust + WEIGHTS.coverage * coverage + WEIGHTS.features * features + WEIGHTS.choice * choice)
    out.set(i.id, { price, trust, coverage, features, choice, total: Math.round(total * 10) / 10 })
  }
  return out
}

export type RankEntryInput = { providerId: number | string; pinnedPosition?: number | null; excluded?: boolean | null }

export function orderRanking(
  mode: 'auto' | 'hybrid' | 'manual',
  autoOrder: (number | string)[],
  entries: RankEntryInput[],
  size = 10,
): (number | string)[] {
  const excluded = new Set(entries.filter((e) => e.excluded).map((e) => e.providerId))
  if (mode === 'manual') {
    return entries.filter((e) => !e.excluded).map((e) => e.providerId).slice(0, size)
  }
  const base = autoOrder.filter((id) => !(mode === 'hybrid' && excluded.has(id)))
  if (mode === 'auto') return base.slice(0, size)
  const pins = entries
    .filter((e) => !e.excluded && e.pinnedPosition && e.pinnedPosition > 0)
    .sort((a, b) => (a.pinnedPosition as number) - (b.pinnedPosition as number))
  const pinnedIds = new Set(pins.map((p) => p.providerId))
  const rest = base.filter((id) => !pinnedIds.has(id))
  const result: (number | string)[] = []
  for (const pin of pins) {
    const pos = Math.min((pin.pinnedPosition as number) - 1, result.length + rest.length)
    while (result.length < pos && rest.length) result.push(rest.shift() as number | string)
    result.push(pin.providerId)
  }
  result.push(...rest)
  return result.slice(0, size)
}
