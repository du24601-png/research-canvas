/**
 * 静态 Spec 夹具（M3，未接 Agent）。数值是合成的示意数据，不是任何公司的真实财报。
 * 同比变化数据集由 shared 的 yoyDeltaDataset 计算，不手写差值。
 */
import { yoyDeltaDataset } from '@opptrix/shared/research-dataset-delta'
import type { Dataset } from '../chat/research-canvas/types'

const A = { id: 'CN:SH.600519', name: '示例公司甲', ticker: '600519.SH', market: 'CN' as const, type: 'equity' as const }
const B = { id: 'CN:SZ.000858', name: '示例公司乙', ticker: '000858.SZ', market: 'CN' as const, type: 'equity' as const }
const PERIODS = ['2021', '2022', '2023', '2024', '2025']
const FETCHED = '2026-10-09T08:00:00.000Z'

function build(id: string, metric: string, values: Record<string, Array<number | null>>, provider = 'tushare'): Dataset {
  const data = [A, B].flatMap(entity => PERIODS.map((period, i) => ({ entityId: entity.id, period, value: values[entity.id]?.[i] ?? null })))
  const sources = data
    .filter(point => point.value != null)
    .map(point => ({ provider, entityId: point.entityId, metric, period: point.period, fetchedAt: FETCHED }))
  return { id, title: `示例公司甲、示例公司乙 ${metric}`, metric, unit: '%', entities: [A, B], periods: PERIODS, data, sources }
}

export const NET_MARGIN = build('research-ds-11111111-1111-4111-8111-111111111111', 'net_margin', {
  [A.id]: [40.2, 41.5, 42.9, 44.1, 45.0],
  [B.id]: [30.1, 31.8, 33.5, 35.2, 31.0],
})

export const ROE = build('research-ds-22222222-2222-4222-8222-222222222222', 'roe', {
  [A.id]: [28.4, 27.1, 29.6, 31.2, 32.0],
  [B.id]: [null, 23.5, 25.1, 24.0, 20.3],
})

function deltaOf(parent: Dataset, id: string): Dataset {
  const body = yoyDeltaDataset(parent)
  if ('error' in body) throw new Error(body.error)
  return { ...body, id, parentDatasetId: parent.id, transform: { type: 'yoy_delta' } }
}

export const NET_MARGIN_DELTA = deltaOf(NET_MARGIN, 'research-ds-33333333-3333-4333-8333-333333333333')

export const FIXTURE_DATASETS: readonly Dataset[] = [NET_MARGIN, ROE, NET_MARGIN_DELTA]

/** Demo A：指标对比 + 趋势（可高亮变化最大的年份）+ 来源 */
export const SPEC_DEMO_A = {
  version: 1,
  blocks: [
    { component: 'ComparisonView', datasetIds: [NET_MARGIN.id, ROE.id], actions: ['pin', 'open_sources'] },
    { component: 'TrendView', datasetId: NET_MARGIN.id, deltaDatasetId: NET_MARGIN_DELTA.id, actions: ['highlight_largest_change', 'pin'] },
    { component: 'EvidencePanel', datasetIds: [NET_MARGIN.id, ROE.id] },
  ],
}

/** Demo C：缺数如实标出 */
export const SPEC_DEMO_C = {
  version: 1,
  blocks: [
    { component: 'MissingData', datasetId: ROE.id },
    { component: 'EvidencePanel', datasetIds: [ROE.id] },
  ],
}

/** Demo D：一句带引用的结论 + 关键数字（数字全部由代码从 NET_MARGIN 取/算） */
export const SPEC_DEMO_TEXT = {
  version: 1,
  blocks: [
    { component: 'NumberSentence', datasetId: NET_MARGIN.id, template: `{entity:${A.id}} 2025 年净利率 {value:${A.id}@2025}，较上年 {delta:${A.id}@2025}，比 {entity:${B.id}} 高 {gap:${A.id}@${B.id}@2025}。` },
    { component: 'KpiRow', datasetId: NET_MARGIN.id },
  ],
}

/** 必须整份拒绝的 Spec */
export const INVALID_SPECS: Record<string, unknown> = {
  unknownComponent: { version: 1, blocks: [{ component: 'PieOfDoom', datasetIds: [NET_MARGIN.id] }] },
  unknownDataset: { version: 1, blocks: [{ component: 'TrendView', datasetId: 'research-ds-99999999-9999-4999-8999-999999999999' }] },
  unknownAction: { version: 1, blocks: [{ component: 'ComparisonView', datasetIds: [NET_MARGIN.id], actions: ['auto_pin'] }] },
  numberInTitle: { version: 1, blocks: [{ component: 'TrendView', datasetId: NET_MARGIN.id, title: '净利率 45% 创新高' }] },
  valueField: { version: 1, blocks: [{ component: 'TrendView', datasetId: NET_MARGIN.id, value: 45 }] },
  wrongDelta: { version: 1, blocks: [{ component: 'TrendView', datasetId: ROE.id, deltaDatasetId: NET_MARGIN_DELTA.id }] },
  digitInSentence: { version: 1, blocks: [{ component: 'NumberSentence', datasetId: NET_MARGIN.id, template: `{entity:${A.id}} 净利率 45%` }] },
  unknownEntityInSentence: { version: 1, blocks: [{ component: 'NumberSentence', datasetId: NET_MARGIN.id, template: '{value:CN:SH.000001@2025}' }] },
  kpiUnknownPeriod: { version: 1, blocks: [{ component: 'KpiRow', datasetId: NET_MARGIN.id, period: '2019' }] },
  partlyBad: { version: 1, blocks: [{ component: 'EvidencePanel', datasetIds: [NET_MARGIN.id] }, { component: 'Nope' }] },
}
