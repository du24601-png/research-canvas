import { describe, expect, it } from 'vitest'
import {
  resolveChartStyleAgainstEntities,
  sanitizeChartStyle,
} from '@opptrix/shared/research-chart-style'
import { resolveSeriesColor, resolveSeriesLabel } from './chartStyleApply'
import { buildGroupedBarOption } from './chartOptionsGrouped'
import { getResearchChartTheme } from './chartTheme'
import { MOCK_GROSS_MARGIN_DATASET } from './mockGrossMarginDataset'
import { buildGroupedBarView } from './views'

describe('chart style helpers', () => {
  it('sanitizes named colors and merges series by entity id', () => {
    const base = sanitizeChartStyle({
      series: { 'ent-a': { color: '蓝色', label: '电池链条' } },
    })
    const patch = sanitizeChartStyle({
      series: { 'ent-b': { color: '橙色' } },
    })
    expect(base?.series?.['ent-a']?.color).toBe('#2563EB')
    expect(patch?.series?.['ent-b']?.color).toBe('#EA580C')
  })

  it('assigns distinct default colors by series index', () => {
    const theme = getResearchChartTheme('light')
    const first = resolveSeriesColor('e-a', theme, undefined, 0)
    const second = resolveSeriesColor('e-b', theme, undefined, 1)
    const third = resolveSeriesColor('e-c', theme, undefined, 2)
    expect(first).not.toBe(second)
    expect(second).not.toBe(third)
    expect(first).not.toBe(third)
  })

  it('applies custom label and color', () => {
    const theme = getResearchChartTheme('light')
    const style = sanitizeChartStyle({
      series: { grp1: { color: '#EA580C', label: '整车链条' } },
    })
    expect(resolveSeriesLabel('grp1', '默认名', style)).toBe('整车链条')
    expect(resolveSeriesColor('grp1', theme, style, 0)).toBe('#EA580C')
  })

  it('resolves company names to entity ids', () => {
    const style = sanitizeChartStyle({
      series: {
        宁德时代: { color: '蓝' },
        比亚迪: { color: '橙' },
      },
    })
    const bound = resolveChartStyleAgainstEntities(style, [
      { id: 'CN:SZ.300750', name: '宁德时代', ticker: '300750.SZ' },
      { id: 'CN:SZ.002594', name: '比亚迪', ticker: '002594.SZ' },
    ])
    expect(bound?.series?.['CN:SZ.300750']?.color).toBe('#2563EB')
    expect(bound?.series?.['CN:SZ.002594']?.color).toBe('#EA580C')
  })

  it('grouped bar uses years as categories and does not stack', () => {
    const theme = getResearchChartTheme('light')
    const view = buildGroupedBarView(MOCK_GROSS_MARGIN_DATASET)
    const option = buildGroupedBarOption(view, theme, 'compact')
    expect(option.xAxis).toMatchObject({ data: ['2021', '2022', '2023', '2024', '2025'] })
    const series = Array.isArray(option.series) ? option.series : []
    expect(series).toHaveLength(3)
    expect(series.every(item => (
      typeof item === 'object'
      && item != null
      && item.type === 'bar'
      && !('stack' in item)
    ))).toBe(true)
    const first = series[0]
    const second = series[1]
    expect(first && 'color' in first ? first.color : null)
      .not.toBe(second && 'color' in second ? second.color : null)
  })
})
