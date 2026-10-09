/**
 * M2-E3：非 A 股标的明确返回 unsupported_market（找到了但不支持），不再是笼统的「无法确认」。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { pickCnEquityHit, resolveResearchEntity } from '../packages/agent/dist/research-entity-resolver.js'

const US_HIT = { name: '苹果', market: 'US', instrument: { market: 'US', assetClass: 'EQUITY', symbol: 'AAPL' } }
const CN_HIT = { name: '贵州茅台', market: 'CN', instrument: { market: 'CN', assetClass: 'EQUITY', symbol: '600519', exchange: 'SH' } }

test('name search that only finds non-A-share listings → unsupported_market', () => {
  const r = pickCnEquityHit('苹果', [US_HIT])
  assert.equal(r.status, 'unsupported_market')
  assert.equal(r.market, 'US')
  assert.match(r.error, /只支持 A 股/)
  assert.ok(r.hint.includes('不要换名称或代码重试'))
})

test('A-share hits still resolve; no hits at all keeps the old message', () => {
  assert.equal(pickCnEquityHit('贵州茅台', [CN_HIT, US_HIT]).entity.name, '贵州茅台')
  assert.match(pickCnEquityHit('不存在公司', []).error, /无法确认/)
})

test('explicit US/HK codes fail fast without searching', async () => {
  let searched = 0
  const search = { search: async () => { searched += 1; return [] } }
  assert.equal((await resolveResearchEntity('AAPL', search)).status, 'unsupported_market')
  assert.equal((await resolveResearchEntity('00700.HK', search)).market, 'HK')
  assert.equal(searched, 0)
})
