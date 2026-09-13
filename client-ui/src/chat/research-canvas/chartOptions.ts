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
import { axisLabelStyle, plotGrid, seriesLegend, valueAxisFormatter } from './chartLayout'
import type { ResearchChartTheme } from './chartTheme'
import type { BarChartView, CandlestickView, ComboChartView, LineChartView, PieChartView, StackedBarView } from './views'

export function buildLineChartOption(
  view: LineChartView,
  theme: ResearchChartTheme,
  mode: ChartContentMode,
  style?: ChartStyle,
): EChartsOption {
  const visibleSeries = view.series.filter(item => isSeriesVisible(item.entityId, style))
  const palette = visibleSeries.map((item, index) => (
    resolveSeriesColor(item.entityId, theme, style, index)
  ))
  const labels = visibleSeries.map(item => (
    resolveSeriesLabel(item.entityId, displayShortName(item.name, item.ticker, mode), style)
  ))
  return {
    animation: false,
    color: palette.length ? palette : theme.series,
    grid: plotGrid(mode),
    tooltip: {
      trigger: 'axis',
      confine: true,
      valueFormatter: value => `${value}${view.unit}`,
    },
    legend: styledLegend(mode, theme, style),
    xAxis: styledCategoryAxis(view.periods, mode, theme, style),
    yAxis: styledValueAxis(view.unit, mode, theme, style),
    series: visibleSeries.map((item, index) => {
      const seriesColor = palette[index] ?? theme.series[0]
      return {
      name: labels[index] ?? item.name,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: mode === 'compact' ? 4 : 6,
      data: item.values,
      color: seriesColor,
      ...(item.dim ? {
        lineStyle: { width: 1, opacity: 0.35, color: seriesColor },
        itemStyle: { opacity: 0.35, color: seriesColor },
        z: 1,
      } : { lineStyle: { width: 2, color: seriesColor }, itemStyle: { color: seriesColor }, z: 2 }),
      ...(style?.marks?.showValues ? {
        label: {
          show: true,
          position: 'top',
          color: theme.textSecondary,
          fontSize: 10,
          formatter: (params: unknown) => {
            const value = typeof params === 'object' && params != null && 'value' in params
              ? (params as { value: unknown }).value
              : null
            if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
            return `${value}${view.unit}`
          },
        },
      } : {}),
      }
    }),
  }
}

function barTooltipHtml(view: BarChartView, params: unknown): string {
  const first = Array.isArray(params) ? params[0] : params
  if (!first || typeof first !== 'object') return ''
  const index = 'dataIndex' in first && typeof first.dataIndex === 'number' ? first.dataIndex : 0
  const full = view.categories[index] ?? ''
  const value = view.values[index]
  const shown = value == null ? '—' : `${value}${view.unit}`
  return `${full}<br/>${shown}`
}

function omittedNoteText(view: BarChartView, mode: ChartContentMode): string {
  if (mode !== 'wide' || !view.omitted.length) return ''
  const names = view.omitted.slice(0, 3).join('、')
  const more = view.omitted.length > 3 ? '等' : ''
  return `${view.omitted.length} 家暂无 ${view.period} 年数据：${names}${more}`
}

export function buildBarChartOption(
  view: BarChartView,
  theme: ResearchChartTheme,
  mode: ChartContentMode,
  style?: ChartStyle,
): EChartsOption {
  const grid = plotGrid(mode)
  const axis = axisLabelStyle(mode, theme)
  const labels = view.categories.map((name, index) => (
    resolveSeriesLabel(
      view.entityIds[index] ?? `bar-${index}`,
      displayShortName(name, view.tickers[index] ?? '', mode),
      style,
    )
  ))
  const omittedNote = omittedNoteText(view, mode)
  const horizontal = view.categories.length >= 5
  const nameWidth = horizontal ? (mode === 'compact' ? 56 : 80) : (mode === 'compact' ? 40 : undefined)
  const categoryAxis = {
    ...styledCategoryAxis(labels, mode, theme, style, {
      ...axisLabelStyle(mode, theme, nameWidth),
      hideOverlap: !horizontal,
      interval: horizontal ? 0 : undefined,
      rotate: !horizontal && mode === 'wide' && view.categories.length > 3 ? 18 : 0,
    }),
    inverse: horizontal,
  }
  const valueAxis = styledValueAxis(view.unit, mode, theme, style)
  const barColors = view.entityIds.map((entityId, index) => (
    resolveSeriesColor(entityId || `bar-${index}`, theme, style, index)
  ))
  return {
    animation: false,
    color: barColors.length ? barColors : theme.series,
    grid,
    ...(omittedNote ? {
      graphic: [{
        type: 'text',
        right: 8,
        top: 2,
        silent: true,
        style: { text: omittedNote, fill: theme.textSecondary, fontSize: 11 },
      }],
    } : {}),
    tooltip: {
      trigger: 'axis',
      confine: true,
      axisPointer: { type: 'shadow' },
      formatter: params => barTooltipHtml(view, params),
    },
    legend: styledLegend(mode, theme, style),
    xAxis: horizontal ? valueAxis : categoryAxis,
    yAxis: horizontal ? categoryAxis : valueAxis,
    series: [{
      type: 'bar',
      data: view.values.map((value, index) => ({
        value,
        itemStyle: { color: barColors[index] ?? theme.series[0] },
      })),
      barMaxWidth: mode === 'compact' ? 22 : 36,
      ...(style?.marks?.showValues ? {
        label: {
          show: true,
          position: horizontal ? 'right' : 'top',
          color: theme.textSecondary,
          fontSize: 10,
          formatter: (params: unknown) => {
            const raw = typeof params === 'object' && params != null && 'value' in params
              ? (params as { value: unknown }).value
              : null
            const value = typeof raw === 'number' ? raw : (
              typeof raw === 'object' && raw != null && 'value' in raw
                ? (raw as { value: unknown }).value
                : null
            )
            if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
            return `${value}${view.unit}`
          },
        },
      } : {}),
    }],
  }
}

