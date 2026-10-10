/**
 * 图表渲染器开关（FinFrame 图表升级 A1/A2）。默认 ECharts；
 * localStorage `finframe.chartRenderer` = 'vega' 时，受支持的图种改用 Vega-Lite。
 * 页面加载时只读取一次（getChartRendererOnce），改动后需刷新页面才生效，避免同屏图表混用两种渲染器。
 */
export const CHART_RENDERER_STORAGE_KEY = 'finframe.chartRenderer'

export type ChartRenderer = 'echarts' | 'vega'

export function resolveChartRenderer(storedValue: string | null | undefined): ChartRenderer {
  return storedValue === 'vega' ? 'vega' : 'echarts'
}

export function getChartRenderer(): ChartRenderer {
  try {
    if (typeof window === 'undefined') return 'echarts'
    return resolveChartRenderer(window.localStorage.getItem(CHART_RENDERER_STORAGE_KEY))
  } catch {
    return 'echarts'
  }
}

let loadTimeRenderer: ChartRenderer | null = null

/** 每次页面加载只读一次，之后一直返回同一个值 */
export function getChartRendererOnce(): ChartRenderer {
  if (loadTimeRenderer === null) loadTimeRenderer = getChartRenderer()
  return loadTimeRenderer
}
