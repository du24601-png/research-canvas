import { datasetShape, LINE_SERIES_READABLE_MAX } from '@opptrix/shared/research-view-recommendation'
import type { Dataset, ResearchEntity } from './types'

function entityName(dataset: Dataset, entity: ResearchEntity): string {
  return entity.name
}

function pointValue(dataset: Dataset, entityId: string, period: string): number | null {
  const point = dataset.data.find(item => item.entityId === entityId && item.period === period)
  if (!point || point.value == null) return null
  return point.value
}

export interface LineSeriesView {
  entityId: string
  name: string
  ticker: string
  values: Array<number | null>
  dim?: boolean
}

export interface LineChartView {
  periods: string[]
  series: LineSeriesView[]
  unit: string
}

export interface BarChartView {
  period: string
  categories: string[]
  tickers: string[]
  entityIds: string[]
  values: Array<number | null>
  /** 该期没有数据、未画进柱子的公司 */
  omitted: string[]
  unit: string
}

export interface TableChartView {
  headers: string[]
  rows: string[][]
  unit: string
}

export interface StackedBarView {
  periods: string[]
  series: LineSeriesView[]
  unit: string
  percent: boolean
}

export interface PieSliceView {
  name: string
  ticker: string
  value: number
}

export interface HeatmapChartView {
  periods: string[]
  categories: string[]
  tickers: string[]
  cells: Array<[number, number, number | null]>
  min: number
  max: number
  unit: string
}

export interface PieChartView {
  period: string
  slices: PieSliceView[]
  unit: string
}

export interface ComboChartView {
  periods: string[]
  bars: LineSeriesView[]
  line: LineSeriesView
  unit: string
}

export interface CandlestickView {
  name: string
  ticker: string
  times: string[]
  candles: Array<[number, number, number, number]>
  volumes: Array<number | null>
}

export function buildStackedBarView(dataset: Dataset, percent: boolean): StackedBarView {
  const line = buildLineChartView(dataset)
  if (!percent) return { ...line, percent: false }
  const series = line.series.map(item => ({
    ...item,
    values: item.values.map((value, index) => percentAtColumn(line.series, index, value)),
  }))
  return { periods: line.periods, series, unit: '%', percent: true }
}

export function buildGroupedBarView(dataset: Dataset): StackedBarView {
  return buildStackedBarView(dataset, false)
}

function percentAtColumn(
  series: LineSeriesView[],
  index: number,
  value: number | null,
): number | null {
  if (value == null) return null
  const total = series
    .map(item => item.values[index])
    .filter((item): item is number => item != null && item > 0)
    .reduce((sum, item) => sum + item, 0)
  if (total <= 0) return null
  return (Math.max(value, 0) / total) * 100
}

export function buildPieChartView(dataset: Dataset, period?: string): PieChartView {
  const bar = buildBarChartView(dataset, period)
  const slices = bar.categories
    .map((name, index) => ({
      name,
      ticker: bar.tickers[index] ?? '',
      value: bar.values[index],
    }))
    .filter((row): row is PieSliceView => row.value != null && row.value > 0)
  return { period: bar.period, slices, unit: bar.unit }
}

export function buildComboChartView(dataset: Dataset): ComboChartView {
  const line = buildLineChartView(dataset)
  const averages = line.periods.map((_, index) => averageAt(line.series, index))
  return {
    periods: line.periods,
    bars: line.series,
    line: { entityId: 'combo-mean', name: '均值', ticker: '', values: averages },
    unit: line.unit,
  }
}

