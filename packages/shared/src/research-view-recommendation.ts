/**
 * Research Canvas view recommendation — code inspects intent × shape × metric kind
 * and returns ranked candidates. The model still decides; this informs / warns / titles.
 */
import type { ResearchCanvasWidgetType } from './research-canvas-protocol.js'
import { isKlineMetricId, researchMetricKind } from './research-metrics.js'
import {
  isResearchViewIntent,
  type ResearchViewIntent,
  type ResearchWidgetViewParams,
} from './research-view-params.js'

export interface DatasetShapeInput {
  metric: string
  unit?: string
  entities: ReadonlyArray<{ id: string; name?: string }>
  periods: ReadonlyArray<string>
  data: ReadonlyArray<{ entityId: string; period: string; value: number | null }>
  ohlc?: ReadonlyArray<unknown>
}

export interface PeriodCoverage {
  period: string
  filled: number
}

export interface DatasetShape {
  entities: number
  periods: number
  filled: number
  total: number
  byPeriod: PeriodCoverage[]
  latestCompletePeriod: string | null
  kline: boolean
}

export interface ResearchViewCandidate {
  type: ResearchCanvasWidgetType
  params: ResearchWidgetViewParams
  fit: number
  label: string
  reason: string
}

export interface WidgetViewRecommendation {
  recommended: ResearchCanvasWidgetType
  period?: string
  alternatives: ResearchCanvasWidgetType[]
  reason: string
}

export const LINE_SERIES_READABLE_MAX = 6
export const GROUPED_BAR_READABLE_MAX = 8
const COMPLETE_RATIO = 0.6

function coverageByPeriod(dataset: DatasetShapeInput): PeriodCoverage[] {
  const entityIds = new Set(dataset.entities.map(entity => entity.id))
  const filled = new Map<string, number>()
  for (const point of dataset.data) {
    if (point.value == null || !entityIds.has(point.entityId)) continue
    filled.set(point.period, (filled.get(point.period) ?? 0) + 1)
  }
  return dataset.periods.map(period => ({ period, filled: filled.get(period) ?? 0 }))
}

function pickLatestCompletePeriod(byPeriod: PeriodCoverage[], entities: number): string | null {
  if (!byPeriod.length || entities <= 0) return null
  const threshold = Math.max(1, Math.ceil(entities * COMPLETE_RATIO))
  for (let index = byPeriod.length - 1; index >= 0; index -= 1) {
    const item = byPeriod[index]
    if (item && item.filled >= threshold) return item.period
  }
  let best: PeriodCoverage | null = null
  for (const item of byPeriod) {
    if (!best || item.filled >= best.filled) best = item
  }
  return best && best.filled > 0 ? best.period : null
}

export function datasetShape(dataset: DatasetShapeInput): DatasetShape {
  const byPeriod = coverageByPeriod(dataset)
  const entities = dataset.entities.length
  const filled = byPeriod.reduce((sum, item) => sum + item.filled, 0)
  return {
    entities,
    periods: dataset.periods.length,
    filled,
    total: entities * dataset.periods.length,
    byPeriod,
    latestCompletePeriod: pickLatestCompletePeriod(byPeriod, entities),
    kline: isKlineMetricId(dataset.metric) || Boolean(dataset.ohlc?.length),
  }
}

function periodLabel(shape: DatasetShape): string {
  return shape.latestCompletePeriod ?? shape.byPeriod[shape.byPeriod.length - 1]?.period ?? ''
}

function candidate(
  type: ResearchCanvasWidgetType,
  label: string,
  fit: number,
  reason: string,
  params: ResearchWidgetViewParams = {},
): ResearchViewCandidate {
  return { type, params, fit, label, reason }
}

function forPrice(): ResearchViewCandidate[] {
  return [
    candidate('candlestick', 'K线', 1, '日 K 数据用蜡烛图'),
    candidate('line_chart', '折线', 0.4, '收盘价走势备选'),
  ]
}

