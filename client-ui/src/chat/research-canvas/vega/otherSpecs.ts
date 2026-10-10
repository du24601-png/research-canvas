import { resolveSeriesColor } from '../chartStyleApply'
import {
  baseSpec,
  colorEncoding,
  formatValue,
  legendFor,
  periodX,
  seriesColors,
  seriesRows,
  valueAxis,
  visibleSeries,
  type SpecContext,
  type VegaChartSpec,
} from './specCommon'
import type { ComboChartView, HeatmapChartView, PieChartView } from '../views'

/** 组合：各公司分组柱 + 均值折线（均值行不带 entityId，不可点开来源） */
export function buildComboSpec(view: ComboChartView, ctx: SpecContext): VegaChartSpec {
  const bars = visibleSeries(view.bars, ctx.style)
  const rows = seriesRows(bars, view.periods, view.unit, ctx)
  const mean = view.line.values.map((value, index) => ({
    period: view.periods[index] ?? '',
    series: view.line.name,
    value,
    valueLabel: formatValue(value, view.unit),
  }))
  const color = colorEncoding(bars.map(item => item.entityId), seriesColors(bars, ctx), legendFor(ctx.style, ctx.mode))
  const x = periodX(view.periods)
  const y = { field: 'value', type: 'quantitative', title: null, axis: valueAxis(view.unit, ctx.style), scale: { zero: true } }
  return {
    rightPad: 8,
    spec: {
      ...baseSpec(rows, ctx.theme, 8),
      layer: [
        {
          mark: { type: 'bar', cornerRadiusEnd: 2, cursor: 'pointer', invalid: 'filter' },
          encoding: { x, y, color, xOffset: { field: 'entityId', type: 'nominal', sort: bars.map(item => item.entityId) } },
        },
        {
          data: { values: mean },
          mark: { type: 'line', color: ctx.theme.text, strokeDash: [4, 3], strokeWidth: 1.75, point: { filled: true, size: 24 }, invalid: 'break-paths-filter-domains' },
          encoding: { x, y },
        },
      ],
    },
  }
}

/** 饼 / 环：占比由 Vega 按 value 堆叠计算，切片 value 均 > 0（视图模型已过滤） */
export function buildPieSpec(view: PieChartView, donut: boolean, ctx: SpecContext): VegaChartSpec {
  const rows = view.slices.map(slice => ({
    entityId: slice.entityId,
    period: view.period,
    series: slice.name,
    value: slice.value,
    valueLabel: formatValue(slice.value, view.unit),
  }))
  const ids = rows.map(row => row.entityId)
  const colors = view.slices.map((slice, index) => resolveSeriesColor(slice.entityId, ctx.theme, ctx.style, index))
  const legend = legendFor(ctx.style, ctx.mode) ?? (ctx.mode === 'compact' ? null : { title: null })
  return {
    rightPad: 8,
    spec: {
      ...baseSpec(rows, ctx.theme, 8),
      mark: {
        type: 'arc',
        cursor: 'pointer',
        stroke: ctx.theme.surface,
        strokeWidth: 1.5,
        outerRadius: { expr: 'min(width, height) / 2 - 6' },
        ...(donut ? { innerRadius: { expr: 'min(width, height) / 2 * 0.58' } } : {}),
      },
      encoding: {
        theta: { field: 'value', type: 'quantitative', stack: true },
        color: colorEncoding(ids, colors, legend === null ? null : { orient: 'right', ...legend }, 'entityId'),
        order: { field: 'value', type: 'quantitative', sort: 'descending' },
      },
    },
  }
}

/** 热力表格：缺失格不着色，仅显示「—」 */
export function buildHeatmapSpec(
  view: HeatmapChartView,
  entityIds: string[],
  ctx: SpecContext,
): VegaChartSpec {
  const names = view.categories
  const mid = (view.min + view.max) / 2
  const rows = view.cells.map(([xi, yi, value]) => ({
    entityId: entityIds[yi] ?? '',
    period: view.periods[xi] ?? '',
    series: names[yi] ?? '',
    value,
    valueLabel: formatValue(value, view.unit) ?? '—',
    strong: value != null && value > mid ? 1 : 0,
  }))
  const x = periodX(view.periods, { axis: { orient: 'top', domain: false } })
  const y = { field: 'series', type: 'ordinal', sort: names, title: null, axis: { grid: false, domain: false } }
  return {
    rightPad: 8,
    spec: {
      ...baseSpec(rows, ctx.theme, 8),
      layer: [
        {
          mark: { type: 'rect', cursor: 'pointer', stroke: ctx.theme.surface, strokeWidth: 2, invalid: 'filter' },
          encoding: {
            x, y,
            color: {
              field: 'value',
              type: 'quantitative',
              scale: { domain: [view.min, view.max], range: [ctx.theme.border, ctx.theme.series[0] ?? '#2563EB'] },
              legend: null,
            },
          },
        },
        {
          mark: { type: 'text', fontSize: 11 },
          encoding: {
            x, y,
            text: { field: 'valueLabel' },
            color: { field: 'strong', type: 'quantitative', scale: { domain: [0, 1], range: [ctx.theme.text, '#FFFFFF'] }, legend: null },
          },
        },
      ],
    },
  }
}
