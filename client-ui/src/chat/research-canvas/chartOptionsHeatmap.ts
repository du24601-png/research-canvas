import type { EChartsOption } from 'echarts'
import { axisLabelStyle } from './chartLayout'
import type { ChartContentMode } from './chartResponsive'
import { displayShortName } from './chartResponsive'
import type { ResearchChartTheme } from './chartTheme'
import type { HeatmapChartView } from './views'

export function buildHeatmapOption(
  view: HeatmapChartView,
  theme: ResearchChartTheme,
  mode: ChartContentMode,
): EChartsOption {
  const labels = view.categories.map((name, index) => (
    displayShortName(name, view.tickers[index] ?? '', mode)
  ))
  const data = view.cells.map(([x, y, value]) => [x, y, value])
  return {
    animation: false,
    grid: {
      left: mode === 'compact' ? 8 : 12,
      right: mode === 'compact' ? 8 : 28,
      top: 8,
      bottom: 8,
      containLabel: true,
    },
    tooltip: {
      trigger: 'item',
      confine: true,
      formatter: (raw: unknown) => heatmapTooltip(view, raw),
    },
    xAxis: {
      type: 'category',
      data: view.periods,
      axisLabel: axisLabelStyle(mode, theme, mode === 'compact' ? 36 : 48),
      axisLine: { lineStyle: { color: theme.border } },
      splitArea: { show: true },
    },
    yAxis: {
      type: 'category',
      data: labels,
      inverse: true,
      axisLabel: mode === 'compact'
        ? { show: false }
        : axisLabelStyle(mode, theme, 80),
      axisLine: { lineStyle: { color: theme.border } },
      splitArea: { show: true },
    },
    visualMap: {
      show: mode !== 'compact',
      min: view.min,
      max: view.max === view.min ? view.min + 1 : view.max,
      calculable: false,
      orient: 'vertical',
      right: 0,
      top: 'middle',
      itemWidth: 8,
      itemHeight: mode === 'medium' ? 56 : 72,
      inRange: { color: [theme.surface, theme.series[0] ?? theme.text] },
      textStyle: { color: theme.textSecondary, fontSize: 10 },
    },
    series: [{
      type: 'heatmap',
      data,
      label: {
        show: mode === 'wide',
        color: theme.text,
        fontSize: 10,
        formatter: (raw: { value?: unknown }) => heatmapCellLabel(raw, view.unit),
      },
      emphasis: { itemStyle: { shadowBlur: 4, borderColor: theme.text } },
    }],
  }
}

function heatmapTooltip(view: HeatmapChartView, raw: unknown): string {
  if (!raw || typeof raw !== 'object' || !('value' in raw)) return ''
  const value = (raw as { value?: unknown }).value
  if (!Array.isArray(value) || value.length < 3) return ''
  const x = typeof value[0] === 'number' ? value[0] : 0
  const y = typeof value[1] === 'number' ? value[1] : 0
  const cell = value[2]
  const shown = typeof cell === 'number' ? `${cell}${view.unit}` : '—'
  const name = view.categories[y] ?? ''
  const period = view.periods[x] ?? ''
  return `${name}<br/>${period}：${shown}`
}

function heatmapCellLabel(raw: { value?: unknown }, unit: string): string {
  if (!Array.isArray(raw.value) || raw.value.length < 3) return ''
  const cell = raw.value[2]
  return typeof cell === 'number' ? `${cell}${unit}` : ''
}
