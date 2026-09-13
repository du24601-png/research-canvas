export type ChartContentMode = 'compact' | 'medium' | 'wide'

export const CHART_MODE_COMPACT_MAX = 380
export const CHART_MODE_MEDIUM_MAX = 600
/** 低于此高度时按 compact 处理：收起图例和轴标题，避免字和图叠在一起 */
export const CHART_SHORT_HEIGHT = 168

export function chartContentMode(
  widthPx: number,
  heightPx = Number.POSITIVE_INFINITY,
): ChartContentMode {
  if (!Number.isFinite(widthPx) || widthPx <= 0) return 'medium'
  const short = Number.isFinite(heightPx) && heightPx > 0 && heightPx < CHART_SHORT_HEIGHT
  if (short || widthPx < CHART_MODE_COMPACT_MAX) return 'compact'
  if (widthPx < CHART_MODE_MEDIUM_MAX) return 'medium'
  return 'wide'
}

export function nextChartContentMode(
  current: ChartContentMode,
  widthPx: number,
  heightPx = Number.POSITIVE_INFINITY,
): ChartContentMode | null {
  const next = chartContentMode(widthPx, heightPx)
  return next === current ? null : next
}

export function displayShortName(name: string, ticker: string, mode: ChartContentMode): string {
  const trimmed = name.trim()
  if (mode === 'wide') return trimmed
  if (mode === 'medium') {
    if (trimmed.length <= 12) return trimmed
    return `${trimmed.slice(0, 11)}…`
  }
  if (trimmed.length > 0 && trimmed.length <= 8 && !/^\d+$/.test(trimmed)) {
    return trimmed
  }
  const code = ticker.replace(/\.(SH|SZ|HK|US)$/i, '').trim()
  return code || (trimmed.length > 4 ? `${trimmed.slice(0, 4)}…` : trimmed)
}
