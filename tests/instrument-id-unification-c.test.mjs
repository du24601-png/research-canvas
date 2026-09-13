/**
 * 关注列表未消歧：本地唯一写回 + 多命中候选（在线版）
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  disambiguateWatchlistItemsLocal,
  disambiguateWatchlistItemFromHits,
  disambiguateWatchlistItemOutcome,
  pickUniqueInstrumentRef,
  watchlistItemNeedsDisambiguation,
  filterExactDigitHits,
  applyResolvedInstrument,
} from '../packages/a-stock-layer/dist/watchlist/disambiguate-instrument.js'
import { normalizeWatchlistItem } from '../packages/a-stock-layer/dist/watchlist/instrument.js'

test('关注消歧：唯一 HK 本地命中可写回；多命中不写；跑两次幂等', () => {
  const unresolved = normalizeWatchlistItem({ code: '700', name: '未知短码' })
  assert.equal(watchlistItemNeedsDisambiguation(unresolved), true)
  assert.equal(unresolved.instrument, undefined)

  const hkHit = {
    instrument: { market: 'HK', assetClass: 'EQUITY', symbol: '00700', exchange: 'HK' },
    name: '腾讯控股',
  }
  const cnHit = {
    instrument: { market: 'CN', assetClass: 'EQUITY', symbol: '000700', exchange: 'SZ' },
    name: '模塑科技',
  }

  const unique = disambiguateWatchlistItemFromHits(unresolved, [hkHit])
  assert.equal(unique.instrument?.market, 'HK')
  assert.equal(unique.instrument?.symbol, '00700')
  assert.equal(unique.code, 'HK:STOCK:00700.HK')

  const ambiguous = disambiguateWatchlistItemFromHits(unresolved, [hkHit, cnHit])
  assert.equal(ambiguous.instrument, undefined)
  assert.equal(ambiguous.code, '700')

  const outcome = disambiguateWatchlistItemOutcome(unresolved, [hkHit, cnHit])
  assert.equal(outcome.status, 'ambiguous')
  assert.ok(outcome.status === 'ambiguous' && outcome.candidates.length >= 2)
  if (outcome.status === 'ambiguous') {
    assert.ok(outcome.candidates.every(c => c.code && c.instrument.market && c.instrument.symbol))
    const pick = outcome.candidates.find(c => c.instrument.market === 'HK')
    assert.ok(pick)
    const applied = applyResolvedInstrument(unresolved, pick.instrument, pick.name)
    assert.equal(applied.instrument?.market, 'HK')
    assert.equal(applied.instrument?.symbol, '00700')
    assert.equal(watchlistItemNeedsDisambiguation(applied), false)
  }

  const lookupUnique = () => [hkHit]
  const once = disambiguateWatchlistItemsLocal([unresolved], lookupUnique)
  const twice = disambiguateWatchlistItemsLocal(once.items, lookupUnique)
  assert.equal(once.resolved, 1)
  assert.equal(twice.resolved, 0)
  assert.deepEqual(
    once.items.map(i => ({ code: i.code, market: i.instrument?.market, symbol: i.instrument?.symbol })),
    twice.items.map(i => ({ code: i.code, market: i.instrument?.market, symbol: i.instrument?.symbol })),
  )

  const multiLookup = () => [hkHit, cnHit]
  const noWrite = disambiguateWatchlistItemsLocal([unresolved], multiLookup)
  assert.equal(noWrite.resolved, 0)
  assert.equal(noWrite.items[0].instrument, undefined)
  assert.ok((noWrite.candidatesByCode['700'] ?? []).length >= 2)
})

test('filterExactDigitHits / pickUnique：同数字不同市场视为多命中', () => {
  const hits = filterExactDigitHits(
    [
      { instrument: { market: 'HK', assetClass: 'EQUITY', symbol: '00700' } },
      { instrument: { market: 'CN', assetClass: 'EQUITY', symbol: '000700' } },
    ],
    '700',
  )
  assert.equal(hits.length, 2)
  assert.equal(pickUniqueInstrumentRef(hits), null)
  assert.ok(pickUniqueInstrumentRef([hits[0]]))
})
