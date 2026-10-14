/**
 * Pure parsing helpers shared by adapters (no network, fully unit-tested).
 */
import * as cheerio from 'cheerio'

export const MB_PER_GB = 1024

export interface DataSize {
  /** Total MB, null = unlimited (or per-day plan where the total is unknown until validity is known). */
  dataMb: number | null
  dailyMb?: number
}

function toNumber(s: string): number {
  return Number(s.replace(/\s/g, '').replace(',', '.'))
}

/**
 * Parses human data sizes: "1GB", "500 MB", "1,5 GB", "Unlimited", "3 GB/day", "2GB per day", "1 TB".
 * A bare number is interpreted as MB. Returns undefined when nothing recognisable is found.
 */
export function parseDataSize(input: unknown): DataSize | undefined {
  if (input === null || input === undefined) return undefined
  if (typeof input === 'number') return Number.isFinite(input) && input >= 0 ? { dataMb: input } : undefined
  if (typeof input !== 'string') return undefined
  const s = input.trim().toLowerCase()
  if (!s) return undefined
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*(tb|gb|gig(?:abytes?)?|mb|megabytes?|kb)\b/)
  const daily = /(\/\s*(day|d)\b|per\s+day|a\s+day|daily|\/24h|per\s+24)/.test(s)
  if (m) {
    const n = toNumber(m[1]!)
    const unit = m[2]!
    const mb = unit === 'tb' ? n * MB_PER_GB * MB_PER_GB : unit.startsWith('g') ? n * MB_PER_GB : unit === 'kb' ? n / 1024 : n
    const rounded = Math.round(mb * 100) / 100
    return daily ? { dataMb: null, dailyMb: rounded } : { dataMb: rounded }
  }
  if (/unlimited|illimit|∞|no\s+limit/.test(s)) return { dataMb: null }
  if (/^\d+(?:[.,]\d+)?$/.test(s)) return { dataMb: toNumber(s) }
  return undefined
}

/** Parses validity: 7, "7 days", "1 week", "1 month" (=30), "1 year" (=365), "24 hours" (=1). */
export function parseValidityDays(input: unknown): number | undefined {
  if (typeof input === 'number') return Number.isFinite(input) && input > 0 ? Math.round(input) : undefined
  if (typeof input !== 'string') return undefined
  const s = input.trim().toLowerCase()
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*(days?|d\b|weeks?|wk|months?|mo\b|years?|yr|hours?|hrs?|h\b)?/)
  if (!m) return undefined
  const n = toNumber(m[1]!)
  const unit = m[2] ?? 'day'
  let days: number
  if (unit.startsWith('w')) days = n * 7
  else if (unit.startsWith('mo')) days = n * 30
  else if (unit.startsWith('y')) days = n * 365
  else if (unit.startsWith('h')) days = Math.max(1, Math.ceil(n / 24))
  else days = n
  return days > 0 ? Math.round(days) : undefined
}

