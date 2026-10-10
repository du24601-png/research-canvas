/** Vega-Lite 规格的公共部分：主题、数据行、端点标签。数字一律来自视图模型，这里只做排版。 */
import type { ChartStyle } from '@opptrix/shared/research-chart-style'
import { displayShortName, type ChartContentMode } from '../chartResponsive'
import {
  isSeriesVisible,
  resolveSeriesColor,
  resolveSeriesLabel,
} from '../chartStyleApply'
import type { ResearchChartTheme } from '../chartTheme'
import type { LineSeriesView } from '../views'

export type JsonObject = Record<string, unknown>

export interface SpecContext {
  theme: ResearchChartTheme
  mode: ChartContentMode
  style?: ChartStyle
}

export interface VegaChartSpec {
  spec: JsonObject
  /** 右侧给端点标签留的像素（已写入 spec.padding，仅供测试与调试） */
  rightPad: number
}

/** 点击与端点标签共用的数据行：entityId + period 直接对应一个单元格 */
export interface SeriesRow {
  entityId: string
  period: string
  series: string
  value: number | null
  valueLabel: string | null
  emph: number
}

export const VEGA_SCHEMA = 'https://vega.github.io/schema/vega-lite/v6.json'

export function formatValue(value: number | null, unit: string): string | null {
  if (value == null || !Number.isFinite(value)) return null
  return `${value.toFixed(1)}${unit}`
}

export function vegaConfig(theme: ResearchChartTheme): JsonObject {
  const label = { labelColor: theme.textSecondary, labelFontSize: 11, titleColor: theme.textSecondary }
  return {
    background: null,
    font: 'inherit',
    view: { stroke: null },
    axis: { ...label, ticks: false, domain: false, grid: false, labelPadding: 6 },
    axisX: { domain: true, domainColor: theme.border, labelOverlap: true, labelAngle: 0 },
    axisY: { grid: true, gridColor: theme.border, gridOpacity: 0.35, gridWidth: 1, domain: false },
    legend: { ...label, orient: 'top', symbolSize: 60, padding: 2 },
    text: { color: theme.textSecondary },
  }
}

export function axisTitle(title: string | undefined): string | null {
  const trimmed = title?.trim()
  return trimmed ? trimmed : null
}

export function valueAxis(unit: string, style: ChartStyle | undefined): JsonObject {
  return {
    title: axisTitle(style?.yAxis?.title),
    labelExpr: `datum.label + ${JSON.stringify(unit)}`,
    tickCount: 5,
  }
}

export function valueScale(style: ChartStyle | undefined): JsonObject {
  return style?.yAxis?.zero ? { zero: true } : {}
}

/** 与 ECharts 版一致：先过滤隐藏序列，再按可见序号取色 */
export function visibleSeries(series: LineSeriesView[], style: ChartStyle | undefined): LineSeriesView[] {
  return series.filter(item => isSeriesVisible(item.entityId, style))
}

export function seriesLabel(item: LineSeriesView, ctx: SpecContext): string {
  return resolveSeriesLabel(item.entityId, displayShortName(item.name, item.ticker, ctx.mode), ctx.style)
}

export function seriesColors(series: LineSeriesView[], ctx: SpecContext): string[] {
  return series.map((item, index) => resolveSeriesColor(item.entityId, ctx.theme, ctx.style, index))
}

export function colorEncoding(
  ids: string[],
  colors: string[],
  legend: JsonObject | null,
  field = 'entityId',
): JsonObject {
  return { field, type: 'nominal', scale: { domain: ids, range: colors }, legend }
}

export function legendFor(style: ChartStyle | undefined, mode: ChartContentMode): JsonObject | null {
  const position = style?.legend?.position
  if (style?.legend?.show === false || position === 'none') return null
  if (mode === 'compact' && style?.legend?.show !== true) return null
  return {
    orient: position === 'bottom' || position === 'right' ? position : 'top',
    title: null,
  }
}

export function seriesRows(
  series: LineSeriesView[],
  periods: string[],
  unit: string,
  ctx: SpecContext,
): SeriesRow[] {
  return series.flatMap(item => periods.map((period, index) => {
    const value = item.values[index] ?? null
    return {
      entityId: item.entityId,
      period,
      series: seriesLabel(item, ctx),
      value,
      valueLabel: formatValue(value, unit),
      emph: item.dim ? 0 : 1,
    }
  }))
}

/** 每条序列最后一个非空点；整条全空则不出标签 */
export function lastNonNullRows(rows: SeriesRow[]): SeriesRow[] {
  const last = new Map<string, SeriesRow>()
  for (const row of rows) {
    if (row.value != null) last.set(row.entityId, row)
  }
  return [...last.values()]
}

export function endLabelRows(rows: SeriesRow[]): Array<SeriesRow & { endLabel: string }> {
  return lastNonNullRows(rows)
    .filter(row => row.valueLabel != null)
    .map(row => ({ ...row, endLabel: `${row.series} ${row.valueLabel ?? ''}` }))
}

/** 端点标签占宽：中文按 12px、其它按 7px 估算，封顶避免挤掉绘图区 */
export function endLabelPad(labels: string[], mode: ChartContentMode): number {
  const widest = Math.max(0, ...labels.map(text => [...text].reduce(
    (sum, char) => sum + ((char.codePointAt(0) ?? 0) > 255 ? 12 : 7), 0,
  )))
  const cap = mode === 'compact' ? 96 : 160
  return widest ? Math.min(cap, widest + 14) : 8
}

export function baseSpec(rows: unknown[], theme: ResearchChartTheme, rightPad: number): JsonObject {
  return {
    $schema: VEGA_SCHEMA,
    data: { values: rows },
    autosize: { type: 'fit', contains: 'padding' },
    padding: { left: 4, right: rightPad, top: 8, bottom: 4 },
    config: vegaConfig(theme),
  }
}

export function periodX(periods: string[], extra?: JsonObject): JsonObject {
  return { field: 'period', type: 'ordinal', sort: periods, title: null, ...(extra ?? {}) }
}

/** 单元格点击目标：数据行必须带 entityId 与 period */
export function emphasisEncoding(range: number[]): JsonObject {
  return { field: 'emph', type: 'quantitative', scale: { domain: [0, 1], range }, legend: null }
}
