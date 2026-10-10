import { describe, expect, it } from 'vitest'
import type { ChatToolStep } from '../../types/chatProgress'
import type { Dataset } from '../research-canvas/types'
import {
  buildTraceSummary,
  formatMissingLabel,
  formatYearRange,
  listMissingPoints,
  readableMetricLabel,
} from './progressSummary'

function step(partial: Partial<ChatToolStep> & Pick<ChatToolStep, 'tool'>): ChatToolStep {
  return { id: 's1', label: '查询', status: 'done', startedAt: '2026-10-09T00:00:00.000Z', ...partial }
}

const DS_ID = 'research-ds-11111111-1111-4111-8111-111111111111'

function dataset(values: Array<number | null>): Dataset {
  const periods = ['2019', '2020']
  const entities = [
    { id: 'a', name: '公司甲', ticker: '000001', market: 'CN' as const, type: 'equity' as const },
    { id: 'b', name: '公司乙', ticker: '000002', market: 'CN' as const, type: 'equity' as const },
  ]
  const data = entities.flatMap((entity, ei) => periods.map((period, pi) => ({
    entityId: entity.id, period, value: values[ei * 2 + pi] ?? null,
  })))
  return { id: DS_ID, title: 'ROE', metric: 'roe', unit: '%', entities, periods, data, sources: [] }
}

const queryStep = step({
  tool: 'query_data',
  argsDetail: JSON.stringify({ entities: ['公司甲', '公司乙'], metric: 'roe', start: '2019', end: '2020' }),
  resultDetail: JSON.stringify({
    ok: true, datasetId: DS_ID, metric: 'roe',
    coverage: { filled: 3, total: 4 },
    series: [{ name: '公司甲' }, { name: '公司乙' }],
  }),
})

describe('buildTraceSummary', () => {
  it('uses the stored dataset for tags and names the missing point', () => {
    const ds = dataset([1, 2, null, 4])
    const summary = buildTraceSummary([queryStep], id => (id === DS_ID ? ds : undefined))
    expect(summary.tags).toEqual(['公司甲', '公司乙', '净资产收益率 2019–2020'])
    expect(summary.missing).toBe('公司乙 2019 无数据')
  })

  it('falls back to step result when the dataset is not stored locally', () => {
    const summary = buildTraceSummary([queryStep])
    expect(summary.tags).toEqual(['公司甲', '公司乙', '净资产收益率 2019–2020'])
    expect(summary.missing).toBe('缺 1 项数据')
  })

  it('returns no tags for non-research or unfinished steps', () => {
    const summary = buildTraceSummary([
      step({ tool: 'web_search' }),
      { ...queryStep, status: 'running' },
      step({ tool: 'query_data', resultDetail: JSON.stringify({ ok: false, error: 'x' }) }),
    ])
    expect(summary).toEqual({ tags: [], missing: null })
  })

  it('never infers a reporting-basis tag from period format', () => {
    const summary = buildTraceSummary([queryStep])
    expect(summary.tags.some(tag => tag.includes('口径'))).toBe(false)
  })

  it('omits unknown metric ids for kline', () => {
    const kline = step({
      tool: 'query_data',
      argsDetail: JSON.stringify({ entities: ['公司甲'], metric: 'kline', start: '2024-01-01', end: '2024-06-30' }),
      resultDetail: JSON.stringify({ ok: true, datasetId: DS_ID, metric: 'kline', series: [{ name: '公司甲' }] }),
    })
    expect(buildTraceSummary([kline]).tags).toEqual(['公司甲', '日K 2024-01-01–2024-06-30'])
    expect(readableMetricLabel('some_internal_id')).toBe('')
  })
})

describe('helpers', () => {
  it('lists missing points without inventing values', () => {
    expect(listMissingPoints(dataset([1, 2, 3, 4]))).toEqual([])
    expect(listMissingPoints(dataset([null, 2, 3, null]))).toEqual(['公司甲 2019', '公司乙 2020'])
  })

  it('formats missing labels', () => {
    expect(formatMissingLabel([], 0)).toBeNull()
    expect(formatMissingLabel(['公司乙 2019'], 1)).toBe('公司乙 2019 无数据')
    expect(formatMissingLabel(['a', 'b', 'c'], 3)).toBe('缺 3 项数据')
  })

  it('formats year ranges', () => {
    expect(formatYearRange('2019', '2024')).toBe('2019–2024')
    expect(formatYearRange('2024', '2024')).toBe('2024')
    expect(formatYearRange('', '')).toBe('')
  })
})
