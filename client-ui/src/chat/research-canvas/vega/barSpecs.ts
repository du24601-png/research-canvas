import { displayShortName } from '../chartResponsive'
import { isSeriesVisible, resolveSeriesColor, resolveSeriesLabel } from '../chartStyleApply'
import {
  baseSpec,
  colorEncoding,
  formatValue,
  legendFor,
  periodX,
  seriesColors,
  seriesRows,
  valueAxis,
  valueScale,
  visibleSeries,
  type JsonObject,
  type SpecContext,
  type VegaChartSpec,
} from './specCommon'
import type { BarChartView, StackedBarView } from '../views'

export interface BarRow {
  entityId: string
  period: string
  series: string
  value: number | null
  valueLabel: string | null
}

function uniqueLabels(labels: string[], tickers: string[]): string[] {
  return labels.map((label, index) => (
    labels.indexOf(label) === labels.lastIndexOf(label) ? label : `${label} ${tickers[index] ?? ''}`.trim()
  ))
}

/** 单期横向柱：按值降序，数值标在柱端；缺失的公司由视图模型剔除（不画成 0） */
export function buildBarSpec(view: BarChartView, ctx: SpecContext): VegaChartSpec {
  const keep = view.entityIds.map((id, index) => ({ id, index })).filter(item => isSeriesVisible(item.id, ctx.style))
  const base = keep.map(({ id, index }) => resolveSeriesLabel(
    id, displayShortName(view.categories[index] ?? '', view.tickers[index] ?? '', ctx.mode), ctx.style,
  ))
  const labels = uniqueLabels(base, keep.map(item => view.tickers[item.index] ?? ''))
  const rows: BarRow[] = keep.map(({ id, index }, position) => {
    const value = view.values[index] ?? null
    return {
      entityId: id,
      period: view.period,
      series: labels[position] ?? id,
      value,
      valueLabel: formatValue(value, view.unit),
    }
  })
  const colors = keep.map(({ id }) => resolveSeriesColor(id, ctx.theme, ctx.style, 0))
  const color = colorEncoding(keep.map(item => item.id), colors, null)
  const x = {
    field: 'value',
    type: 'quantitative',
    title: null,
    axis: { ...valueAxis(view.unit, ctx.style), grid: true },
    scale: { ...valueScale(ctx.style), zero: true },
  }
  const y = { field: 'series', type: 'ordinal', sort: labels, title: null, axis: { grid: false, domain: false } }
  const showValues = ctx.style?.marks?.showValues ?? rows.length <= 12
  return {
    rightPad: 40,
    spec: {
      ...baseSpec(rows, ctx.theme, 40),
      layer: [
        { mark: { type: 'bar', cornerRadiusEnd: 2, cursor: 'pointer', invalid: 'filter' }, encoding: { x, y, color } },
        ...(showValues ? [{
          mark: { type: 'text', align: 'left', baseline: 'middle', dx: 4, fontSize: 11 },
          encoding: { x, y, color, text: { field: 'valueLabel' } },
        }] : []),
      ],
    },
  }
}

function barRows(view: StackedBarView, ctx: SpecContext) {
  const series = visibleSeries(view.series, ctx.style)
  return { series, rows: seriesRows(series, view.periods, view.unit, ctx) }
}

function valueTextLayer(show: boolean, encoding: JsonObject, mark: JsonObject): JsonObject[] {
  if (!show) return []
  return [{ mark: { type: 'text', fontSize: 10, ...mark }, encoding: { ...encoding, text: { field: 'valueLabel' } } }]
}

/** 分组柱：横轴期间，每期并排多根柱 */
export function buildGroupedBarSpec(view: StackedBarView, ctx: SpecContext): VegaChartSpec {
  const { series, rows } = barRows(view, ctx)
  const color = colorEncoding(series.map(item => item.entityId), seriesColors(series, ctx), legendFor(ctx.style, ctx.mode))
  const enc = {
    x: periodX(view.periods),
    xOffset: { field: 'entityId', type: 'nominal', sort: series.map(item => item.entityId) },
    y: { field: 'value', type: 'quantitative', title: null, axis: valueAxis(view.unit, ctx.style), scale: { ...valueScale(ctx.style), zero: true } },
    color,
  }
  return {
    rightPad: 8,
    spec: {
      ...baseSpec(rows, ctx.theme, 8),
      layer: [
        { mark: { type: 'bar', cornerRadiusEnd: 2, cursor: 'pointer', invalid: 'filter' }, encoding: enc },
        ...valueTextLayer(ctx.style?.marks?.showValues === true, enc, { baseline: 'bottom', dy: -2 }),
      ],
    },
  }
}

/** 堆叠柱；百分比版数值已由视图模型换算好 */
export function buildStackedBarSpec(view: StackedBarView, ctx: SpecContext): VegaChartSpec {
  const { series, rows } = barRows(view, ctx)
  const color = colorEncoding(series.map(item => item.entityId), seriesColors(series, ctx), legendFor(ctx.style, ctx.mode))
  const enc = {
    x: periodX(view.periods),
    y: {
      field: 'value',
      type: 'quantitative',
      stack: 'zero',
      title: null,
      axis: valueAxis(view.unit, ctx.style),
      scale: view.percent ? { domain: [0, 100] } : { ...valueScale(ctx.style), zero: true },
    },
    color,
  }
  return {
    rightPad: 8,
    spec: {
      ...baseSpec(rows, ctx.theme, 8),
      layer: [
        { mark: { type: 'bar', cursor: 'pointer', invalid: 'filter' }, encoding: enc },
        ...valueTextLayer(ctx.style?.marks?.showValues === true, enc, { baseline: 'middle' }),
      ],
    },
  }
}