export function buildStackedBarOption(
  view: StackedBarView,
  theme: ResearchChartTheme,
  mode: ChartContentMode,
): EChartsOption {
  const labels = view.series.map(item => displayShortName(item.name, item.ticker, mode))
  const unit = view.percent ? '%' : view.unit
  const axis = axisLabelStyle(mode, theme)
  return {
    animation: false,
    color: theme.series,
    grid: plotGrid(mode),
    tooltip: { trigger: 'axis', confine: true, axisPointer: { type: 'shadow' } },
    legend: seriesLegend(mode, theme),
    xAxis: {
      type: 'category',
      data: view.periods,
      axisLabel: axis,
      axisLine: { lineStyle: { color: theme.border } },
    },
    yAxis: {
      type: 'value',
      max: view.percent ? 100 : undefined,
      axisLabel: { ...axis, formatter: valueAxisFormatter(unit, mode) },
      splitLine: { lineStyle: { color: theme.border, opacity: 0.35 } },
    },
    series: view.series.map((item, index) => ({
      name: labels[index] ?? item.name,
      type: 'bar',
      stack: 'total',
      emphasis: { focus: 'series' },
      data: item.values,
      itemStyle: { color: theme.series[index % theme.series.length] },
    })),
  }
}

export function buildComboBarLineOption(
  view: ComboChartView,
  theme: ResearchChartTheme,
  mode: ChartContentMode,
): EChartsOption {
  const labels = view.bars.map(item => displayShortName(item.name, item.ticker, mode))
  const axis = axisLabelStyle(mode, theme)
  return {
    animation: false,
    color: theme.series,
    grid: plotGrid(mode),
    tooltip: { trigger: 'axis', confine: true, axisPointer: { type: 'cross' } },
    legend: seriesLegend(mode, theme),
    xAxis: {
      type: 'category',
      data: view.periods,
      axisLabel: axis,
      axisLine: { lineStyle: { color: theme.border } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { ...axis, formatter: valueAxisFormatter(view.unit, mode) },
      splitLine: { lineStyle: { color: theme.border, opacity: 0.35 } },
    },
    series: [
      ...view.bars.map((item, index) => ({
        name: labels[index] ?? item.name,
        type: 'bar' as const,
        data: item.values,
        barMaxWidth: mode === 'compact' ? 18 : 28,
      })),
      {
        name: view.line.name,
        type: 'line' as const,
        data: view.line.values,
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
      },
    ],
  }
}

export function buildPieChartOption(
  view: PieChartView,
  theme: ResearchChartTheme,
  donut: boolean,
  mode: ChartContentMode,
): EChartsOption {
  const compact = mode === 'compact'
  return {
    animation: false,
    color: theme.series,
    tooltip: { trigger: 'item', confine: true, formatter: '{b}<br/>{c} ({d}%)' },
    legend: compact ? { show: false } : {
      type: 'scroll',
      orient: 'vertical',
      right: 0,
      top: 'middle',
      textStyle: { color: theme.textSecondary, fontSize: 10 },
    },
    series: [{
      type: 'pie',
      radius: donut ? ['42%', '68%'] : '65%',
      center: compact ? ['50%', '50%'] : ['40%', '50%'],
      avoidLabelOverlap: true,
      label: { show: mode === 'wide', color: theme.textSecondary, fontSize: 10 },
      data: view.slices.map(slice => ({
        name: displayShortName(slice.name, slice.ticker, mode),
        value: slice.value,
      })),
    }],
  }
}

export function buildCandlestickOption(
  view: CandlestickView,
  theme: ResearchChartTheme,
  mode: ChartContentMode,
): EChartsOption {
  const hasVolume = view.volumes.some(value => value != null)
  return {
    animation: false,
    tooltip: { trigger: 'axis', confine: true, axisPointer: { type: 'cross' } },
    axisPointer: { link: [{ xAxisIndex: 'all' }] },
    grid: hasVolume
      ? [
        { left: 8, right: 8, top: 8, height: mode === 'compact' ? '52%' : '58%', containLabel: true },
        { left: 8, right: 8, bottom: 8, height: '18%', containLabel: true },
      ]
      : plotGrid(mode),
    xAxis: hasVolume
      ? [
        { type: 'category', data: view.times, gridIndex: 0, axisLabel: { show: false } },
        {
          type: 'category',
          data: view.times,
          gridIndex: 1,
          axisLabel: axisLabelStyle(mode, theme),
        },
      ]
      : {
        type: 'category',
        data: view.times,
        axisLabel: axisLabelStyle(mode, theme),
      },
    yAxis: hasVolume
      ? [
        { scale: true, gridIndex: 0, splitLine: { lineStyle: { color: theme.border, opacity: 0.35 } } },
        { scale: true, gridIndex: 1, splitNumber: 2, axisLabel: { show: false } },
      ]
      : { scale: true, splitLine: { lineStyle: { color: theme.border, opacity: 0.35 } } },
    series: [
      {
        type: 'candlestick',
        name: view.name,
        data: view.candles,
        itemStyle: {
          color: theme.up,
          color0: theme.down,
          borderColor: theme.up,
          borderColor0: theme.down,
        },
      },
      ...(hasVolume
        ? [{
          type: 'bar' as const,
          name: '成交量',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: view.volumes,
          itemStyle: { color: theme.border },
        }]
        : []),
    ],
  }
}
