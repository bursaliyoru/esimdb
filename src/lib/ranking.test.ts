import { test } from 'node:test'
import assert from 'node:assert/strict'
import { orderRanking, scoreProviders } from './ranking'

test('cheaper per GB and higher trust scores higher', () => {
  const s = scoreProviders([
    { id: 'a', bestPerGbUsd: 1, trustScore: 4.5, countryCount: 100, planCount: 50, features: { topUp: true, hotspot: true } },
    { id: 'b', bestPerGbUsd: 3, trustScore: 3.0, countryCount: 100, planCount: 50, features: { topUp: true, hotspot: true } },
  ])
  assert.ok(s.get('a')!.total > s.get('b')!.total)
  assert.equal(s.get('a')!.price, 1)
})

test('hybrid: pins move, exclusions drop, rest keeps auto order', () => {
  const auto = ['a', 'b', 'c', 'd', 'e']
  const out = orderRanking('hybrid', auto, [
    { providerId: 'd', pinnedPosition: 1 },
    { providerId: 'b', excluded: true },
  ])
  assert.deepEqual(out, ['d', 'a', 'c', 'e'])
})

test('hybrid: pin beyond the list end lands last', () => {
  assert.deepEqual(orderRanking('hybrid', ['a', 'b'], [{ providerId: 'a', pinnedPosition: 9 }]), ['b', 'a'])
})

test('manual uses editor order and size', () => {
  assert.deepEqual(
    orderRanking('manual', ['a', 'b', 'c'], [{ providerId: 'c' }, { providerId: 'a' }, { providerId: 'b', excluded: true }], 2),
    ['c', 'a'],
  )
})
