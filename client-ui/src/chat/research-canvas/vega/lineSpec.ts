import {
  baseSpec,
  colorEncoding,
  emphasisEncoding,
  endLabelPad,
  endLabelRows,
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
import type { LineChartView } from '../views'

function textLayers(ends: readonly object[], showValues: boolean, x: JsonObject, y: JsonObject, color: JsonObject) {
  const layers: JsonObject[] = []
  if (ends.length) {
    layers.push({
      data: { values: ends },
      mark: { type: 'text', align: 'left', baseline: 'middle', dx: 8, fontWeight: 600 },
      encoding: {
        x, y, color,
        text: { field: 'endLabel' },
        size: emphasisEncoding([10, 12]),
        opacity: emphasisEncoding([0.55, 1]),
      },
    })
  }
  if (showValues) {
    layers.push({
      mark: { type: 'text', dy: -9, fontSize: 11 },
      encoding: { x, y, color, text: { field: 'valueLabel' } },
    })
  }
  return layers
}

/** 折线：线尾直接标「名称 最新值单位」，仅横向网格，关注对象加粗，其余淡化 */
export function buildLineSpec(view: LineChartView, ctx: SpecContext): VegaChartSpec {
  const series = visibleSeries(view.series, ctx.style)
  const rows = seriesRows(series, view.periods, view.unit, ctx)
  const ends = ctx.style?.legend?.show === true ? [] : endLabelRows(rows)
  const ids = series.map(item => item.entityId)
  const legend = ends.length ? null : legendFor(ctx.style, ctx.mode)
  const color = colorEncoding(ids, seriesColors(series, ctx), legend)
  const x = periodX(view.periods)
  const y = {
    field: 'value',
    type: 'quantitative',
    title: null,
    axis: valueAxis(view.unit, ctx.style),
    scale: valueScale(ctx.style),
  }
  const rightPad = endLabelPad(ends.map(row => row.endLabel), ctx.mode)
  const dots = view.periods.length <= 10
  return {
    rightPad,
    spec: {
      ...baseSpec(rows, ctx.theme, rightPad),
      layer: [
        {
          mark: { type: 'line', strokeJoin: 'round', strokeCap: 'round', invalid: 'break-paths-filter-domains' },
          encoding: {
            x, y, color,
            detail: { field: 'entityId' },
            strokeWidth: emphasisEncoding([1.25, 2.5]),
            opacity: emphasisEncoding([0.35, 1]),
          },
        },
        {
          mark: { type: 'point', filled: true, size: dots ? 28 : 80, cursor: 'pointer' },
          encoding: { x, y, color, opacity: dots ? emphasisEncoding([0.35, 1]) : { value: 0 } },
        },
        ...textLayers(ends, ctx.style?.marks?.showValues === true, x, y, color),
      ],
    },
  }
}