function averageAt(series: LineSeriesView[], index: number): number | null {
  const values = series.map(item => item.values[index]).filter((value): value is number => value != null)
  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function buildCandlestickView(dataset: Dataset): CandlestickView | null {
  const entity = dataset.entities[0]
  if (!entity) return null
  const bars = (dataset.ohlc ?? [])
    .filter(bar => bar.entityId === entity.id)
    .sort((left, right) => left.time.localeCompare(right.time))
  if (!bars.length) return null
  return {
    name: entity.name,
    ticker: entity.ticker,
    times: bars.map(bar => bar.time),
    candles: bars.map(bar => [bar.open, bar.close, bar.low, bar.high]),
    volumes: bars.map(bar => bar.volume ?? null),
  }
}

export function buildLineChartView(dataset: Dataset, topN?: number): LineChartView {
  const series = dataset.entities.map(entity => ({
    entityId: entity.id,
    name: entityName(dataset, entity),
    ticker: entity.ticker,
    values: dataset.periods.map(period => pointValue(dataset, entity.id, period)),
  }))
  return {
    periods: [...dataset.periods],
    series: dimLineSeries(dataset, series, topN),
    unit: dataset.unit,
  }
}

function dimLineSeries(
  dataset: Dataset,
  series: LineSeriesView[],
  topN?: number,
): LineSeriesView[] {
  const limit = topN ?? (series.length > LINE_SERIES_READABLE_MAX ? LINE_SERIES_READABLE_MAX : 0)
  if (!limit || series.length <= limit) return series
  const period = defaultCrossSectionPeriod(dataset)
  const index = dataset.periods.indexOf(period)
  const ranked = series
    .map((item, seriesIndex) => ({ seriesIndex, value: item.values[index] ?? Number.NEGATIVE_INFINITY }))
    .sort((left, right) => right.value - left.value)
  const keep = new Set(ranked.slice(0, limit).map(item => item.seriesIndex))
  return series.map((item, seriesIndex) => (keep.has(seriesIndex) ? item : { ...item, dim: true }))
}

export function buildHeatmapView(dataset: Dataset): HeatmapChartView {
  const categories = dataset.entities.map(entity => entityName(dataset, entity))
  const cells: Array<[number, number, number | null]> = []
  const numeric: number[] = []
  dataset.entities.forEach((entity, y) => {
    dataset.periods.forEach((period, x) => {
      const value = pointValue(dataset, entity.id, period)
      cells.push([x, y, value])
      if (value != null) numeric.push(value)
    })
  })
  return {
    periods: [...dataset.periods],
    categories,
    tickers: dataset.entities.map(entity => entity.ticker),
    cells,
    min: numeric.length ? Math.min(...numeric) : 0,
    max: numeric.length ? Math.max(...numeric) : 0,
    unit: dataset.unit,
  }
}

/** 截面图默认期：最近一个覆盖足够完整的年份，而不是简单取最后一年 */
export function defaultCrossSectionPeriod(dataset: Dataset): string {
  return datasetShape(dataset).latestCompletePeriod
    ?? dataset.periods[dataset.periods.length - 1]
    ?? ''
}

export function buildBarChartView(dataset: Dataset, period?: string): BarChartView {
  const targetPeriod = period ?? defaultCrossSectionPeriod(dataset)
  const numbered = dataset.entities
    .map(entity => ({
      entityId: entity.id,
      entity: entityName(dataset, entity),
      ticker: entity.ticker,
      value: pointValue(dataset, entity.id, targetPeriod),
    }))
  const ranked = numbered
    .filter(row => row.value != null)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
  const omitted = numbered.filter(row => row.value == null).map(row => row.entity)
  return {
    period: targetPeriod,
    categories: ranked.map(row => row.entity),
    tickers: ranked.map(row => row.ticker),
    entityIds: ranked.map(row => row.entityId),
    values: ranked.map(row => row.value),
    omitted,
    unit: dataset.unit,
  }
}

export function buildTableView(dataset: Dataset): TableChartView {
  const headers = ['公司', ...dataset.periods]
  const rows = dataset.entities.map(entity => [
    entityName(dataset, entity),
    ...dataset.periods.map(period => {
      const value = pointValue(dataset, entity.id, period)
      return value != null ? `${value.toFixed(1)}${dataset.unit}` : '—'
    }),
  ])
  return {
    headers,
    rows,
    unit: dataset.unit,
  }
}
