import { RESEARCH_CANVAS_TITLE_MAX } from './research-canvas-protocol.js'
import { resolveResearchMetric } from './research-metrics.js'
import type { ResearchCanvasWidgetType } from './research-canvas-protocol.js'
import type { ResearchViewIntent } from './research-view-params.js'

export interface ResearchViewTitleInput {
  entityCount: number
  entityNames: readonly string[]
  metric: string
  type: ResearchCanvasWidgetType
  intent?: ResearchViewIntent
  period?: string
  periods?: readonly string[]
}

function metricName(metric: string): string {
  return resolveResearchMetric(metric)?.name ?? metric
}

function whoLabel(entityCount: number, entityNames: readonly string[]): string {
  if (entityCount === 1 && entityNames[0]) return entityNames[0]
  return `已确认的${entityCount}家`
}

function periodSpan(periods: readonly string[] | undefined): string {
  if (!periods?.length) return ''
  const first = periods[0] ?? ''
  const last = periods[periods.length - 1] ?? first
  return first && last && first !== last ? `${first}–${last}` : first
}

function yearClause(
  type: ResearchCanvasWidgetType,
  period: string | undefined,
  periods: readonly string[] | undefined,
): string {
  if (type === 'bar_chart' || type === 'pie_chart' || type === 'donut_chart') {
    return period ? `（${period}）` : ''
  }
  const span = periodSpan(periods)
  return span ? `（${span}）` : ''
}

function intentNoun(intent: ResearchViewIntent | undefined, type: ResearchCanvasWidgetType): string {
  if (type === 'heatmap_table') return '对照'
  if (type === 'table') return '明细'
  if (type === 'candlestick') return '日K'
  if (intent === 'rank' || type === 'bar_chart' || type === 'grouped_bar') return '对比'
  if (intent === 'composition') return '构成'
  return '走势'
}

export function buildResearchViewTitle(input: ResearchViewTitleInput): string {
  const who = whoLabel(input.entityCount, input.entityNames)
  const metric = metricName(input.metric)
  const noun = intentNoun(input.intent, input.type)
  const year = yearClause(input.type, input.period, input.periods)
  return `${who}${metric}${noun}${year}`.slice(0, RESEARCH_CANVAS_TITLE_MAX)
}