const SYMBOL_CURRENCY: Record<string, string> = { $: 'USD', 'US$': 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY', A$: 'AUD', C$: 'CAD', CHF: 'CHF' }

/** Parses "$4.50", "4,50 €", "USD 12", 12.5, "1,299.00" → { amount, currency? }. */
export function parsePrice(input: unknown): { amount: number; currency?: string } | undefined {
  if (typeof input === 'number') return Number.isFinite(input) && input > 0 ? { amount: input } : undefined
  if (typeof input !== 'string') return undefined
  const s = input.trim()
  let currency: string | undefined
  const code = s.match(/\b([A-Z]{3})\b/)
  if (code) currency = code[1]
  else {
    for (const [sym, cur] of Object.entries(SYMBOL_CURRENCY)) {
      if (s.includes(sym)) {
        currency = cur
        break
      }
    }
  }
  const num = s.match(/\d[\d.,\s]*/)
  if (!num) return undefined
  let n = num[0].replace(/\s/g, '')
  // "1,299.00" → 1299.00 ; "4,50" → 4.50 ; "1.299,00" → 1299.00
  if (/,\d{1,2}$/.test(n)) n = n.replace(/\./g, '').replace(',', '.')
  else n = n.replace(/,/g, '')
  const amount = Number(n)
  if (!Number.isFinite(amount) || amount <= 0) return undefined
  return { amount, currency }
}

export function slugify(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const displayNames = new Intl.DisplayNames(['en'], { type: 'region' })

/** English country name for an ISO2 code ("US" → "United States"). */
export function countryName(iso2: string): string {
  try {
    return displayNames.of(iso2.toUpperCase()) ?? iso2.toUpperCase()
  } catch {
    return iso2.toUpperCase()
  }
}

let nameIndex: Map<string, string> | null = null
const NAME_ALIASES: Record<string, string> = {
  usa: 'US',
  'united-states-of-america': 'US',
  uk: 'GB',
  'great-britain': 'GB',
  england: 'GB',
  'south-korea': 'KR',
  korea: 'KR',
  'north-korea': 'KP',
  russia: 'RU',
  'czech-republic': 'CZ',
  turkey: 'TR',
  turkiye: 'TR',
  vietnam: 'VN',
  'ivory-coast': 'CI',
  'cote-d-ivoire': 'CI',
  'hong-kong': 'HK',
  macau: 'MO',
  macao: 'MO',
  'dr-congo': 'CD',
  'democratic-republic-of-the-congo': 'CD',
  'republic-of-the-congo': 'CG',
  'the-netherlands': 'NL',
  holland: 'NL',
  'bosnia-and-herzegovina': 'BA',
  bosnia: 'BA',
  'vatican-city': 'VA',
  'cape-verde': 'CV',
  eswatini: 'SZ',
  swaziland: 'SZ',
  'st-lucia': 'LC',
  'st-kitts-and-nevis': 'KN',
  'st-vincent-and-the-grenadines': 'VC',
  'st-barthelemy': 'BL',
  'st-martin': 'MF',
  'us-virgin-islands': 'VI',
  'british-virgin-islands': 'VG',
  palestine: 'PS',
  'east-timor': 'TL',
  laos: 'LA',
  syria: 'SY',
  iran: 'IR',
  moldova: 'MD',
  tanzania: 'TZ',
  bolivia: 'BO',
  venezuela: 'VE',
  brunei: 'BN',
  micronesia: 'FM',
  'north-macedonia': 'MK',
  macedonia: 'MK',
  kosovo: 'XK',
  'canary-islands': 'IC',
}

/** Reverse lookup from an English country name or slug to ISO2 ("United States", "united-states" → "US"). */
export function countryNameToIso2(name: string): string | undefined {
  if (!nameIndex) {
    nameIndex = new Map()
    for (let a = 65; a <= 90; a++) {
      for (let b = 65; b <= 90; b++) {
        const code = String.fromCharCode(a, b)
        let n: string | undefined
        try {
          n = displayNames.of(code)
        } catch {
          continue
        }
        if (n && n !== code) nameIndex.set(slugify(n), code)
      }
    }
    for (const [alias, code] of Object.entries(NAME_ALIASES)) nameIndex.set(alias, code)
  }
  const key = slugify(name)
  if (/^[a-z]{2}$/.test(key) && displayNames.of(key.toUpperCase()) !== key.toUpperCase()) return key.toUpperCase()
  return nameIndex.get(key) ?? nameIndex.get(key.replace(/^the-/, ''))
}

/** Normalises any ISO2-ish code ("us", " GB ") to upper case; returns undefined if not two letters. */
export function normIso2(code: unknown): string | undefined {
  if (typeof code !== 'string') return undefined
  const c = code.trim().toUpperCase()
  if (c === 'UK') return 'GB'
  return /^[A-Z]{2}$/.test(c) ? c : undefined
}

/** Known region slugs used across providers; keys are normalised name variants. */
const REGION_ALIASES: Record<string, string> = {
  europe: 'europe',
  'europe-plus': 'europe',
  eurolink: 'europe',
  asia: 'asia',
  'asia-pacific': 'asia',
  asialink: 'asia',
  'south-east-asia': 'asia',
  'southeast-asia': 'asia',
  'middle-east': 'middle-east',
  'middle-east-and-north-africa': 'middle-east',
  mena: 'middle-east',
  africa: 'africa',
  'north-america': 'north-america',
  'latin-america': 'latin-america',
  latamlink: 'latin-america',
  'south-america': 'latin-america',
  'central-america': 'latin-america',
  caribbean: 'caribbean',
  'caribbean-islands': 'caribbean',
  oceania: 'oceania',
  'australia-and-new-zealand': 'oceania',
  balkans: 'balkans',
  'world': 'global',
  global: 'global',
  discover: 'global',
  'discover-global': 'global',
  worldwide: 'global',
}

export function regionSlugFromName(name: string): string | undefined {
  const s = slugify(name).replace(/^esim-|-esim$/g, '')
  return REGION_ALIASES[s]
}

// ---------- embedded JSON extraction ----------

/** Returns the parsed `<script id="__NEXT_DATA__">` JSON of a Next.js page (pages router), if any. */
export function extractNextData(html: string): unknown {
  const $ = cheerio.load(html)
  const raw = $('script#__NEXT_DATA__').first().text()
  if (!raw) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

/** Returns all JSON-LD blocks (flattening arrays and @graph). */
export function extractJsonLd(html: string): Record<string, unknown>[] {
  const $ = cheerio.load(html)
  const out: Record<string, unknown>[] = []
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text()
    try {
      const parsed: unknown = JSON.parse(raw)
      const push = (v: unknown) => {
        if (Array.isArray(v)) v.forEach(push)
        else if (v && typeof v === 'object') {
          const o = v as Record<string, unknown>
          out.push(o)
          if (Array.isArray(o['@graph'])) (o['@graph'] as unknown[]).forEach(push)
        }
      }
      push(parsed)
    } catch {
      /* ignore broken blocks */
    }
  })
  return out
}

/**
 * Extracts JSON pushed by the Next.js App Router (`self.__next_f.push([1,"..."])`) and returns every
 * JSON object/array literal found inside those flight chunks that parses cleanly. Best effort.
 */
export function extractNextFlightJson(html: string): unknown[] {
  const chunks: string[] = []
  const re = /self\.__next_f\.push\(\[1,\s*("(?:[^"\\]|\\.)*")\]\)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    try {
      chunks.push(JSON.parse(m[1]!) as string)
    } catch {
      /* ignore */
    }
  }
  const joined = chunks.join('')
  const out: unknown[] = []
  // Each flight line looks like `12:{...}` or `12:[...]`.
  for (const line of joined.split('\n')) {
    const idx = line.search(/[[{]/)
    if (idx < 0) continue
    try {
      out.push(JSON.parse(line.slice(idx)))
    } catch {
      /* not plain JSON */
    }
  }
  return out
}

/** Depth-first walk over a JSON value, calling `visit` on every plain object. */
export function walkObjects(root: unknown, visit: (obj: Record<string, unknown>, path: string[]) => void, maxDepth = 40): void {
  const seen = new Set<unknown>()
  const rec = (v: unknown, path: string[], depth: number) => {
    if (depth > maxDepth || v === null || typeof v !== 'object' || seen.has(v)) return
    seen.add(v)
    if (Array.isArray(v)) {
      v.forEach((x, i) => rec(x, [...path, String(i)], depth + 1))
      return
    }
    const o = v as Record<string, unknown>
    visit(o, path)
    for (const [k, x] of Object.entries(o)) rec(x, [...path, k], depth + 1)
  }
  rec(root, [], 0)
}

// ---------- generic "plan-like object" detection ----------

export interface PlanCandidate {
  id?: string
  name?: string
  price: number
  currency?: string
  originalPrice?: number
  dataMb: number | null
  dailyMb?: number
  validityDays: number
  fiveG?: boolean
  hotspot?: boolean
  phoneNumber?: boolean
  newUsersOnly?: boolean
  network?: string
  countries?: string[]
}

const PRICE_KEYS = ['priceUsd', 'price_usd', 'retailPrice', 'retail_price', 'salePrice', 'sale_price', 'finalPrice', 'final_price', 'discountedPrice', 'price', 'priceAmount', 'amountUsd', 'cost']
const ORIGINAL_PRICE_KEYS = ['originalPrice', 'original_price', 'compareAtPrice', 'compare_at_price', 'listPrice', 'regularPrice', 'fullPrice', 'oldPrice']
const DATA_KEYS = ['dataMb', 'data_mb', 'dataAmount', 'data_amount', 'dataLimit', 'data_limit', 'dataVolume', 'volume', 'dataAllowance', 'allowance', 'data', 'dataGb', 'data_gb', 'gb', 'dataSize', 'size', 'quota']
const VALIDITY_KEYS = ['validityDays', 'validity_days', 'validity', 'durationDays', 'duration_days', 'duration', 'days', 'day', 'period', 'periodDays', 'validityPeriod']
const UNLIMITED_KEYS = ['isUnlimited', 'is_unlimited', 'unlimited', 'unlimitedData']
const ID_KEYS = ['id', 'planId', 'plan_id', 'packageId', 'package_id', 'sku', 'slug', 'code', 'uuid']
const NAME_KEYS = ['name', 'title', 'displayName', 'label']
const CURRENCY_KEYS = ['currency', 'currencyCode', 'currency_code', 'priceCurrency']

function firstKey(o: Record<string, unknown>, keys: string[]): [string, unknown] | undefined {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== '') return [k, o[k]]
  return undefined
}

/** Returns the first successfully parsed value among `keys` (later keys are tried when earlier ones don't parse). */
function firstParsed<T>(o: Record<string, unknown>, keys: string[], parse: (key: string, v: unknown) => T | undefined): T | undefined {
  for (const k of keys) {
    const v = o[k]
    if (v === undefined || v === null || v === '') continue
    const r = parse(k, v)
    if (r !== undefined) return r
  }
  return undefined
}

function readPrice(v: unknown): { amount: number; currency?: string } | undefined {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>
    const amt = firstKey(o, ['amount', 'value', 'usd', 'USD', 'price', 'formatted'])
    const cur = firstKey(o, ['currency', 'currencyCode', 'code'])
    const p = amt ? parsePrice(amt[1]) : undefined
    if (!p) return undefined
    return { amount: p.amount, currency: typeof cur?.[1] === 'string' ? (cur[1] as string).toUpperCase() : p.currency }
  }
  return parsePrice(v)
}

