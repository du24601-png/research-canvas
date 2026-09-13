import test from 'node:test'
import assert from 'node:assert/strict'
import { executeResolveIndustryUniverse } from '../packages/agent/dist/research-industry-universe.js'
import { RESEARCH_DATASET_ENTITY_LIMIT } from '../packages/shared/dist/research-dataset.js'

function batteryHit(name, symbol, exchange) {
  return {
    name,
    market: 'CN',
    assetClass: 'EQUITY',
    instrument: {
      market: 'CN',
      assetClass: 'EQUITY',
      symbol,
      exchange,
    },
  }
}

function makeHub(items, constituents) {
  return {
    async dispatch(feature) {
      if (feature === 'sector_constituents') {
        return {
          success: Array.isArray(constituents) && constituents.length > 0,
          message: 'ok',
          data: { items: constituents ?? [] },
        }
      }
      if (feature === 'instrument_search') {
        return { success: items.length > 0, message: 'ok', data: { items } }
      }
      return { success: false, message: 'unsupported', data: {} }
    },
    de: {
      async queryInstrumentData() {
        return { success: false }
      },
    },
  }
}

test('resolve_industry_universe returns keyword candidates and default 8', async () => {
  const items = [
    batteryHit('宁德时代', '300750', 'SZ'),
    batteryHit('比亚迪', '002594', 'SZ'),
    batteryHit('亿纬锂能', '300014', 'SZ'),
    batteryHit('国轩高科', '002074', 'SZ'),
    batteryHit('欣旺达', '300207', 'SZ'),
    batteryHit('鹏辉能源', '300438', 'SZ'),
    batteryHit('德赛电池', '000049', 'SZ'),
    batteryHit('璞泰来', '603659', 'SH'),
    batteryHit('当升科技', '300073', 'SZ'),
    batteryHit('容百科技', '688005', 'SH'),
  ]
  const result = await executeResolveIndustryUniverse(makeHub(items), { industry: '电池' })
  assert.equal(result.ok, true)
  assert.equal(result.source, 'keyword_search')
  assert.equal(result.complete, false)
  assert.equal(result.default_n, 8)
  assert.equal(result.expand_n, RESEARCH_DATASET_ENTITY_LIMIT)
  assert.equal(result.candidates.length, 10)
  assert.equal(result.default_entities.length, 8)
  assert.equal(result.ask_user_options.length, 10)
  assert.match(String(result.next), /禁止写「行业排名」/)
  assert.match(String(result.ask_user_prompt), /不是完整行业名单/)
})

test('resolve_industry_universe prefers constituents when board_key is set', async () => {
  const constituents = [
    { name: '宁德时代', code: '300750', market: 'SZ', region: 'CN', assetClass: 'EQUITY' },
    { name: '亿纬锂能', code: '300014', market: 'SZ', region: 'CN', assetClass: 'EQUITY' },
  ]
  const result = await executeResolveIndustryUniverse(
    makeHub([batteryHit('应被忽略', '000001', 'SZ')], constituents),
    { industry: '电池', board_key: 'battery' },
  )
  assert.equal(result.source, 'constituents')
  assert.deepEqual(result.default_entities, ['宁德时代', '亿纬锂能'])
})

test('resolve_industry_universe fail-closed when no listed companies', async () => {
  const result = await executeResolveIndustryUniverse(makeHub([]), { industry: '不存在的行业xyz' })
  assert.match(String(result.error), /未能解析/)
})