function forRank(shape: DatasetShape): ResearchViewCandidate[] {
  const period = periodLabel(shape)
  const list = [
    candidate('bar_chart', '排名', 1, `按 ${period} 横向对比`, { period }),
    candidate('table', '表格', 0.55, '看全部年份数字'),
  ]
  if (shape.periods > 1) {
    list.splice(1, 0, candidate('heatmap_table', '热力', 0.7, '公司 × 年份对照面板'))
    if (shape.entities >= 2 && shape.entities <= GROUPED_BAR_READABLE_MAX) {
      list.splice(1, 0, candidate('grouped_bar', '分组柱', 0.62, '横轴年份，每年并排对比'))
    }
  }
  return list
}

function forTrend(shape: DatasetShape): ResearchViewCandidate[] {
  const many = shape.entities > LINE_SERIES_READABLE_MAX
  const topN = many ? LINE_SERIES_READABLE_MAX : undefined
  const lineReason = many
    ? `${shape.entities} 家超过折线可读上限，高亮前 ${LINE_SERIES_READABLE_MAX} 家`
    : `${shape.entities} 家 × ${shape.periods} 期，横轴年份看趋势`
  return [
    candidate('line_chart', '折线', many ? 0.72 : 1, lineReason, topN ? { topN } : {}),
    ...(shape.periods > 1 && shape.entities > 1 && shape.entities <= GROUPED_BAR_READABLE_MAX
      ? [candidate('grouped_bar', '分组柱', many ? 0.5 : 0.78, '横轴年份，每年并排对比')]
      : []),
    ...(shape.periods > 1 && shape.entities > 1
      ? [candidate('heatmap_table', '热力', many ? 0.9 : 0.55, '公司 × 年份对照面板')]
      : []),
    candidate('bar_chart', '排名', 0.5, `按 ${periodLabel(shape)} 一期横向对比`, {
      period: periodLabel(shape),
    }),
    candidate('table', '表格', 0.45, '看全部数字'),
  ]
}

function forCompare(shape: DatasetShape): ResearchViewCandidate[] {
  if (shape.periods <= 1) return forRank(shape)
  const period = periodLabel(shape)
  const canGroup = shape.entities >= 2 && shape.entities <= GROUPED_BAR_READABLE_MAX
  return [
    ...(canGroup
      ? [candidate('grouped_bar', '分组柱', 1, `横轴年份，每年 ${shape.entities} 根柱并排对比`)]
      : []),
    candidate(
      'heatmap_table',
      '热力',
      canGroup ? 0.72 : 1,
      `${shape.entities} 家 × ${shape.periods} 期，热力表同时看排名和变化`,
    ),
    candidate('bar_chart', '排名', 0.7, `按 ${period} 横向排名`, { period }),
    candidate('line_chart', '折线', 0.45, `高亮前 ${LINE_SERIES_READABLE_MAX} 家看走势`, {
      topN: LINE_SERIES_READABLE_MAX,
    }),
    candidate('table', '表格', 0.5, '看全部数字'),
  ]
}

function forComposition(shape: DatasetShape, kind: string): ResearchViewCandidate[] {
  const period = periodLabel(shape)
  if (kind === 'share') {
    return [
      candidate('stacked_bar_percent', '堆积', 1, '份额随时间变化'),
      candidate('pie_chart', '饼图', shape.entities <= 6 ? 0.8 : 0.4, `按 ${period} 构成`, { period }),
      candidate('table', '表格', 0.4, '看全部数字'),
    ]
  }
  return forRank(shape)
}

export function inferViewIntent(dataset: DatasetShapeInput): ResearchViewIntent {
  const shape = datasetShape(dataset)
  if (shape.kline) return 'price'
  if (shape.periods <= 1) return 'rank'
  if (shape.entities > LINE_SERIES_READABLE_MAX) return 'compare'
  return 'trend'
}

export function recommendViews(
  dataset: DatasetShapeInput,
  intent?: ResearchViewIntent | string,
): ResearchViewCandidate[] {
  const shape = datasetShape(dataset)
  const resolved = isResearchViewIntent(intent) ? intent : inferViewIntent(dataset)
  if (shape.kline || resolved === 'price') return forPrice()
  if (resolved === 'rank') return forRank(shape)
  if (resolved === 'composition') return forComposition(shape, researchMetricKind(dataset.metric))
  if (resolved === 'compare') return forCompare(shape)
  return forTrend(shape)
}

