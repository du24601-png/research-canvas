import type { CallbackDataParams } from 'echarts/types/dist/shared'
import { isSeriesVisible } from './chartStyleApply'
import type { ChartStyle } from '@opptrix/shared/research-chart-style'
import type {
  BarChartView,
  CandlestickView,
  ComboChartView,
  HeatmapChartView,
  LineChartView,
  PieChartView,
  StackedBarView,
} from './views'
import type { ResearchCellRef } from './sourceLookup'
import type { Dataset } from './types'

export function resolveLineChartCell(
  view: LineChartView,
  style: ChartStyle | undefined,
  params: CallbackDataParams,
): ResearchCellRef | null {
  if (params.componentType !== 'series') return null
  if (typeof params.seriesIndex !== 'number' || typeof params.dataIndex !== 'number') return null
  const visibleSeries = view.series.filter(item => isSeriesVisible(item.entityId, style))
  const series = visibleSeries[params.seriesIndex]
  const period = view.periods[params.dataIndex]
  if (!series || !period) return null
  return { entityId: series.entityId, period }
}

export function resolveBarChartCell(
  view: BarChartView,
  params: CallbackDataParams,
): ResearchCellRef | null {
  if (params.componentType !== 'series') return null
  if (typeof params.dataIndex !== 'number') return null
  const entityId = view.entityIds[params.dataIndex]
  if (!entityId) return null
  return { entityId, period: view.period }
}

export function resolveHeatmapCell(
  dataset: Dataset,
  view: HeatmapChartView,
  params: CallbackDataParams,
): ResearchCellRef | null {
  if (params.componentType !== 'series') return null
  const raw = params.data
  if (!Array.isArray(raw) || raw.length < 2) return null
  const x = raw[0]
  const y = raw[1]
  if (typeof x !== 'number' || typeof y !== 'number') return null
  const period = view.periods[x]
  const entity = dataset.entities[y]
  if (!period || !entity) return null
  return { entityId: entity.id, period }
}

export function resolveGroupedBarCell(
  dataset: Dataset,
  periods: readonly string[],
  visibleEntityIds: readonly string[],
  params: CallbackDataParams,
): ResearchCellRef | null {
  if (params.componentType !== 'series') return null
  if (typeof params.seriesIndex !== 'number' || typeof params.dataIndex !== 'number') return null
  const entityId = visibleEntityIds[params.seriesIndex]
  const period = periods[params.dataIndex]
  if (!entityId || !period) return null
  return { entityId, period }
}

export function resolveStackedBarCell(
  view: StackedBarView,
  params: CallbackDataParams,
): ResearchCellRef | null {
  if (params.componentType !== 'series') return null
  if (typeof params.seriesIndex !== 'number' || typeof params.dataIndex !== 'number') return null
  const entityId = view.series[params.seriesIndex]?.entityId
  const period = view.periods[params.dataIndex]
  if (!entityId || !period) return null
  return { entityId, period }
}

export function resolvePieChartCell(
  view: PieChartView,
  params: CallbackDataParams,
): ResearchCellRef | null {
  if (params.componentType !== 'series') return null
  if (typeof params.dataIndex !== 'number') return null
  const slice = view.slices[params.dataIndex]
  if (!slice?.entityId) return null
  return { entityId: slice.entityId, period: view.period }
}

export function resolveComboBarLineCell(
  view: ComboChartView,
  params: CallbackDataParams,
): ResearchCellRef | null {
  if (params.componentType !== 'series') return null
  if (typeof params.seriesIndex !== 'number' || typeof params.dataIndex !== 'number') return null
  const barCount = view.bars.length
  if (params.seriesIndex >= barCount) return null
  const entityId = view.bars[params.seriesIndex]?.entityId
  const period = view.periods[params.dataIndex]
  if (!entityId || !period) return null
  return { entityId, period }
}

export function resolveCandlestickCell(
  dataset: Dataset,
  view: CandlestickView,
  params: CallbackDataParams,
): ResearchCellRef | null {
  if (params.componentType !== 'series') return null
  if (typeof params.dataIndex !== 'number') return null
  const entity = dataset.entities[0]
  const time = view.times[params.dataIndex]
  if (!entity || !time) return null
  return { entityId: entity.id, period: time }
}
