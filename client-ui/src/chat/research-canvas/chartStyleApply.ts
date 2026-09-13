import type { ChartStyle } from '@opptrix/shared/research-chart-style'
import type { ResearchChartTheme } from './chartTheme'
import type { ChartContentMode } from './chartResponsive'

export function resolveSeriesLabel(
  entityId: string,
  defaultLabel: string,
  style: ChartStyle | undefined,
): string {
  const label = style?.series?.[entityId]?.label?.trim()
  return label || defaultLabel
}

export function resolveSeriesColor(
  entityId: string,
  theme: ResearchChartTheme,
  style: ChartStyle | undefined,
  seriesIndex = 0,
): string {
  const custom = style?.series?.[entityId]?.color
  if (custom) return custom
  const palette = theme.series
  if (!palette.length) return '#2563EB'
  return palette[Math.abs(seriesIndex) % palette.length] ?? palette[0]
}

export function isSeriesVisible(entityId: string, style: ChartStyle | undefined): boolean {
  const visible = style?.series?.[entityId]?.visible
  return visible !== false
}

export function styledLegend(
  mode: ChartContentMode,
  theme: ResearchChartTheme,
  style: ChartStyle | undefined,
) {
  const position = style?.legend?.position
  if (style?.legend?.show === false || position === 'none') {
    return { show: false as const }
  }
  if (mode === 'compact' && style?.legend?.show !== true) {
    return { show: false as const }
  }
  const base = {
    show: true as const,
    type: 'scroll' as const,
    itemWidth: 10,
    itemHeight: 8,
    itemGap: 10,
    textStyle: { color: theme.textSecondary, fontSize: mode === 'wide' ? 11 : 10 },
  }
  if (position === 'right') {
    return {
      ...base,
      orient: 'vertical' as const,
      right: 0,
      top: 'middle' as const,
    }
  }
  if (position === 'bottom') {
    return {
      ...base,
      bottom: 0,
      left: 8,
      right: 8,
    }
  }
  return {
    ...base,
    top: 0,
    left: 8,
    right: 8,
    padding: [2, 8, 0, 8],
  }
}

export function styledValueAxis(
  unit: string,
  mode: ChartContentMode,
  theme: ResearchChartTheme,
  style: ChartStyle | undefined,
) {
  const axis = {
    type: 'value' as const,
    axisLabel: {
      color: theme.textSecondary,
      fontSize: mode === 'compact' ? 10 : 11,
      formatter: mode === 'compact' ? '{value}' : `{value}${unit}`,
    },
    splitLine: { lineStyle: { color: theme.border, opacity: 0.35 } },
  }
  const title = style?.yAxis?.title?.trim()
  const next = title
    ? {
      ...axis,
      name: title,
      nameTextStyle: { color: theme.textSecondary, fontSize: 11 },
      nameGap: 12,
    }
    : axis
  if (style?.yAxis?.zero) {
    return { ...next, min: 0 }
  }
  return next
}

export function styledCategoryAxis(
  data: string[],
  mode: ChartContentMode,
  theme: ResearchChartTheme,
  style: ChartStyle | undefined,
  extra?: Record<string, unknown>,
) {
  const title = style?.xAxis?.title?.trim()
  return {
    type: 'category' as const,
    data,
    axisLabel: {
      color: theme.textSecondary,
      fontSize: mode === 'compact' ? 10 : 11,
      hideOverlap: true,
      ...(extra ?? {}),
    },
    axisLine: { lineStyle: { color: theme.border } },
    ...(title
      ? {
        name: title,
        nameTextStyle: { color: theme.textSecondary, fontSize: 11 },
        nameGap: 12,
      }
      : {}),
  }
}