function readData(o: Record<string, unknown>, keyHint: string, v: unknown): DataSize | undefined {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const d = v as Record<string, unknown>
    const amount = firstKey(d, ['amount', 'value', 'mb', 'gb'])
    const unit = firstKey(d, ['unit', 'units'])
    if (amount && unit && typeof unit[1] === 'string') return parseDataSize(`${String(amount[1])} ${unit[1]}`)
    if (amount && amount[0] === 'gb') return parseDataSize(`${String(amount[1])} GB`)
    if (amount && typeof amount[1] === 'number') return { dataMb: amount[1] }
    return undefined
  }
  if (typeof v === 'number') {
    if (/gb/i.test(keyHint)) return { dataMb: v * MB_PER_GB }
    if (keyHint === 'data' || keyHint === 'size' || keyHint === 'quota' || keyHint === 'volume' || keyHint === 'allowance') {
      // Ambiguous bare number: small values are almost certainly GB, large ones MB.
      return { dataMb: v <= 100 ? v * MB_PER_GB : v }
    }
    return { dataMb: v }
  }
  const unit = typeof o.unit === 'string' ? o.unit : typeof o.dataUnit === 'string' ? o.dataUnit : ''
  if (typeof v === 'string' && /^\s*\d+(?:[.,]\d+)?\s*$/.test(v) && unit) return parseDataSize(`${v} ${unit}`)
  return parseDataSize(v)
}

