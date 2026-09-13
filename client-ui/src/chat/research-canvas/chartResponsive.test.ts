import { describe, expect, it } from 'vitest'
import {
  chartContentMode,
  displayShortName,
  nextChartContentMode,
} from './chartResponsive'

describe('research-canvas chart responsive mode', () => {
  it('uses widget-width thresholds', () => {
    expect(chartContentMode(379)).toBe('compact')
    expect(chartContentMode(380)).toBe('medium')
    expect(chartContentMode(599)).toBe('medium')
    expect(chartContentMode(600)).toBe('wide')
  })

  it('treats a short widget as compact even when it is wide', () => {
    expect(chartContentMode(720, 120)).toBe('compact')
    expect(chartContentMode(720, 200)).toBe('wide')
    expect(nextChartContentMode('wide', 720, 120)).toBe('compact')
    expect(nextChartContentMode('compact', 720, 200)).toBe('wide')
  })

  it('only switches when the mode actually changes', () => {
    expect(nextChartContentMode('wide', 720)).toBeNull()
    expect(nextChartContentMode('wide', 500)).toBe('medium')
    expect(nextChartContentMode('medium', 200)).toBe('compact')
    expect(nextChartContentMode('compact', 200)).toBeNull()
    expect(nextChartContentMode('compact', 900)).toBe('wide')
  })

  it('shortens labels in the view layer only', () => {
    expect(displayShortName('赛轮轮胎', '601058.SH', 'wide')).toBe('赛轮轮胎')
    expect(displayShortName('赛轮轮胎', '601058.SH', 'compact')).toBe('赛轮轮胎')
    expect(displayShortName('300750', '300750.SZ', 'compact')).toBe('300750')
    expect(displayShortName('贵州轮胎股份有限公司', '000589.SZ', 'medium')).toBe('贵州轮胎股份有限公司')
    expect(displayShortName('贵州轮胎股份有限公司超长名称测试', '000589.SZ', 'medium')).toBe('贵州轮胎股份有限公司超…')
  })
})
