import { resolveChartStyleAgainstEntities, type ChartStyle } from '@opptrix/shared/research-chart-style'
import type { ChartContentMode } from '../chartResponsive'
import type { ResearchChartTheme } from '../chartTheme'
import type { Dataset, WidgetType } from '../types'
import {
  buildBarChartView,
  buildComboChartView,
  buildGroupedBarView,
  buildHeatmapView,
  buildLineChartView,
  buildPieChartView,
  buildStackedBarView,
} from '../views'
import { buildBarSpec, buildGroupedBarSpec, buildStackedBarSpec } from './barSpecs'
import { buildLineSpec } from './lineSpec'
import { buildComboSpec, buildHeatmapSpec, buildPieSpec } from './otherSpecs'
import type { SpecContext, VegaChartSpec } from './specCommon'

const VEGA_TYPES: ReadonlySet<WidgetType> = new Set<WidgetType>([
  'line_chart',
  'bar_chart',
  'grouped_bar',
  'stacked_bar',
  'stacked_bar_percent',
  'combo_bar_line',
  'pie_chart',
  'donut_chart',
  'heatmap_table',
])

/** K 线、表格、来源仍走原渲染器 */
export function isVegaSupported(type: WidgetType): boolean {
  return VEGA_TYPES.has(type)
}

export interface BuildVegaOptions {
  type: WidgetType
  dataset: Dataset
  theme: ResearchChartTheme
  mode: ChartContentMode
  style?: ChartStyle
  period?: string
  topN?: number
}

export function buildVegaSpec(options: BuildVegaOptions): VegaChartSpec | null {
  const { type, dataset, period, topN } = options
  const style = resolveChartStyleAgainstEntities(options.style, dataset.entities)
  const ctx: SpecContext = { theme: options.theme, mode: options.mode, style }
  switch (type) {
    case 'line_chart': return buildLineSpec(buildLineChartView(dataset, topN), ctx)
    case 'bar_chart': return buildBarSpec(buildBarChartView(dataset, period), ctx)
    case 'grouped_bar': return buildGroupedBarSpec(buildGroupedBarView(dataset), ctx)
    case 'stacked_bar': return buildStackedBarSpec(buildStackedBarView(dataset, false), ctx)
    case 'stacked_bar_percent': return buildStackedBarSpec(buildStackedBarView(dataset, true), ctx)
    case 'combo_bar_line': return buildComboSpec(buildComboChartView(dataset), ctx)
    case 'pie_chart': return buildPieSpec(buildPieChartView(dataset, period), false, ctx)
    case 'donut_chart': return buildPieSpec(buildPieChartView(dataset, period), true, ctx)
    case 'heatmap_table':
      return buildHeatmapSpec(buildHeatmapView(dataset), dataset.entities.map(entity => entity.id), ctx)
    default: return null
  }
}
