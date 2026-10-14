import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FALLBACK_RATES, fallbackRates, toUsd, type RateTable } from '../currency'
import { iconExtension, pickIcons } from '../logos'
import { backoffMs, parseProxyList } from '../http'
import { parseArgs } from '../run'
import { withUsd } from '../sync'
import { fixture } from './helpers'

test('currency: fallback conversion', () => {
  const t = fallbackRates()
  assert.equal(t.source, 'fallback')
  assert.equal(toUsd(10, 'USD', t), 10)
  assert.equal(toUsd(8.6, 'EUR', t), Math.round((8.6 / FALLBACK_RATES.EUR!) * 100) / 100)
  assert.equal(toUsd(10, 'eur'), toUsd(10, 'EUR'))
  assert.equal(toUsd(10, 'XXX', t), undefined)
})

test('currency: live table wins, fallback fills gaps', () => {
  const live: RateTable = { base: 'USD', rates: { USD: 1, EUR: 0.5 }, source: 'open.er-api.com', fetchedAt: '' }
  assert.equal(toUsd(10, 'EUR', live), 20)
  assert.equal(toUsd(150, 'JPY', live), 1)
})

test('withUsd converts and drops unknown currencies', () => {
  const base = { name: 'x', countries: ['US'], scope: 'single' as const, dataMb: 1024, validityDays: 7 }
  const out = withUsd(
    [
      { ...base, externalId: 'a', price: 8.6, currency: 'EUR' },
      { ...base, externalId: 'b', price: 5, currency: 'ZZZ' },
      { ...base, externalId: 'c', price: 5, currency: 'GBP', priceUsd: 6.66 },
    ],
    fallbackRates(),
  )
  assert.deepEqual(out.map((p) => p.externalId), ['a', 'c'])
  assert.equal(out[0]!.priceUsd, 10)
  assert.equal(out[1]!.priceUsd, 6.66)
})

test('icon picker: order and absolute URLs', () => {
  const icons = pickIcons(fixture('logo-page.html'), 'https://www.example.com/en/')
  assert.deepEqual(
    icons.map((i) => `${i.kind} ${i.url}`),
    [
      'apple-touch-icon https://cdn.example.com/apple-180.png',
      'apple-touch-icon https://www.example.com/apple-120.png',
      'jsonld-logo https://www.example.com/brand/logo.svg',
      'og:image https://www.example.com/og-banner.jpg',
      'icon https://www.example.com/icon.svg',
      'icon https://www.example.com/favicon-32.png',
      'icon https://www.example.com/favicon-16.png',
      'favicon https://www.example.com/favicon.ico',
    ],
  )
  const bare = pickIcons('<html><head></head></html>', 'https://bare.example')
  assert.deepEqual(bare.map((i) => i.url), ['https://bare.example/favicon.ico'])
})

test('icon extension detection', () => {
  assert.equal(iconExtension('image/svg+xml', 'https://x/a'), 'svg')
  assert.equal(iconExtension('application/octet-stream', 'https://x/a.PNG'), 'png')
  assert.equal(iconExtension('', 'https://x/a', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])), 'png')
  assert.equal(iconExtension('', 'https://x/a', Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>')), 'svg')
  assert.equal(iconExtension('text/html', 'https://x/a'), undefined)
})

test('http helpers', () => {
  assert.deepEqual(parseProxyList(' http://u:p@1.2.3.4:8080, ,bogus, https://h:3128 '), ['http://u:p@1.2.3.4:8080', 'https://h:3128'])
  for (let a = 1; a <= 8; a++) {
    const ms = backoffMs(a)
    const cap = Math.min(30_000, 1000 * 2 ** (a - 1))
    assert.ok(ms >= cap / 2 && ms <= cap, `attempt ${a}: ${ms}`)
  }
})

test('CLI args', () => {
  assert.deepEqual(parseArgs([]), { job: 'all', dryRun: false, noProxy: false, force: false, help: false })
  const a = parseArgs(['prices', '--provider', 'Airalo', '--dry-run', '--no-proxy', '--countries=us,jp'])
  assert.equal(a.job, 'prices')
  assert.equal(a.provider, 'airalo')
  assert.equal(a.dryRun, true)
  assert.equal(a.noProxy, true)
  assert.deepEqual(a.countries, ['US', 'JP'])
  assert.throws(() => parseArgs(['--provider']), /needs a value/)
  assert.throws(() => parseArgs(['nope']), /unknown argument/)
})
