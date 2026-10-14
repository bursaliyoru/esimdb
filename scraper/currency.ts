/**
 * Currency conversion to USD.
 * Rates come from a free, key-less API once per run (open.er-api.com, then frankfurter.app as a backup),
 * falling back to the static table below if both are unreachable.
 */
import type { HttpClient } from './http'
import type { Logger } from './log'

/** Units of currency per 1 USD. Approximate; only used when the live APIs are unreachable. Update occasionally. */
export const FALLBACK_RATES: Readonly<Record<string, number>> = {
  USD: 1,
  EUR: 0.86,
  GBP: 0.75,
  CHF: 0.8,
  CAD: 1.38,
  AUD: 1.52,
  NZD: 1.72,
  JPY: 150,
  CNY: 7.12,
  HKD: 7.78,
  SGD: 1.29,
  KRW: 1400,
  INR: 88,
  SEK: 9.4,
  NOK: 10.1,
  DKK: 6.4,
  PLN: 3.65,
  CZK: 20.9,
  HUF: 335,
  TRY: 41.5,
  BRL: 5.4,
  MXN: 18.4,
  ZAR: 17.4,
  AED: 3.6725,
  ILS: 3.35,
  THB: 32.5,
  MYR: 4.22,
  IDR: 16500,
  PHP: 58,
  TWD: 30.5,
}

export interface RateTable {
  base: 'USD'
  rates: Record<string, number>
  source: 'open.er-api.com' | 'frankfurter.app' | 'fallback'
  fetchedAt: string
}

export function fallbackRates(): RateTable {
  return { base: 'USD', rates: { ...FALLBACK_RATES }, source: 'fallback', fetchedAt: new Date().toISOString() }
}

function sanitizeRates(raw: unknown): Record<string, number> | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (/^[A-Z]{3}$/.test(k) && typeof v === 'number' && Number.isFinite(v) && v > 0) out[k] = v
  }
  out.USD = 1
  return Object.keys(out).length > 5 ? out : undefined
}

/** Fetches live rates (USD base). Never throws: returns the fallback table on any error. */
export async function loadRates(http: HttpClient, log?: Logger): Promise<RateTable> {
  try {
    const j = await http.getJson<{ result?: string; rates?: unknown }>('https://open.er-api.com/v6/latest/USD', { retries: 1, timeoutMs: 10_000 })
    const rates = j.result === 'success' ? sanitizeRates(j.rates) : undefined
    if (rates) return { base: 'USD', rates: { ...FALLBACK_RATES, ...rates }, source: 'open.er-api.com', fetchedAt: new Date().toISOString() }
  } catch (err) {
    log?.warn(`open.er-api.com failed: ${(err as Error).message}`)
  }
  try {
    const j = await http.getJson<{ rates?: unknown }>('https://api.frankfurter.app/latest?from=USD', { retries: 1, timeoutMs: 10_000 })
    const rates = sanitizeRates(j.rates)
    if (rates) return { base: 'USD', rates: { ...FALLBACK_RATES, ...rates }, source: 'frankfurter.app', fetchedAt: new Date().toISOString() }
  } catch (err) {
    log?.warn(`frankfurter.app failed: ${(err as Error).message}`)
  }
  log?.warn('using static fallback exchange rates')
  return fallbackRates()
}

export const round2 = (n: number) => Math.round(n * 100) / 100

/** Converts an amount to USD. Returns undefined for unknown currencies (never guesses). */
export function toUsd(amount: number, currency: string, table: RateTable = fallbackRates()): number | undefined {
  const cur = currency.trim().toUpperCase()
  const rate = table.rates[cur] ?? FALLBACK_RATES[cur]
  if (!rate || !Number.isFinite(amount)) return undefined
  return round2(amount / rate)
}
