import { describe, expect, it } from 'vitest'
import { axisLabelStyle, plotGrid, seriesLegend, valueAxisFormatter } from './chartLayout'
import type { ResearchChartTheme } from './chartTheme'

const theme: ResearchChartTheme = {
  text: '#111',
  textSecondary: '#666',
  border: '#ddd',
  surface: '#fff',
  series: ['#1f77b4'],
  up: '#16a34a',
  down: '#dc2626',
}

describe('research-canvas chart layout', () => {
  it('keeps axes inside the widget in every mode', () => {
    expect(plotGrid('compact').containLabel).toBe(true)
    expect(plotGrid('medium').containLabel).toBe(true)
    expect(plotGrid('wide').containLabel).toBe(true)
  })

  it('drops the legend and unit suffix when the widget is compact', () => {
    expect(seriesLegend('compact', theme)).toEqual({ show: false })
    expect(seriesLegend('medium', theme).show).toBe(true)
    expect(valueAxisFormatter('%', 'compact')).toBe('{value}')
    expect(valueAxisFormatter('%', 'wide')).toBe('{value}%')
  })

  it('truncates long axis names and skips overlapping ticks', () => {
    const compact = axisLabelStyle('compact', theme, 56)
    expect(compact.hideOverlap).toBe(true)
    expect(compact.overflow).toBe('truncate')
    expect(compact.width).toBe(56)
    expect(axisLabelStyle('wide', theme).hideOverlap).toBe(true)
  })
})
