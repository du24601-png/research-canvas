import assert from 'node:assert/strict'
import test from 'node:test'
import {
  computeMarketRegime,
  computeSentimentScore,
  computeMarksCycle,
  computeMaPositionPct,
  computeHv20Pct,
} from '../packages/shared/dist/market-regime.js'
test('market regime panic requires multi-signal resonance', () => {
  const snap = computeMarketRegime({
    index_m6m: -15,
    index_m1m: -8,
    advance_pct: 20,
    limit_down: 80,
    index_pe: 9,
  })
  assert.equal(snap.regime, 'panic')
  assert.equal(snap.indicators.marks_cycle, '极度悲观')
})

test('marks cycle from index PE bands', () => {
  assert.equal(computeMarksCycle(9, null), '极度悲观')
  assert.equal(computeMarksCycle(13, null), '中性')
  assert.equal(computeMarksCycle(18, null), '极度乐观')
})

test('sentiment score blends breadth and momentum', () => {
  const score = computeSentimentScore({
    ma125_position_pct: 5,
    advance_pct: 70,
    hv20_pct: 18,
    limit_up: 60,
    limit_down: 10,
    northbound_net_yi: 30,
    index_m6m: 10,
    turnover_vs_20d: 1.2,
  })
  assert.ok(score != null && score > 55)
})

test('kline helpers produce numeric outputs', () => {
  const klines = Array.from({ length: 130 }, (_, i) => ({
    close: 100 + i * 0.1,
    amount: 1e9 + i * 1e7,
  }))
  assert.ok(computeMaPositionPct(klines, 125) != null)
  assert.ok(computeHv20Pct(klines) != null)
})
