export type ChartLegendPosition = 'top' | 'right' | 'bottom' | 'none'

export interface ChartStyleSeriesItem {
  label?: string
  color?: string
  visible?: boolean
}

export interface ChartStyle {
  legend?: {
    show?: boolean
    position?: ChartLegendPosition
  }
  xAxis?: {
    title?: string
  }
  yAxis?: {
    title?: string
    zero?: boolean
  }
  series?: Record<string, ChartStyleSeriesItem>
  marks?: {
    showValues?: boolean
  }
}

const LEGEND_POSITIONS = new Set<ChartLegendPosition>(['top', 'right', 'bottom', 'none'])
const SAFE_COLOR_RE =
  /^(#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\))$/
const AXIS_TITLE_MAX = 40
const SERIES_LABEL_MAX = 40
const SERIES_KEY_MAX = 128

/** 自然语言色名 → 安全 hex；sanitize 后写入 style，渲染层不再猜中文。 */
const COLOR_ALIASES: Record<string, string> = {
  blue: '#2563EB', 蓝: '#2563EB', 蓝色: '#2563EB',
  orange: '#EA580C', 橙: '#EA580C', 橙色: '#EA580C', 橘: '#EA580C', 橘色: '#EA580C',
  green: '#16A34A', 绿: '#16A34A', 绿色: '#16A34A',
  red: '#DC2626', 红: '#DC2626', 红色: '#DC2626',
  purple: '#7C3AED', 紫: '#7C3AED', 紫色: '#7C3AED',
  yellow: '#CA8A04', 黄: '#CA8A04', 黄色: '#CA8A04',
  teal: '#0D9488', 青: '#0D9488', 青色: '#0D9488',
  pink: '#DB2777', 粉: '#DB2777', 粉色: '#DB2777',
  gray: '#6B7280', grey: '#6B7280', 灰: '#6B7280', 灰色: '#6B7280',
  black: '#141414', 黑: '#141414', 黑色: '#141414',
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseColor(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const color = raw.trim()
  if (!color) return undefined
  const aliased = COLOR_ALIASES[color] ?? COLOR_ALIASES[color.toLowerCase()]
  if (aliased) return aliased
  if (!SAFE_COLOR_RE.test(color)) return undefined
  const lower = color.toLowerCase()
  if (lower.includes('url(') || lower.includes('expression') || lower.includes('javascript:')) {
    return undefined
  }
  return color
}

function parseAxisTitle(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const title = raw.trim()
  if (!title || title.length > AXIS_TITLE_MAX) return undefined
  return title
}

function parseSeriesItem(raw: unknown): ChartStyleSeriesItem | undefined {
  if (!isRecord(raw)) return undefined
  const item: ChartStyleSeriesItem = {}
  const label = typeof raw.label === 'string' ? raw.label.trim() : ''
  if (label && label.length <= SERIES_LABEL_MAX) item.label = label
  const color = parseColor(raw.color)
  if (color) item.color = color
  if (typeof raw.visible === 'boolean') item.visible = raw.visible
  return item.label || item.color || item.visible !== undefined ? item : undefined
}

function parseSeriesMap(raw: unknown): Record<string, ChartStyleSeriesItem> | undefined {
  if (!isRecord(raw)) return undefined
  const series: Record<string, ChartStyleSeriesItem> = {}
  for (const [key, value] of Object.entries(raw)) {
    const id = key.trim()
    if (!id || id.length > SERIES_KEY_MAX) continue
    const item = parseSeriesItem(value)
    if (item) series[id] = item
  }
  return Object.keys(series).length ? series : undefined
}

export function sanitizeChartStyle(raw: unknown): ChartStyle | undefined {
  if (!isRecord(raw)) return undefined
  const style: ChartStyle = {}
  if (isRecord(raw.legend)) {
    const legend: NonNullable<ChartStyle['legend']> = {}
    if (typeof raw.legend.show === 'boolean') legend.show = raw.legend.show
    const position = typeof raw.legend.position === 'string' ? raw.legend.position.trim() : ''
    if (LEGEND_POSITIONS.has(position as ChartLegendPosition)) {
      legend.position = position as ChartLegendPosition
    }
    if (legend.show !== undefined || legend.position) style.legend = legend
  }
  if (isRecord(raw.xAxis)) {
    const title = parseAxisTitle(raw.xAxis.title)
    if (title) style.xAxis = { title }
  }
  if (isRecord(raw.yAxis)) {
    const yAxis: NonNullable<ChartStyle['yAxis']> = {}
    const title = parseAxisTitle(raw.yAxis.title)
    if (title) yAxis.title = title
    if (typeof raw.yAxis.zero === 'boolean') yAxis.zero = raw.yAxis.zero
    if (yAxis.title || yAxis.zero !== undefined) style.yAxis = yAxis
  }
  const series = parseSeriesMap(raw.series)
  if (series) style.series = series
  if (isRecord(raw.marks) && typeof raw.marks.showValues === 'boolean') {
    style.marks = { showValues: raw.marks.showValues }
  }
  return style.legend || style.xAxis || style.yAxis || style.series || style.marks
    ? style
    : undefined
}

export function compactChartStyle(style: ChartStyle | undefined): ChartStyle | undefined {
  if (!style) return undefined
  return sanitizeChartStyle(style)
}

export function mergeChartStyle(
  base: ChartStyle | undefined,
  patch: ChartStyle | undefined,
): ChartStyle | undefined {
  if (!patch) return compactChartStyle(base)
  if (!base) return compactChartStyle(patch)
  const merged: ChartStyle = { ...base }
  if (patch.legend) merged.legend = { ...base.legend, ...patch.legend }
  if (patch.xAxis) merged.xAxis = { ...base.xAxis, ...patch.xAxis }
  if (patch.yAxis) merged.yAxis = { ...base.yAxis, ...patch.yAxis }
  if (patch.marks) merged.marks = { ...base.marks, ...patch.marks }
  if (patch.series) {
    merged.series = { ...base.series }
    for (const [entityId, item] of Object.entries(patch.series)) {
      merged.series[entityId] = { ...merged.series[entityId], ...item }
    }
  }
  return compactChartStyle(merged)
}

export {
  matchChartStyleEntityId,
  resolveChartStyleAgainstEntities,
  type ChartStyleEntityRef,
} from './research-chart-style-resolve.js'