export function pickRecommendedView(
  dataset: DatasetShapeInput,
  intent?: ResearchViewIntent | string,
): ResearchViewCandidate {
  const [first, ...rest] = recommendViews(dataset, intent)
  return first ?? rest[0] ?? candidate('table', '表格', 0.2, '没有合适的图种，用表格')
}

export function recommendWidgetView(dataset: DatasetShapeInput): WidgetViewRecommendation {
  const picked = pickRecommendedView(dataset)
  const alternatives = recommendViews(dataset)
    .filter(item => item.type !== picked.type)
    .map(item => item.type)
  return {
    recommended: picked.type,
    ...(picked.params.period ? { period: picked.params.period } : {}),
    alternatives,
    reason: picked.reason,
  }
}

export function switcherViews(dataset: DatasetShapeInput): ResearchViewCandidate[] {
  const seen = new Set<ResearchCanvasWidgetType>()
  const merged: ResearchViewCandidate[] = []
  for (const intent of ['compare', 'trend', 'rank'] as const) {
    for (const item of recommendViews(dataset, intent)) {
      if (seen.has(item.type)) continue
      if (item.type === 'candlestick' || item.type === 'sources') continue
      seen.add(item.type)
      merged.push(item)
    }
  }
  return merged
}

const CROSS_SECTION_TYPES = new Set<ResearchCanvasWidgetType>(['bar_chart', 'pie_chart', 'donut_chart'])
const TIME_SERIES_TYPES = new Set<ResearchCanvasWidgetType>([
  'line_chart', 'grouped_bar', 'stacked_bar', 'stacked_bar_percent', 'combo_bar_line',
])

export function widgetTypeShapeWarning(
  type: ResearchCanvasWidgetType,
  dataset: DatasetShapeInput,
): string | null {
  const shape = datasetShape(dataset)
  const kind = researchMetricKind(dataset.metric)
  if (type === 'candlestick' && !shape.kline) return '该数据集不是日 K，蜡烛图无法显示；请改用 line_chart 或 bar_chart'
  if (shape.kline && type !== 'candlestick' && type !== 'line_chart' && type !== 'table') {
    return '日 K 数据请用 candlestick'
  }
  if ((type === 'pie_chart' || type === 'donut_chart' || type === 'stacked_bar' || type === 'stacked_bar_percent')
    && (kind === 'ratio' || kind === 'growth' || dataset.unit === '%')) {
    return '比例或增速类指标不构成整体，不适合饼图 / 堆积；建议 bar_chart 或 heatmap_table'
  }
  if (TIME_SERIES_TYPES.has(type) && shape.periods <= 1) {
    return `只有 ${periodLabel(shape)} 一期，${type} 没有时间轴可画；建议 bar_chart`
  }
  if (type === 'line_chart' && shape.entities > LINE_SERIES_READABLE_MAX) {
    return `${shape.entities} 条折线可读性差；将高亮前 ${LINE_SERIES_READABLE_MAX} 家。面板对照用 heatmap_table`
  }
  if (type === 'grouped_bar' && shape.entities > GROUPED_BAR_READABLE_MAX) {
    return `${shape.entities} 家并排柱过密；建议 heatmap_table 或只保留前 ${GROUPED_BAR_READABLE_MAX} 家`
  }
  if (CROSS_SECTION_TYPES.has(type) && shape.periods > 1) {
    return crossSectionNote(shape)
  }
  return null
}

function crossSectionNote(shape: DatasetShape): string {
  const last = shape.byPeriod[shape.byPeriod.length - 1]
  const shown = periodLabel(shape)
  const base = `截面图只显示 ${shown} 一期，不体现 ${shape.periods} 期变化；标题请写明年份，要看趋势用 line_chart 或 heatmap_table`
  if (last && last.period !== shown) {
    return `${base}。最新一期 ${last.period} 仅 ${last.filled}/${shape.entities} 家有数，故显示 ${shown}`
  }
  return base
}
