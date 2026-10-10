/**
 * 简称歧义：「平安」同时命中中国平安、平安银行时返回 ambiguous_entity，让模型先问用户，而不是猜一家。
 * 全称、代码、唯一简称仍直接解析。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { pickCnEquityHit, resolveResearchEntity } from '../packages/agent/dist/research-entity-resolver.js'

const PING_AN = { name: '中国平安', market: 'CN', instrument: { market: 'CN', assetClass: 'EQUITY', symbol: '601318', exchange: 'SH' } }
const PING_AN_BANK = { name: '平安银行', market: 'CN', instrument: { market: 'CN', assetClass: 'EQUITY', symbol: '000001', exchange: 'SZ' } }
const MOUTAI = { name: '贵州茅台', market: 'CN', instrument: { market: 'CN', assetClass: 'EQUITY', symbol: '600519', exchange: 'SH' } }

test('short name shared by several listed companies → ambiguous, asks the user', () => {
  const r = pickCnEquityHit('平安', [PING_AN, PING_AN_BANK])
  assert.equal('entity' in r, false)
  assert.equal(r.status, 'ambiguous_entity')
  assert.deepEqual(r.candidates.map(c => c.name).sort(), ['中国平安', '平安银行'])
  assert.deepEqual(r.candidates.map(c => c.ticker).sort(), ['000001', '601318'])
  assert.match(r.error, /中国平安（601318）/)
  assert.match(r.error, /平安银行（000001）/)
  assert.match(r.error, /请先问用户指哪一家，不要自行选择/)
})

test('full name resolves directly even when a shorter-name peer is in the hits', () => {
  assert.equal(pickCnEquityHit('中国平安', [PING_AN, PING_AN_BANK]).entity.ticker, '601318.SH')
  assert.equal(pickCnEquityHit('平安银行', [PING_AN, PING_AN_BANK]).entity.ticker, '000001.SZ')
})

test('explicit code resolves through resolveResearchEntity', async () => {
  const search = { search: async () => [PING_AN_BANK] }
  const r = await resolveResearchEntity('000001', search)
  assert.equal(r.entity.name, '平安银行')
  assert.equal(r.entity.ticker, '000001.SZ')
  const direct = await resolveResearchEntity('601318', { search: async () => [] })
  assert.equal(direct.entity.ticker, '601318.SH')
})

test('name search that returns both hits for a full name resolves to that company', async () => {
  const search = { search: async () => [PING_AN, PING_AN_BANK] }
  const r = await resolveResearchEntity('中国平安', search)
  assert.equal(r.entity.ticker, '601318.SH')
})

test('a unique short name still resolves', async () => {
  const search = { search: async () => [MOUTAI] }
  assert.equal((await resolveResearchEntity('茅台', search)).entity.name, '贵州茅台')
  assert.equal(pickCnEquityHit('贵州茅台', [MOUTAI]).entity.ticker, '600519.SH')
})

test('ambiguous result from resolveResearchEntity carries the error so callers return it to the model', async () => {
  const search = { search: async () => [PING_AN, PING_AN_BANK] }
  const r = await resolveResearchEntity('平安', search)
  assert.ok('error' in r)
  assert.equal(r.status, 'ambiguous_entity')
})

test('same instrument returned twice (full + short name) is not reported as ambiguous', () => {
  const BOC_SHORT = { name: '中国银行', market: 'CN', instrument: { market: 'CN', assetClass: 'EQUITY', symbol: '601988', exchange: 'SH' } }
  const BOC_FULL = { name: '中国银行股份有限公司', market: 'CN', instrument: { market: 'CN', assetClass: 'EQUITY', symbol: '601988', exchange: 'SH' } }
  const r = pickCnEquityHit('中国银行', [BOC_SHORT, BOC_FULL])
  assert.equal('entity' in r, true)
  assert.equal(r.entity.ticker, '601988.SH')
  const dupes = pickCnEquityHit('平安', [PING_AN, PING_AN, PING_AN_BANK])
  assert.equal(dupes.status, 'ambiguous_entity')
  assert.equal(dupes.candidates.length, 2)
})

test('one keyword match among unrelated equities resolves to that match', () => {
  const WULIANGYE = { name: '五粮液', market: 'CN', instrument: { market: 'CN', assetClass: 'EQUITY', symbol: '000858', exchange: 'SZ' } }
  const r = pickCnEquityHit('茅台', [MOUTAI, WULIANGYE])
  assert.equal(r.entity.name, '贵州茅台')
  assert.equal(r.entity.ticker, '600519.SH')
})
