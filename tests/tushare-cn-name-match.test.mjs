/**
 * Tushare A 股简称 / 代码匹配 — 不打上游。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { matchTushareCnNameRows } from '../packages/a-stock-layer/dist/providers/tushare/name-directory.js'

const ROWS = [
  { symbol: '601058', exchange: 'SH', name: '赛轮', keys: ['赛轮轮', '赛轮', '赛轮集团股份有限公司'] },
  { symbol: '601966', exchange: 'SH', name: '玲珑轮胎', keys: ['玲珑轮胎'] },
  { symbol: '002984', exchange: 'SZ', name: '森麒麟', keys: ['森麒麟'] },
  { symbol: '600519', exchange: 'SH', name: '贵州茅台', keys: ['贵州茅台'] },
  { symbol: '000589', exchange: 'SZ', name: '贵州轮胎', keys: ['贵州轮胎'] },
]

test('matches full name, ticker, and unique short prefix', () => {
  assert.equal(matchTushareCnNameRows(ROWS, '赛轮轮胎', 8)[0]?.symbol, '601058')
  assert.equal(matchTushareCnNameRows(ROWS, '601058.SH', 8)[0]?.name, '赛轮')
  assert.equal(matchTushareCnNameRows(ROWS, '赛轮', 8)[0]?.symbol, '601058')
  assert.equal(matchTushareCnNameRows(ROWS, '玲珑', 8)[0]?.symbol, '601966')
  assert.equal(matchTushareCnNameRows(ROWS, '森麒麟', 8)[0]?.symbol, '002984')
})

test('unique substring matches 茅台; ambiguous 轮胎 stays unresolved', () => {
  assert.equal(matchTushareCnNameRows(ROWS, '茅台', 8)[0]?.symbol, '600519')
  const tires = matchTushareCnNameRows(ROWS, '轮胎', 8)
  assert.ok(tires.length >= 2)
  assert.ok(tires.every(row => row.name.includes('轮胎')))
})

test('generic tokens do not fuzzy-match the whole market', () => {
  assert.deepEqual(matchTushareCnNameRows(ROWS, '股份', 8), [])
  assert.deepEqual(matchTushareCnNameRows(ROWS, '中国', 8), [])
})
