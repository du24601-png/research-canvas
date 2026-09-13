import type { ChartStyle } from '@opptrix/shared/research-chart-style'
import type { EChartsOption } from 'echarts'
import type { ChartContentMode } from './chartResponsive'
import { displayShortName } from './chartResponsive'
import {
  isSeriesVisible,
  resolveSeriesColor,
  resolveSeriesLabel,
  styledCategoryAxis,
  styledLegend,
  styledValueAxis,
} from './chartStyleApply'
import { plotGrid } from './chartLayout'
import type { ResearchChartTheme } from './chartTheme'
import type { StackedBarView } from './views'

/** 横轴年份，每年并排多根柱（不堆积）。 */
export function buildGroupedBarOption(
  view: StackedBarView,
  theme: ResearchChartTheme,
  mode: ChartContentMode,
  style?: ChartStyle,
): EChartsOption {
  const visible = view.series.filter(item => isSeriesVisible(item.entityId, style))
  const palette = visible.map((item, index) => (
    resolveSeriesColor(item.entityId, theme, style, index)
  ))
  const labels = visible.map(item => (
    resolveSeriesLabel(item.entityId, displayShortName(item.name, item.ticker, mode), style)
  ))
  return {
    animation: false,
    color: palette.length ? palette : theme.series,
    grid: plotGrid(mode),
    tooltip: { trigger: 'axis', confine: true, axisPointer: { type: 'shadow' } },
    legend: styledLegend(mode, theme, style),
    xAxis: styledCategoryAxis(view.periods, mode, theme, style),
    yAxis: styledValueAxis(view.unit, mode, theme, style),
    series: visible.map((item, index) => {
      const color = palette[index] ?? theme.series[0]
      return {
        name: labels[index] ?? item.name,
        type: 'bar',
        data: item.values,
        color,
        itemStyle: { color },
        barMaxWidth: mode === 'compact' ? 18 : 28,
        barGap: '24%',
        barCategoryGap: '32%',
      }
    }),
  }
}
