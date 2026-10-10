import { afterEach, describe, expect, it } from 'vitest'
import { CHART_RENDERER_STORAGE_KEY, getChartRenderer, resolveChartRenderer } from './chartRendererFlag'

describe('chartRendererFlag', () => {
  afterEach(() => window.localStorage.removeItem(CHART_RENDERER_STORAGE_KEY))

  it('defaults to echarts and only "vega" enables Vega', () => {
    expect(resolveChartRenderer(null)).toBe('echarts')
    expect(resolveChartRenderer(undefined)).toBe('echarts')
    expect(resolveChartRenderer('')).toBe('echarts')
    expect(resolveChartRenderer('VEGA')).toBe('echarts')
    expect(resolveChartRenderer('vega')).toBe('vega')
  })

  it('reads from localStorage', () => {
    expect(getChartRenderer()).toBe('echarts')
    window.localStorage.setItem(CHART_RENDERER_STORAGE_KEY, 'vega')
    expect(getChartRenderer()).toBe('vega')
    window.localStorage.setItem(CHART_RENDERER_STORAGE_KEY, 'x')
    expect(getChartRenderer()).toBe('echarts')
  })
})
