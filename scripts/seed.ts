/**
 * Seeds countries, regions, providers, sample plans, example coupons and rankings.
 * Plans are marked source='seed' and the site shows a "sample prices" banner until the scraper
 * replaces them. Run: npm run seed   (add --reset to wipe catalog collections first)
 */
import fs from 'node:fs'
import crypto from 'node:crypto'
import { getPayload } from 'payload'
import config from '../src/payload.config'

if (fs.existsSync('.env')) process.loadEnvFile?.('.env')

const U = null // unlimited
type Tpl = [number | null, number, number] // [GB, days, usd at factor 1]

const REGIONS = [
  { slug: 'europe', name: 'Europe', countryCount: 39 },
  { slug: 'asia', name: 'Asia', countryCount: 14 },
  { slug: 'north-america', name: 'North America', countryCount: 3 },
  { slug: 'global', name: 'Global', countryCount: 120 },
]

const COUNTRIES: { iso2: string; name: string; flag: string; f: number; nets: string[]; reg: string[]; popular?: boolean }[] = [
  { iso2: 'TR', name: 'Turkey', flag: '🇹🇷', f: 1.0, nets: ['Turkcell', 'Türk Telekom', 'Vodafone TR'], reg: ['europe', 'global'], popular: true },
  { iso2: 'US', name: 'United States', flag: '🇺🇸', f: 0.95, nets: ['AT&T', 'T-Mobile', 'Verizon'], reg: ['north-america', 'global'], popular: true },
  { iso2: 'JP', name: 'Japan', flag: '🇯🇵', f: 1.1, nets: ['SoftBank', 'KDDI (au)', 'NTT Docomo'], reg: ['asia', 'global'], popular: true },
  { iso2: 'DE', name: 'Germany', flag: '🇩🇪', f: 0.85, nets: ['Telekom', 'Vodafone', 'O2'], reg: ['europe', 'global'], popular: true },
  { iso2: 'FR', name: 'France', flag: '🇫🇷', f: 0.85, nets: ['Orange', 'SFR', 'Bouygues'], reg: ['europe', 'global'], popular: true },
  { iso2: 'IT', name: 'Italy', flag: '🇮🇹', f: 0.85, nets: ['TIM', 'Vodafone', 'WindTre'], reg: ['europe', 'global'], popular: true },
  { iso2: 'ES', name: 'Spain', flag: '🇪🇸', f: 0.85, nets: ['Movistar', 'Vodafone', 'Orange'], reg: ['europe', 'global'], popular: true },
  { iso2: 'GB', name: 'United Kingdom', flag: '🇬🇧', f: 0.88, nets: ['EE', 'Vodafone', 'O2', 'Three'], reg: ['europe', 'global'], popular: true },
  { iso2: 'GR', name: 'Greece', flag: '🇬🇷', f: 0.92, nets: ['Cosmote', 'Vodafone', 'Nova'], reg: ['europe', 'global'] },
  { iso2: 'TH', name: 'Thailand', flag: '🇹🇭', f: 0.8, nets: ['AIS', 'True', 'dtac'], reg: ['asia', 'global'], popular: true },
  { iso2: 'KR', name: 'South Korea', flag: '🇰🇷', f: 1.05, nets: ['SK Telecom', 'KT', 'LG U+'], reg: ['asia', 'global'] },
  { iso2: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', f: 1.6, nets: ['e&', 'du'], reg: ['global'], popular: true },
  { iso2: 'MX', name: 'Mexico', flag: '🇲🇽', f: 1.05, nets: ['Telcel', 'AT&T Mexico', 'Movistar'], reg: ['north-america', 'global'] },
  { iso2: 'CN', name: 'China', flag: '🇨🇳', f: 1.15, nets: ['China Mobile', 'China Unicom', 'China Telecom'], reg: ['asia', 'global'] },
]

const PROVIDERS: {
  slug: string; name: string; color: string; website: string; tp: string; hq: string; founded: number; tagline: string
  topUp: boolean; phone: boolean; hotspot: boolean; fiveG: number; kyc: string; scraper: string
  tpl: Tpl[]; reg: Record<string, Tpl[]>
}[] = [
  { slug: 'airalo', name: 'Airalo', color: '#E5484D', website: 'https://www.airalo.com', tp: 'airalo.com', hq: 'Singapore', founded: 2019, tagline: 'The largest eSIM store, with plans for 200+ destinations', topUp: true, phone: false, hotspot: true, fiveG: 0.5, kyc: 'Required in some countries', scraper: 'airalo',
    tpl: [[1, 7, 4.5], [3, 30, 11], [5, 30, 16], [10, 30, 26], [20, 30, 39]], reg: { europe: [[1, 7, 5], [5, 30, 16], [10, 30, 27], [20, 30, 42]], global: [[1, 7, 9], [3, 30, 24], [10, 60, 63]] } },
  { slug: 'holafly', name: 'Holafly', color: '#F06B2E', website: 'https://esim.holafly.com', tp: 'holafly.com', hq: 'Spain', founded: 2018, tagline: 'Unlimited-data eSIMs priced by trip length', topUp: false, phone: false, hotspot: false, fiveG: 0.3, kyc: 'Not required', scraper: 'holafly',
    tpl: [[U, 5, 27], [U, 10, 44], [U, 15, 57], [U, 30, 79]], reg: { europe: [[U, 7, 39], [U, 15, 59], [U, 30, 89]] } },
  { slug: 'nomad', name: 'Nomad', color: '#2B6CB0', website: 'https://www.getnomad.app', tp: 'getnomad.app', hq: 'United States', founded: 2020, tagline: 'Flexible data plans with a strong app', topUp: true, phone: false, hotspot: true, fiveG: 0.6, kyc: 'Not required', scraper: 'nomad',
    tpl: [[1, 7, 4.5], [3, 15, 9], [5, 30, 13], [10, 30, 20], [20, 30, 30]], reg: { europe: [[3, 30, 11], [10, 30, 24]], asia: [[5, 30, 17], [10, 30, 28]] } },
  { slug: 'saily', name: 'Saily', color: '#1E2A3A', website: 'https://saily.com', tp: 'saily.com', hq: 'Panama', founded: 2023, tagline: 'Budget eSIMs from the makers of NordVPN', topUp: true, phone: false, hotspot: true, fiveG: 0.8, kyc: 'Not required', scraper: 'saily',
    tpl: [[1, 7, 3.99], [3, 30, 8.99], [5, 30, 12.99], [10, 30, 19.99], [20, 30, 28.99]], reg: { europe: [[3, 30, 9.99], [10, 30, 22.99]], global: [[3, 30, 25.99], [10, 30, 64.99]] } },
  { slug: 'ubigi', name: 'Ubigi', color: '#00A3E0', website: 'https://cellulardata.ubigi.com', tp: 'ubigi.com', hq: 'France', founded: 2013, tagline: 'Operator-grade eSIM with wide 5G coverage', topUp: true, phone: false, hotspot: true, fiveG: 0.9, kyc: 'Not required', scraper: 'ubigi',
    tpl: [[1, 7, 5], [3, 30, 10], [5, 30, 15], [10, 30, 24], [25, 30, 39]], reg: { europe: [[3, 30, 12], [10, 30, 26], [50, 30, 59]] } },
  { slug: 'maya', name: 'Maya Mobile', color: '#7A4FD6', website: 'https://maya.net', tp: 'maya.net', hq: 'United States', founded: 2022, tagline: 'Unlimited and fixed-data plans with 24/7 support', topUp: true, phone: false, hotspot: true, fiveG: 0.6, kyc: 'Not required', scraper: 'maya',
    tpl: [[1, 7, 4.9], [5, 15, 13.9], [10, 30, 22], [U, 7, 29], [U, 30, 69]], reg: { asia: [[U, 7, 32], [10, 30, 26]] } },
  { slug: 'yesim', name: 'Yesim', color: '#12A150', website: 'https://yesim.app', tp: 'yesim.app', hq: 'Switzerland', founded: 2017, tagline: 'Data eSIMs with an optional virtual number', topUp: true, phone: true, hotspot: true, fiveG: 0.4, kyc: 'Required for phone numbers', scraper: 'yesim',
    tpl: [[1, 7, 3.9], [3, 30, 9.5], [5, 30, 14], [10, 30, 22]], reg: { europe: [[5, 30, 15], [10, 30, 25]] } },
  { slug: 'jetpac', name: 'Jetpac', color: '#0F766E', website: 'https://www.jetpacglobal.com', tp: 'jetpacglobal.com', hq: 'Australia', founded: 2023, tagline: 'Travel eSIMs with free lounge access on delays', topUp: true, phone: false, hotspot: true, fiveG: 0.5, kyc: 'Not required', scraper: 'jetpac',
    tpl: [[1, 7, 4.5], [3, 30, 10], [10, 30, 22], [20, 30, 32]], reg: {} },
  { slug: 'gigsky', name: 'GigSky', color: '#C2410C', website: 'https://www.gigsky.com', tp: 'gigsky.com', hq: 'United States', founded: 2010, tagline: 'Long-running eSIM provider with cruise plans', topUp: true, phone: false, hotspot: true, fiveG: 0.4, kyc: 'Not required', scraper: 'gigsky',
    tpl: [[1, 7, 5.99], [3, 15, 12.99], [5, 30, 17.99], [10, 30, 26.99]], reg: { global: [[1, 7, 9.99], [3, 15, 24.99], [10, 30, 59.99]] } },
  { slug: 'bnesim', name: 'BNESIM', color: '#334155', website: 'https://bnesim.com', tp: 'bnesim.com', hq: 'Switzerland', founded: 2019, tagline: 'Low per-GB prices and frequent discounts', topUp: true, phone: true, hotspot: true, fiveG: 0.7, kyc: 'Required for phone numbers', scraper: 'bnesim',
    tpl: [[1, 7, 2.5], [5, 30, 7], [10, 30, 13], [20, 30, 22]], reg: { europe: [[5, 30, 9], [20, 30, 26]] } },
]

function hash(s: string) {
  let h = 2166136261
  for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) }
  return (h >>> 0) / 4294967295
}
const roundP = (x: number) => (x < 10 ? Math.round(x * 10) / 10 - 0.01 : Math.max(0.99, Math.round(x) - 0.01))
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