/** Tries to read a plan from an arbitrary object by common field names. */
export function readPlanCandidate(o: Record<string, unknown>): PlanCandidate | undefined {
  const price = firstParsed(o, PRICE_KEYS, (_k, v) => readPrice(v))
  if (!price) return undefined
  const validityDays = firstParsed(o, VALIDITY_KEYS, (_k, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const d = v as Record<string, unknown>
      return parseValidityDays(d.days ?? d.value ?? d.amount)
    }
    return parseValidityDays(v)
  })
  if (!validityDays) return undefined

  const unlimited = firstKey(o, UNLIMITED_KEYS)
  const data: DataSize | undefined =
    unlimited && unlimited[1] === true ? { dataMb: null } : firstParsed(o, DATA_KEYS, (k, v) => readData(o, k, v))
  if (!data) return undefined

  const id = firstKey(o, ID_KEYS)
  const name = firstKey(o, NAME_KEYS)
  const cur = firstKey(o, CURRENCY_KEYS)
  const orig = firstKey(o, ORIGINAL_PRICE_KEYS)
  const origPrice = orig ? readPrice(orig[1]) : undefined
  const bool = (keys: string[]) => {
    const e = firstKey(o, keys)
    return typeof e?.[1] === 'boolean' ? (e[1] as boolean) : undefined
  }
  return {
    id: id && (typeof id[1] === 'string' || typeof id[1] === 'number') ? String(id[1]) : undefined,
    name: typeof name?.[1] === 'string' ? (name[1] as string) : undefined,
    price: price.amount,
    currency: typeof cur?.[1] === 'string' ? (cur[1] as string).toUpperCase() : price.currency,
    originalPrice: origPrice && origPrice.amount > price.amount ? origPrice.amount : undefined,
    dataMb: data.dataMb,
    dailyMb: data.dailyMb,
    validityDays,
    fiveG: bool(['fiveG', 'is5g', 'is5G', 'has5g', 'has5G', 'supports5g']),
    hotspot: bool(['hotspot', 'tethering', 'hasHotspot', 'allowsHotspot']),
    phoneNumber: bool(['phoneNumber', 'hasPhoneNumber', 'withPhoneNumber', 'voice']),
    newUsersOnly: bool(['newUsersOnly', 'firstPurchaseOnly', 'isTrial']),
  }
}

