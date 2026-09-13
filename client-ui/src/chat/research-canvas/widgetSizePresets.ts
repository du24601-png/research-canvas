import type { WidgetType } from './types'

export const CANVAS_GRID_COLS = 12

export interface WidgetSizePreset {
  preferredW: number
  preferredH: number
  minW: number
  minH: number
}

export const WIDGET_SIZE_PRESETS: Record<WidgetType, WidgetSizePreset> = {
  line_chart: { preferredW: 8, preferredH: 6, minW: 5, minH: 6 },
  bar_chart: { preferredW: 5, preferredH: 6, minW: 4, minH: 5 },
  grouped_bar: { preferredW: 8, preferredH: 6, minW: 5, minH: 6 },
  stacked_bar: { preferredW: 8, preferredH: 6, minW: 5, minH: 6 },
  stacked_bar_percent: { preferredW: 8, preferredH: 6, minW: 5, minH: 6 },
  combo_bar_line: { preferredW: 8, preferredH: 6, minW: 5, minH: 6 },
  pie_chart: { preferredW: 4, preferredH: 6, minW: 4, minH: 5 },
  donut_chart: { preferredW: 4, preferredH: 6, minW: 4, minH: 5 },
  candlestick: { preferredW: 8, preferredH: 6, minW: 5, minH: 6 },
  heatmap_table: { preferredW: 8, preferredH: 8, minW: 5, minH: 6 },
  table: { preferredW: 8, preferredH: 7, minW: 5, minH: 5 },
  sources: { preferredW: 4, preferredH: 5, minW: 3, minH: 4 },
}

export function sizePresetFor(type: WidgetType): WidgetSizePreset {
  return WIDGET_SIZE_PRESETS[type]
}

export interface WidgetLayoutSize {
  w: number
  h: number
  minW: number
  minH: number
}

export function layoutSizeFromPreset(type: WidgetType): WidgetLayoutSize {
  const preset = sizePresetFor(type)
  return {
    w: preset.preferredW,
    h: preset.preferredH,
    minW: preset.minW,
    minH: preset.minH,
  }
}
