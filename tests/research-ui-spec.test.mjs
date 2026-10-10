/**
 * FinFrame M3：UI Spec 校验——只认已注册组件/动作与已知 datasetId，任何不合规整份拒绝，不带数值。
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { parseResearchUiSpec } from '../packages/shared/dist/research-ui-spec.js'

const DS = 'research-ds-11111111-1111-4111-8111-111111111111'
const DELTA = 'research-ds-33333333-3333-4333-8333-333333333333'
const A = 'CN:SH.600519'
const B = 'CN:SZ.000858'
const PERIODS = ['2023', '2024', '2025']
const known = new Map([
  [DS, { entityIds: [A, B], periods: PERIODS }],
  [DELTA, { parentDatasetId: DS, transformType: 'yoy_delta', entityIds: [A, B], periods: ['2024', '2025'] }],
])

test('valid spec parses to the same blocks', () => {
  const raw = { version: 1, blocks: [{ component: 'TrendView', datasetId: DS, deltaDatasetId: DELTA, title: '2021–2025 净利率', actions: ['highlight_largest_change'] }, { component: 'EvidencePanel', datasetIds: [DS], title: '数据来源' }] }
  const result = parseResearchUiSpec(raw, known)
  assert.equal(result.ok, true)
  assert.deepEqual(result.spec, raw)
})

test('any violation rejects the whole spec with readable errors', () => {
  const cases = [
    { version: 2, blocks: [{ component: 'EvidencePanel', datasetIds: [DS] }] },
    { version: 1, blocks: [] },
    { version: 1, blocks: [{ component: 'EvidencePanel', datasetIds: [DS] }], extra: true },
    { version: 1, blocks: [{ component: 'TrendView', datasetId: DS, title: '同比 +3.1' }] },
    { version: 1, blocks: [{ component: 'EvidencePanel', datasetIds: [DS], actions: ['highlight_largest_change'] }] },
    { version: 1, blocks: [{ component: 'TrendView', datasetId: DELTA, deltaDatasetId: DS }] },
    { version: 1, blocks: [{ component: 'ComparisonView', datasetIds: [DS, DS] }] },
    { version: 1, blocks: [{ component: 'MissingData', datasetId: 'research-ds-unknown' }] },
  ]
  for (const raw of cases) {
    const result = parseResearchUiSpec(raw, known)
    assert.equal(result.ok, false, JSON.stringify(raw))
    assert.ok(result.errors.length > 0)
  }
})

test('old specs without entity/period refs still parse', () => {
  const legacy = new Map([[DS, {}]])
  const raw = { version: 1, blocks: [{ component: 'ComparisonView', datasetIds: [DS], actions: ['pin'] }, { component: 'MissingData', datasetId: DS }] }
  assert.deepEqual(parseResearchUiSpec(raw, legacy).spec, raw)
})

test('KpiRow and NumberSentence validate with placeholders only', () => {
  const raw = {
    version: 1,
    blocks: [
      { component: 'NumberSentence', datasetId: DS, template: `{entity:${A}} 2025 年净利率 {value:${A}@2025}，较上年 {delta:${A}@2025}，比 {entity:${B}} 高 {gap:${A}@${B}@2025}；{largestChange}。` },
      { component: 'KpiRow', datasetId: DS, period: '2025', title: '2025 年关键数字' },
      { component: 'KpiRow', datasetId: DS },
    ],
  }
  const result = parseResearchUiSpec(raw, known)
  assert.equal(result.ok, true, JSON.stringify(result.errors))
  assert.deepEqual(result.spec, raw)
})

test('digit leaks in NumberSentence templates reject the whole spec', () => {
  const leaks = [
    `{entity:${A}} 净利率 45.0%`,
    `{value:${A}@2025}，高出 ３ 个百分点`,
    `{value:${A}@2025}，增长三成`,
    `{value:${A}@2025}，约为对手的两倍`,
    `{value:${A}@2025}，营收二十亿`,
    `{value:${A}@2025}，百分之五`,
    `{value:${A}@2025}，排名第①`,
    `{value:${A}@2025}，营收 2024 亿元`,
    `{value:${A}@20251}`,
    `{value:${A}@2025} 提升 {delta:${A}@2025}%`,
    `{value:${A}@2025}，营收达 2000`,
    `{value:${A}@2025}，约 2000 美元`,
    `{value:${A}@2025}，股价 2025港元`,
    `{value:${A}@2025}，预计 2031 年翻倍`,
    `{value:${A}@2025}，2022–2025 年持续`,
    `{value:${A}@2025}，领先三家同行`,
    `{value:${A}@2025}，十二家公司里最高`,
    `{value:${A}@2025}，近三年最高`,
    `{value:${A}@2025}，上百家公司`,
    `{value:${A}@2025}，数千亿规模`,
    `{value:${A}@2025}，约一半`,
    `{value:${A}@2025}，过半`,
    `{value:${A}@2025}，排名十二`,
    `{value:${A}@2025}，利润翻番`,
    `{value:${A}@2025}，增长一番`,
  ]
  for (const template of leaks) {
    const result = parseResearchUiSpec({ version: 1, blocks: [{ component: 'NumberSentence', datasetId: DS, template }] }, known)
    assert.equal(result.ok, false, template)
  }
})

test('unknown ids, periods, fields and bad shapes reject', () => {
  const blocks = [
    { component: 'NumberSentence', datasetId: DS, template: '{value:CN:SH.000001@2025}' },
    { component: 'NumberSentence', datasetId: DS, template: `{value:${A}@2019}` },
    { component: 'NumberSentence', datasetId: DS, template: `{delta:${A}@2023}` },
    { component: 'NumberSentence', datasetId: DS, template: `{gap:${A}@${A}@2025}` },
    { component: 'NumberSentence', datasetId: DS, template: `{entity:${A}} 表现稳定` },
    { component: 'NumberSentence', datasetId: DS, template: `{price:${A}@2025}` },
    { component: 'NumberSentence', datasetId: DS, template: `{value:${A}@2025}${'很'.repeat(120)}` },
    { component: 'NumberSentence', datasetId: 'research-ds-unknown', template: '{largestChange}' },
    { component: 'NumberSentence', datasetId: DS, template: '{largestChange}', title: '结论' },
    { component: 'NumberSentence', datasetId: DS, template: '{largestChange}', actions: ['pin'] },
    { component: 'KpiRow', datasetId: DS, period: '2019' },
    { component: 'KpiRow', datasetId: DS, period: 2025 },
    { component: 'KpiRow', datasetId: DS, actions: ['pin'] },
    { component: 'KpiRow', datasetId: DS, value: 45 },
    { component: 'KpiRow', datasetId: 'research-ds-unknown' },
  ]
  for (const block of blocks) {
    const result = parseResearchUiSpec({ version: 1, blocks: [block] }, known)
    assert.equal(result.ok, false, JSON.stringify(block))
  }
})

test('years in context and non-quantity CJK words are allowed', () => {
  const ok = [
    `2023–2025 年 {entity:${A}} 净利率与行业一致，{value:${A}@2025}`,
    `{entity:${A}} 2024-2025 年进一步提升，{delta:${A}@2025}，唯一领先`,
    `{entity:${A}} 是半导体龙头，2025 年度 {value:${A}@2025}，第一`,
  ]
  for (const template of ok) {
    const result = parseResearchUiSpec({ version: 1, blocks: [{ component: 'NumberSentence', datasetId: DS, template }] }, known)
    assert.equal(result.ok, true, `${template} ${JSON.stringify(result.errors)}`)
  }
})
