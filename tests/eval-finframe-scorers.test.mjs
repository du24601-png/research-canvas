import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { extractClaimNumbers, scoreNumbersGrounded } from '../eval/finframe/scorers/numbers-grounded.mjs'
import { scoreSourcePeriod } from '../eval/finframe/scorers/source-period.mjs'
import { scoreRefusal } from '../eval/finframe/scorers/refusal.mjs'
import { buildFixtureDataset, makeFinframeStub } from '../eval/finframe/fixtures.mjs'
import { metricValue, resolveFixtureEntity } from '../eval/finframe/fixture-data.mjs'

const ents = ['贵州茅台', '五粮液'].map((n) => resolveFixtureEntity(n).entity)
const ds = buildFixtureDataset('research-ds-ff-1', ents, 'net_margin', ['2021', '2022', '2023'])
const v = ds.data[0].value

test('extractClaimNumbers skips years, codes, counts, ids and list markers', () => {
  const nums = extractClaimNumbers('1. 茅台（600519）2021–2023 年共 3 年，research-ds-ff-1，第 2 名，净利率 12.5%')
  assert.deepEqual(nums.map((n) => n.raw), ['12.5'])
  assert.deepEqual(extractClaimNumbers('截至 2026/9/14，2026 年 9 月尚未披露，2025-12-31 年报').map((n) => n.raw), [])
  assert.deepEqual(extractClaimNumbers('2021-2025 年，2024 年 37.5%，2023年 12 月 8%').map((n) => n.raw), ['37.5', '8'])
})

test('numbers_grounded accepts dataset values at written precision, rejects others', () => {
  assert.equal(scoreNumbersGrounded({ texts: [`约 ${v.toFixed(1)}%`], datasets: [ds] }).pass, true)
  const bad = scoreNumbersGrounded({ texts: ['约 99.99%'], datasets: [ds] })
  assert.equal(bad.pass, false)
  assert.deepEqual(bad.ungrounded, ['99.99'])
})

test('source_period requires structural sources plus period and source in reply', () => {
  const calls = [{ name: 'propose_widget', args: { datasetId: ds.id } }]
  const evalCase = { expect: 'answer' }
  assert.equal(scoreSourcePeriod({ evalCase, calls, texts: ['2021–2023 年净利率，来源见卡片'], datasets: [ds] }).pass, true)
  const noSource = scoreSourcePeriod({ evalCase, calls, texts: ['2021–2023 年净利率'], datasets: [ds] })
  assert.equal(noSource.pass, true, 'source_in_reply is informational only')
  assert.equal(noSource.checks.source_in_reply, false)
  assert.equal(scoreSourcePeriod({ evalCase, calls, texts: ['净利率见图'], datasets: [ds] }).pass, false)
  assert.equal(scoreSourcePeriod({ evalCase: { expect: 'refuse' }, calls, texts: [], datasets: [ds] }).applicable, false)
})

test('refusal distinguishes refuse, clarify and answer', () => {
  const none = []
  assert.equal(scoreRefusal({ evalCase: { expect: 'refuse' }, calls: none, texts: ['暂不支持美股'], datasets: [] }).pass, true)
  const loops = Array.from({ length: 5 }, () => ({ name: 'get_instrument_financials', args: {} }))
  assert.equal(scoreRefusal({ evalCase: { expect: 'refuse' }, calls: loops, texts: ['无法获取'], datasets: [] }).pass, false)
  assert.equal(scoreRefusal({ evalCase: { expect: 'clarify' }, calls: none, texts: ['你是指中芯国际 A 股还是港股？'], datasets: [] }).pass, true)
  assert.equal(scoreRefusal({ evalCase: { expect: 'answer' }, calls: none, texts: ['做不到'], datasets: [] }).pass, false)
  const alt = scoreRefusal({ evalCase: { expect: 'refuse' }, calls: [{ name: 'propose_widget', args: { datasetId: ds.id } }], texts: ['2026 全年尚未披露，先给你 2021–2023'], datasets: [ds] })
  assert.equal(alt.pass, true)
  assert.equal(alt.alternative_offered, true)
})

test('fixture mirrors production: no numbers to the model, CN only, future years empty', () => {
  const store = { datasets: new Map() }
  const stub = makeFinframeStub(store)
  const ok = stub({ name: 'query_data', args: { entities: ['茅台', '五粮液'], metric: 'roe', start: '2021', end: '2025' } }, {}, {})
  assert.equal(ok.ok, true)
  assert.equal(JSON.stringify(ok).includes(String(metricValue('600519', 'roe', '2021'))), false)
  assert.equal(store.datasets.size, 1)
  assert.equal(stub({ name: 'query_data', args: { entities: ['苹果'], metric: 'revenue', start: '2020', end: '2024' } }, {}, {}).status, 'unsupported_market')
  assert.match(stub({ name: 'query_data', args: { entities: ['中芯'], metric: 'gross_margin', start: '2021', end: '2025' } }, {}, {}).error, /多家/)
  assert.match(stub({ name: 'query_data', args: { entities: ['茅台'], metric: 'revenue', start: '2026', end: '2026' } }, {}, {}).error, /未能提供/)
})

test('seed set has 12 cases with expect and slice', () => {
  const pack = JSON.parse(readFileSync(new URL('../eval/finframe/cases/seed-v1.json', import.meta.url), 'utf8'))
  assert.equal(pack.cases.length, 12)
  for (const c of pack.cases) {
    assert.ok(['answer', 'answer_with_gap', 'refuse', 'clarify'].includes(c.expect), c.id)
    assert.ok(c.slice && c.task && c.gold, c.id)
  }
})
