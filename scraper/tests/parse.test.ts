import { test } from 'node:test'
import assert from 'node:assert/strict'
import { countryNameToIso2, parseDataSize, parsePrice, parseValidityDays, planLabel, regionSlugFromName, slugify, totalDataMb } from '../parse'

test('parseDataSize: common formats', () => {
  assert.deepEqual(parseDataSize('1GB'), { dataMb: 1024 })
  assert.deepEqual(parseDataSize('500 MB'), { dataMb: 500 })
  assert.deepEqual(parseDataSize('1,5 GB'), { dataMb: 1536 })
  assert.deepEqual(parseDataSize('1.5gb'), { dataMb: 1536 })
  assert.deepEqual(parseDataSize('Unlimited'), { dataMb: null })
  assert.deepEqual(parseDataSize('Unlimited data'), { dataMb: null })
  assert.deepEqual(parseDataSize('3 GB/day'), { dataMb: null, dailyMb: 3072 })
  assert.deepEqual(parseDataSize('2GB per day'), { dataMb: null, dailyMb: 2048 })
  assert.deepEqual(parseDataSize('1 GB daily'), { dataMb: null, dailyMb: 1024 })
  assert.deepEqual(parseDataSize('1 TB'), { dataMb: 1048576 })
  assert.deepEqual(parseDataSize(2048), { dataMb: 2048 })
  assert.deepEqual(parseDataSize('750'), { dataMb: 750 })
  assert.equal(parseDataSize('call us'), undefined)
  assert.equal(parseDataSize(''), undefined)
  assert.equal(parseDataSize(null), undefined)
})

test('totalDataMb multiplies daily allowance by validity', () => {
  assert.equal(totalDataMb({ dataMb: null, dailyMb: 3072, validityDays: 10 }), 30720)
  assert.equal(totalDataMb({ dataMb: null, validityDays: 10 }), null)
  assert.equal(totalDataMb({ dataMb: 1024, validityDays: 7 }), 1024)
})

test('parseValidityDays', () => {
  assert.equal(parseValidityDays('7 days'), 7)
  assert.equal(parseValidityDays('30 Days'), 30)
  assert.equal(parseValidityDays('1 week'), 7)
  assert.equal(parseValidityDays('1 month'), 30)
  assert.equal(parseValidityDays('1 year'), 365)
  assert.equal(parseValidityDays('24 hours'), 1)
  assert.equal(parseValidityDays(15), 15)
  assert.equal(parseValidityDays('n/a'), undefined)
  assert.equal(parseValidityDays(0), undefined)
})

test('parsePrice', () => {
  assert.deepEqual(parsePrice('$4.50'), { amount: 4.5, currency: 'USD' })
  assert.deepEqual(parsePrice('4,50 €'), { amount: 4.5, currency: 'EUR' })
  assert.deepEqual(parsePrice('USD 12'), { amount: 12, currency: 'USD' })
  assert.deepEqual(parsePrice('1,299.00'), { amount: 1299, currency: undefined })
  assert.deepEqual(parsePrice('1.299,00 €'), { amount: 1299, currency: 'EUR' })
  assert.deepEqual(parsePrice(9.99), { amount: 9.99 })
  assert.equal(parsePrice('free'), undefined)
  assert.equal(parsePrice(0), undefined)
})

test('country and region helpers', () => {
  assert.equal(countryNameToIso2('United States'), 'US')
  assert.equal(countryNameToIso2('united-states'), 'US')
  assert.equal(countryNameToIso2('USA'), 'US')
  assert.equal(countryNameToIso2('South Korea'), 'KR')
  assert.equal(countryNameToIso2('Türkiye'), 'TR')
  assert.equal(countryNameToIso2('Japan'), 'JP')
  assert.equal(countryNameToIso2('Atlantis'), undefined)
  assert.equal(regionSlugFromName('Europe'), 'europe')
  assert.equal(regionSlugFromName('Eurolink'), 'europe')
  assert.equal(regionSlugFromName('Discover Global'), 'global')
  assert.equal(regionSlugFromName('France'), undefined)
  assert.equal(slugify('Côte d’Ivoire'), 'cote-d-ivoire')
  assert.equal(slugify('Bosnia & Herzegovina'), 'bosnia-and-herzegovina')
  assert.equal(planLabel({ dataMb: 1024, validityDays: 7 }), '1 GB · 7 days')
  assert.equal(planLabel({ dataMb: null, validityDays: 1 }), 'Unlimited · 1 day')
})
