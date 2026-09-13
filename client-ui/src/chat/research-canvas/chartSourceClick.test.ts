import { describe, expect, it } from 'vitest'
import type { CallbackDataParams } from 'echarts/types/dist/shared'
import {
  resolvePieChartCell,
  resolveStackedBarCell,
} from './chartSourceClick'
import { MOCK_GROSS_MARGIN_DATASET } from './mockGrossMarginDataset'
import { buildPieChartView, buildStackedBarView } from './views'

function seriesParams(partial: Partial<CallbackDataParams>): CallbackDataParams {
  return {
    componentType: 'series',
    seriesIndex: 0,
    dataIndex: 0,
    ...partial,
  } as CallbackDataParams
}

describe('chartSourceClick', () => {
  it('maps stacked bars to entity and period', () => {
    const view = buildStackedBarView(MOCK_GROSS_MARGIN_DATASET, false)
    expect(resolveStackedBarCell(view, seriesParams({ seriesIndex: 2, dataIndex: 3 }))).toEqual({
      entityId: 'legacy-sentury',
      period: '2024',
    })
    expect(resolveStackedBarCell(view, seriesParams({ componentType: 'xAxis' }))).toBeNull()
  })

  it('maps pie slices to the ranked company and selected year', () => {
    const view = buildPieChartView(MOCK_GROSS_MARGIN_DATASET)
    expect(view.slices[0]?.entityId).toBe('legacy-sentury')
    expect(resolvePieChartCell(view, seriesParams({ dataIndex: 0 }))).toEqual({
      entityId: 'legacy-sentury',
      period: '2025',
    })
  })
})