/** Finds every plan-like object anywhere in a JSON tree. */
export function findPlanCandidates(root: unknown): PlanCandidate[] {
  const out: PlanCandidate[] = []
  walkObjects(root, (o) => {
    const c = readPlanCandidate(o)
    if (c) out.push(c)
  })
  return out
}

/** For daily plans set the total to daily × days so totals stay comparable. */
export function totalDataMb(c: { dataMb: number | null; dailyMb?: number; validityDays: number }): number | null {
  if (c.dailyMb) return Math.round(c.dailyMb * c.validityDays)
  return c.dataMb
}

/** Stable fallback id when the source has none: "<iso2|region>-<dataMb|unl>[d]-<days>d". */
export function syntheticId(scopeKey: string, c: { dataMb: number | null; dailyMb?: number; validityDays: number }): string {
  const data = c.dailyMb ? `${c.dailyMb}mbd` : c.dataMb === null ? 'unl' : `${c.dataMb}mb`
  return `${scopeKey.toLowerCase()}-${data}-${c.validityDays}d`
}

/** Plans from JSON-LD Product/Offer blocks; offer names are parsed for data + validity ("1 GB · 7 days"). */
export function plansFromJsonLd(blocks: Record<string, unknown>[]): PlanCandidate[] {
  const out: PlanCandidate[] = []
  for (const b of blocks) {
    const type = String(b['@type'] ?? '')
    if (!/Product|Offer|AggregateOffer/.test(type)) continue
    const offersRaw = b.offers ?? (/Offer/.test(type) ? b : undefined)
    const offers: unknown[] = Array.isArray(offersRaw)
      ? offersRaw
      : offersRaw && typeof offersRaw === 'object' && Array.isArray((offersRaw as Record<string, unknown>).offers)
        ? ((offersRaw as Record<string, unknown>).offers as unknown[])
        : offersRaw
          ? [offersRaw]
          : []
    for (const offer of offers) {
      if (!offer || typeof offer !== 'object') continue
      const of = offer as Record<string, unknown>
      const label = [of.name, of.description, of.sku, b.name].filter((x) => typeof x === 'string').join(' ')
      const price = parsePrice(of.price ?? of.lowPrice)
      const data = parseDataSize(label)
      const validity = label.match(/(\d+)\s*(days?|weeks?|months?)/i)
      const validityDays = validity ? parseValidityDays(validity[0]) : undefined
      if (!price || !data || !validityDays) continue
      out.push({
        id: typeof of.sku === 'string' ? of.sku : undefined,
        name: typeof of.name === 'string' ? of.name : undefined,
        price: price.amount,
        currency: typeof of.priceCurrency === 'string' ? of.priceCurrency.toUpperCase() : price.currency,
        dataMb: data.dataMb,
        dailyMb: data.dailyMb,
        validityDays,
      })
    }
  }
  return out
}

/** Formats a short plan name like "1 GB · 7 days" / "Unlimited · 5 days" / "2 GB/day · 10 days". */
export function planLabel(c: { dataMb: number | null; dailyMb?: number; validityDays: number }): string {
  const fmt = (mb: number) => (mb >= MB_PER_GB ? `${Math.round((mb / MB_PER_GB) * 100) / 100} GB` : `${mb} MB`)
  const data = c.dailyMb ? `${fmt(c.dailyMb)}/day` : c.dataMb === null ? 'Unlimited' : fmt(c.dataMb)
  return `${data} · ${c.validityDays} day${c.validityDays === 1 ? '' : 's'}`
}
