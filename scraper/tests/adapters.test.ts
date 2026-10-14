import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseAiraloGroup, parseAiraloPackages } from '../adapters/airalo'
import { parseHolaflyProducts } from '../adapters/holafly'
import { parseSailyPage } from '../adapters/saily'
import { parseNomadPage } from '../adapters/nomad'
import { parseUbigiPage } from '../adapters/ubigi'
import { adapters } from '../adapters'
import { validatePlans } from '../types'
import { countryRef } from '../sync'
import { fixture, fixtureJson } from './helpers'

test('airalo: Partner API packages (country, regional, global)', () => {
  const plans = parseAiraloPackages(fixtureJson('airalo-partner-packages.json'))
  assert.equal(plans.length, 4, 'the zero-price package is dropped')
  const us1 = plans.find((p) => p.externalId === 'change-7days-1gb')!
  assert.equal(us1.scope, 'single')
  assert.deepEqual(us1.countries, ['US'])
  assert.equal(us1.dataMb, 1024)
  assert.equal(us1.validityDays, 7)
  assert.equal(us1.price, 4.5)
  assert.equal(us1.currency, 'USD')
  assert.equal(us1.fiveG, true)
  assert.equal(us1.network, 'T-Mobile, AT&T')
  const unl = plans.find((p) => p.externalId === 'change-30days-unlimited')!
  assert.equal(unl.dataMb, null)
  assert.equal(unl.phoneNumber, true)
  const eu = plans.find((p) => p.externalId === 'eurolink-15days-3gb')!
  assert.equal(eu.scope, 'regional')
  assert.equal(eu.regionSlug, 'europe')
  assert.deepEqual(eu.countries, ['FR', 'DE', 'IT'])
  const world = plans.find((p) => p.externalId === 'discover-30days-5gb')!
  assert.equal(world.scope, 'global')
  assert.equal(world.regionSlug, undefined)
})

test('airalo: website country payload with daily plan', () => {
  const plans = validatePlans(parseAiraloGroup(fixtureJson('airalo-web-country.json'), { kind: 'country' }))
  assert.equal(plans.length, 2)
  assert.equal(plans[0]!.externalId, 'moshi-moshi-7days-1gb')
  assert.deepEqual(plans[0]!.countries, ['JP'])
  const daily = plans[1]!
  assert.equal(daily.dailyMb, 2048)
  assert.equal(daily.dataMb, 20480)
})

test('holafly: Shopify products.json', () => {
  const plans = parseHolaflyProducts(fixtureJson('holafly-products.json'), { currency: 'USD' })
  const ids = plans.map((p) => p.externalId).sort()
  assert.deepEqual(ids, ['41001', '41002', '42001', '44001'], 'unavailable variant and gift card skipped')
  const us5 = plans.find((p) => p.externalId === '41001')!
  assert.deepEqual(us5.countries, ['US'])
  assert.equal(us5.scope, 'single')
  assert.equal(us5.dataMb, null)
  assert.equal(us5.validityDays, 5)
  assert.equal(us5.price, 19)
  assert.equal(us5.originalPrice, 24)
  assert.match(us5.url!, /esim-united-states\?variant=41001$/)
  const eu = plans.find((p) => p.externalId === '42001')!
  assert.equal(eu.scope, 'regional')
  assert.equal(eu.regionSlug, 'europe')
  assert.deepEqual(eu.countries, ['FR', 'ES', 'IT'])
  const jp = plans.find((p) => p.externalId === '44001')!
  assert.equal(jp.dataMb, 3072)
  assert.deepEqual(jp.countries, ['JP'])
})

test('saily: __NEXT_DATA__ destination page', () => {
  const plans = parseSailyPage(fixture('saily-page.html'), countryRef('JP'), 'https://saily.com/esim-japan/')
  assert.equal(plans.length, 3)
  const p1 = plans.find((p) => p.externalId === 'jp-jp-1gb-7d')!
  assert.equal(p1.dataMb, 1024)
  assert.equal(p1.validityDays, 7)
  assert.equal(p1.price, 4.99)
  assert.equal(p1.currency, 'USD')
  assert.deepEqual(p1.countries, ['JP'])
  const p5 = plans.find((p) => p.externalId === 'jp-jp-5gb-30d')!
  assert.equal(p5.originalPrice, 19.99)
  assert.equal(p5.validityDays, 30)
  const unl = plans.find((p) => p.externalId === 'jp-jp-unl-10d')!
  assert.equal(unl.dataMb, null)
})

test('nomad: JSON-LD offers fallback', () => {
  const plans = parseNomadPage(fixture('nomad-page.html'), countryRef('FR'))
  assert.equal(plans.length, 3)
  const big = plans.find((p) => p.externalId === 'fr-FR-10GB-30D')!
  assert.equal(big.dataMb, 10240)
  assert.equal(big.validityDays, 30)
  assert.equal(big.price, 21)
  const unl = plans.find((p) => p.externalId === 'fr-FR-UNL-5D')!
  assert.equal(unl.dataMb, null)
  assert.equal(unl.validityDays, 5)
})

test('ubigi: JSON payload with EUR prices and daily plan', () => {
  const plans = parseUbigiPage(fixture('ubigi-plans.json'), countryRef('DE'))
  assert.equal(plans.length, 3)
  const small = plans.find((p) => p.externalId === 'de-de-500mb-30d')!
  assert.equal(small.dataMb, 500)
  assert.equal(small.price, 4)
  assert.equal(small.currency, 'EUR')
  const g3 = plans.find((p) => p.externalId === 'de-de-3gb-30d')!
  assert.equal(g3.fiveG, true)
  const daily = plans.find((p) => p.externalId === 'de-de-daily')!
  assert.equal(daily.dailyMb, 1024)
  assert.equal(daily.validityDays, 30)
  assert.equal(daily.dataMb, 30720)
})

test('page parser returns nothing for pages without plan data', () => {
  assert.deepEqual(parseSailyPage('<html><body>Access denied</body></html>', countryRef('JP')), [])
})

test('registry: all DB providers have an adapter; stubs throw', async () => {
  for (const slug of ['airalo', 'holafly', 'nomad', 'saily', 'ubigi', 'maya', 'yesim', 'jetpac', 'gigsky', 'bnesim']) {
    assert.ok(adapters[slug], `adapter for ${slug}`)
  }
  for (const slug of ['airalo', 'holafly', 'nomad', 'saily', 'ubigi']) assert.equal(adapters[slug]!.implemented, true)
  await assert.rejects(adapters.maya!.fetchPlans({} as never), /not implemented yet/)
})