async function main() {
  const reset = process.argv.includes('--reset')
  const payload = await getPayload({ config })
  const now = new Date().toISOString()

  if (reset) {
    for (const c of ['price-snapshots', 'clicks', 'reviews', 'plans', 'coupons', 'rankings', 'providers', 'countries', 'regions'] as const) {
      await payload.delete({ collection: c, where: { id: { exists: true } } })
    }
    console.log('Wiped catalog collections')
  }

  const upsert = async <T extends 'regions' | 'countries' | 'providers' | 'rankings'>(collection: T, key: string, value: string, data: Record<string, unknown>) => {
    const found = await payload.find({ collection, where: { [key]: { equals: value } }, limit: 1, depth: 0 })
    if (found.docs[0]) return payload.update({ collection, id: found.docs[0].id, data: data as never, depth: 0 })
    return payload.create({ collection, data: data as never, depth: 0 })
  }

  const regionIds: Record<string, number | string> = {}
  for (const r of REGIONS) regionIds[r.slug] = (await upsert('regions', 'slug', r.slug, r)).id

  const countryIds: Record<string, number | string> = {}
  for (const c of COUNTRIES) {
    const doc = await upsert('countries', 'iso2', c.iso2, {
      name: c.name, slug: slug(c.name), iso2: c.iso2, flag: c.flag, popular: Boolean(c.popular),
      regions: c.reg.map((r) => regionIds[r]), networks: c.nets.map((name) => ({ name })),
    })
    countryIds[c.iso2] = doc.id
  }

  const providerIds: Record<string, number | string> = {}
  for (const p of PROVIDERS) {
    const doc = await upsert('providers', 'slug', p.slug, {
      name: p.name, slug: p.slug, active: true, website: p.website, brandColor: p.color, tagline: p.tagline,
      headquarters: p.hq, founded: p.founded, hasApp: true, topUp: p.topUp, hotspot: p.hotspot, phoneNumber: p.phone,
      kyc: p.kyc, trustpilotDomain: p.tp, scraper: p.scraper,
      description: `${p.name} is a travel eSIM provider based in ${p.hq}. ${p.tagline}.`,
    })
    providerIds[p.slug] = doc.id
  }

  // Sample plans: only create when the provider has no scraped plans yet.
  let created = 0
  for (const p of PROVIDERS) {
    const scraped = await payload.count({ collection: 'plans', where: { and: [{ provider: { equals: providerIds[p.slug] } }, { source: { equals: 'scraper' } }] } })
    if (scraped.totalDocs > 0) continue
    const rows: Record<string, unknown>[] = []
    for (const c of COUNTRIES) {
      if (p.slug === 'jetpac' && c.iso2 === 'CN') continue
      const j = 0.92 + hash(p.slug + c.iso2) * 0.16
      const net = c.nets[Math.floor(hash(c.iso2 + p.slug + 'n') * c.nets.length)]
      const fiveG = hash(p.slug + c.iso2 + '5') < p.fiveG
      p.tpl.forEach(([gb, d, usd], i) => {
        const price = roundP(usd * c.f * j)
        const promo = hash(p.slug + c.iso2 + i + 'd') < 0.12
        rows.push({
          key: `${p.slug}:seed-${c.iso2}-${i}`, provider: providerIds[p.slug], externalId: `seed-${c.iso2}-${i}`,
          name: `${c.name} ${gb == null ? 'Unlimited' : gb + 'GB'} ${d} days`, scope: 'single', countries: [countryIds[c.iso2]],
          dataMb: gb == null ? null : gb * 1024, validityDays: d, priceUsd: promo ? roundP(price * 0.8) : price,
          originalPriceUsd: promo ? price : null, price: promo ? roundP(price * 0.8) : price, currency: 'USD', network: net, fiveG,
          hotspot: p.hotspot, phoneNumber: p.phone && i >= 2, newUsersOnly: p.slug === 'nomad' && i === 0 && hash(c.iso2) < 0.5,
          url: p.website, active: true, lastSeenAt: now, source: 'seed',
        })
      })
    }
    for (const [rslug, tpls] of Object.entries(p.reg)) {
      const members = COUNTRIES.filter((c) => c.reg.includes(rslug)).map((c) => countryIds[c.iso2])
      const region = REGIONS.find((r) => r.slug === rslug)!
      tpls.forEach(([gb, d, usd], i) => rows.push({
        key: `${p.slug}:seed-${rslug}-${i}`, provider: providerIds[p.slug], externalId: `seed-${rslug}-${i}`,
        name: `${region.name} (${region.countryCount} countries) ${gb == null ? 'Unlimited' : gb + 'GB'} ${d} days`,
        scope: rslug === 'global' ? 'global' : 'regional', region: regionIds[rslug], countries: members,
        dataMb: gb == null ? null : gb * 1024, validityDays: d, priceUsd: usd, price: usd, currency: 'USD', network: 'Local partner networks',
        fiveG: hash(p.slug + rslug) < p.fiveG, hotspot: p.hotspot, url: p.website, active: true, lastSeenAt: now, source: 'seed',
      }))
    }
    for (const data of rows) {
      const ex = await payload.find({ collection: 'plans', where: { key: { equals: data.key as string } }, limit: 1, depth: 0 })
      if (ex.docs[0]) await payload.update({ collection: 'plans', id: ex.docs[0].id, data: data as never, depth: 0 })
      else { await payload.create({ collection: 'plans', data: data as never, depth: 0 }); created++ }
    }
  }
  console.log(`Sample plans created: ${created}`)

  // Example coupons, clearly labelled. Replace them in the admin with real codes.
  const coupons = [
    { p: 'airalo', code: 'EXAMPLE10', title: '10% off your first eSIM', label: '10% OFF', type: 'percent', v: 10, excl: true, newUsers: true },
    { p: 'saily', code: 'EXAMPLE15', title: '15% off any plan', label: '15% OFF', type: 'percent', v: 15, excl: true, newUsers: false },
    { p: 'holafly', code: 'EXAMPLE5', title: '5% off unlimited plans', label: '5% OFF', type: 'percent', v: 5, excl: false, newUsers: false },
    { p: 'nomad', code: 'EXAMPLE3', title: '$3 off your first order', label: '$3 OFF', type: 'fixed', v: 3, excl: false, newUsers: true },
    { p: 'ubigi', code: 'EXAMPLE-OLD', title: '20% off summer plans', label: '20% OFF', type: 'percent', v: 20, excl: false, newUsers: false, expired: true },
  ]
  for (const c of coupons) {
    const ex = await payload.find({ collection: 'coupons', where: { code: { equals: c.code } }, limit: 1 })
    if (ex.docs[0]) continue
    await payload.create({
      collection: 'coupons',
      data: {
        provider: providerIds[c.p] as number, code: c.code, title: c.title, discountType: c.type as 'percent', discountValue: c.v,
        discountLabel: c.label, exclusive: c.excl, newUsersOnly: c.newUsers, verifiedAt: now,
        terms: 'Example code created by the seed script. Replace it with a real code in the admin.',
        expiresAt: c.expired ? new Date(Date.now() - 20 * 864e5).toISOString() : new Date(Date.now() + 60 * 864e5).toISOString(),
      },
    })
  }

  // Rankings: global plus one per popular country. Hybrid mode, editors add pins and pros/cons in the admin.
  const pc = (id: string, pros: string[], cons: string[], badge?: string) => ({
    provider: providerIds[id], badge, pros: pros.map((text) => ({ text })), cons: cons.map((text) => ({ text })),
  })
  await upsert('rankings', 'slug', 'global', {
    title: 'Best eSIM for travel', slug: 'global', mode: 'hybrid', size: 10,
    intro: 'We rank every provider on price per GB, Trustpilot rating, coverage, features and plan choice. The score updates every day with fresh prices.',
    entries: [
      pc('airalo', ['Plans for 200+ destinations', 'Top-ups from the app'], ['Some countries need ID verification'], 'Widest coverage'),
      pc('holafly', ['Unlimited data on every plan', 'Simple pricing by trip length'], ['No hotspot on most plans', 'No top-ups']),
      pc('saily', ['Low prices per GB', 'Good 5G support'], ['Newer brand']),
      pc('bnesim', ['Cheapest per GB in many countries', 'Optional phone number'], ['App is less polished']),
    ],
  })
  for (const c of COUNTRIES.filter((x) => x.popular)) {
    await upsert('rankings', 'slug', slug(c.name), {
      title: `Best eSIM for ${c.name}`, slug: slug(c.name), country: countryIds[c.iso2], mode: 'hybrid', size: 10,
      intro: `The best ${c.name} eSIMs ranked by price per GB, Trustpilot rating, network coverage and features.`,
    })
  }

  // Admin user
  const users = await payload.count({ collection: 'users' })
  if (users.totalDocs === 0) {
    const email = process.env.SEED_ADMIN_EMAIL || 'admin@example.com'
    const password = process.env.SEED_ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url')
    await payload.create({ collection: 'users', data: { email, password, name: 'Admin' } })
    console.log(`Admin user: ${email} / ${password}  (change it after first login)`)
  }
  console.log('Seed done')
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
