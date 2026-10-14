import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTrustpilotApi, parseTrustpilotPage } from '../trustpilot'
import { fixture, fixtureJson } from './helpers'

test('trustpilot: __NEXT_DATA__ page', () => {
  const s = parseTrustpilotPage(fixture('trustpilot-page.html'))
  assert.equal(s.businessUnitId, '5d0bfe9d7e48ab0001b0e4f0')
  assert.equal(s.trustScore, 4.6)
  assert.equal(s.reviewCount, 12345)
  assert.equal(s.reviews.length, 2, 'invalid rating dropped')
  const r = s.reviews[0]!
  assert.equal(r.id, '66f1a2b3c4d5e6f708192a3b')
  assert.equal(r.rating, 5)
  assert.equal(r.title, 'Worked instantly in Tokyo')
  assert.equal(r.authorName, 'Jane D.')
  assert.equal(r.authorCountry, 'GB')
  assert.equal(r.publishedAt, '2026-10-10T08:15:00.000Z')
  assert.equal(r.experiencedAt, '2026-10-01T00:00:00.000Z')
})

test('trustpilot: page without __NEXT_DATA__ throws', () => {
  assert.throws(() => parseTrustpilotPage('<html><body>captcha</body></html>'), /pageProps not found/)
})

test('trustpilot: official API payloads', () => {
  const s = parseTrustpilotApi(fixtureJson('trustpilot-api-bu.json'), fixtureJson('trustpilot-api-reviews.json'))
  assert.equal(s.trustScore, 4.6)
  assert.equal(s.reviewCount, 12345)
  assert.equal(s.reviews.length, 2)
  assert.equal(s.reviews[0]!.rating, 4)
  assert.equal(s.reviews[0]!.authorCountry, 'US')
  assert.equal(s.reviews[1]!.authorName, 'Trustpilot user')
  assert.equal(s.reviews[1]!.title, undefined)
  assert.equal(s.reviews[1]!.text, 'Never activated.')
})
