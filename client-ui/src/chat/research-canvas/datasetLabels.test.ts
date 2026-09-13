import { describe, expect, it } from 'vitest'
import { coverageLabel, datasetMetaLine, sourceLabel } from './datasetLabels'
import type { Dataset } from './types'

function sampleDataset(): Dataset {
  return {
    id: 'research-ds-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    title: 'ROE',
    metric: 'roe',
    unit: '%',
    entities: [{
      id: 'CN:SH.601398',
      name: '工商银行',
      ticker: '601398.SH',
      market: 'CN',
      type: 'equity',
    }],
    periods: ['2024', '2025'],
    data: [
      { entityId: 'CN:SH.601398', period: '2024', value: 10 },
      { entityId: 'CN:SH.601398', period: '2025', value: null },
    ],
    sources: [{
      provider: 'tushare',
      entityId: 'CN:SH.601398',
      metric: 'roe',
      period: '2024',
      fetchedAt: '2026-09-12T00:00:00.000Z',
    }],
  }
}

describe('datasetLabels', () => {
  it('builds source and coverage labels', () => {
    const dataset = sampleDataset()
    expect(sourceLabel(dataset)).toBe('上市公司财报')
    expect(coverageLabel(dataset)).toBe('部分数据缺失（1/2）')
    expect(datasetMetaLine(dataset)).toBe('2024–2025 · % · 部分数据缺失（1/2）')
  })
})
