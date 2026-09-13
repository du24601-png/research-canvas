import type { ChartContentMode } from './chartResponsive'
import type { ResearchChartTheme } from './chartTheme'

export function plotGrid(mode: ChartContentMode): {
  left: number
  right: number
  top: number
  bottom: number
  containLabel: true
} {
  if (mode === 'compact') {
    return { left: 6, right: 8, top: 6, bottom: 4, containLabel: true }
  }
  if (mode === 'medium') {
    return { left: 8, right: 10, top: 26, bottom: 6, containLabel: true }
  }
  return { left: 10, right: 12, top: 28, bottom: 8, containLabel: true }
}

export function seriesLegend(mode: ChartContentMode, theme: ResearchChartTheme) {
  if (mode === 'compact') return { show: false as const }
  return {
    show: true as const,
    type: 'scroll' as const,
    top: 0,
    left: 8,
    right: 8,
    padding: [2, 8, 0, 8],
    itemWidth: 10,
    itemHeight: 8,
    itemGap: 10,
    textStyle: { color: theme.textSecondary, fontSize: mode === 'wide' ? 11 : 10 },
  }
}

export function axisLabelStyle(
  mode: ChartContentMode,
  theme: ResearchChartTheme,
  maxWidth?: number,
) {
  return {
    color: theme.textSecondary,
    fontSize: mode === 'compact' ? 10 : 11,
    hideOverlap: true,
    ...(maxWidth
      ? { width: maxWidth, overflow: 'truncate' as const, ellipsis: '…' }
      : {}),
  }
}

export function valueAxisFormatter(unit: string, mode: ChartContentMode): string {
  return mode === 'compact' ? '{value}' : `{value}${unit}`
}
