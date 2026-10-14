export type Currency = 'USD' | 'EUR' | 'GBP'

// Display-only rates. Plans are stored in USD; the scraper converts at fetch time.
export const RATES: Record<Currency, number> = { USD: 1, EUR: 0.86, GBP: 0.75 }
const SYMBOL: Record<Currency, string> = { USD: '$', EUR: '€', GBP: '£' }

export function money(usd: number | null | undefined, cur: Currency = 'USD'): string {
  if (usd == null || !Number.isFinite(usd)) return '—'
  const v = usd * RATES[cur]
  return `${SYMBOL[cur]}${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function dataLabel(dataMb: number | null | undefined, dailyMb?: number | null): string {
  if (dailyMb) return `${mbToText(dailyMb)}/day`
  if (dataMb == null) return 'Unlimited'
  return mbToText(dataMb)
}

export function mbToText(mb: number): string {
  if (mb < 1024) return `${Math.round(mb)} MB`
  const gb = mb / 1024
  return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`
}

/** Price per GB in USD. Unlimited or daily plans have no per-GB price. */
export function perGbUsd(p: { priceUsd: number; dataMb?: number | null; dailyMb?: number | null }): number | null {
  if (p.dailyMb || p.dataMb == null || p.dataMb <= 0) return null
  return p.priceUsd / (p.dataMb / 1024)
}

export function signalLevel(dataMb: number | null | undefined): number {
  if (dataMb == null) return 4
  const gb = dataMb / 1024
  return gb >= 20 ? 4 : gb >= 10 ? 3 : gb >= 3 ? 2 : 1
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
