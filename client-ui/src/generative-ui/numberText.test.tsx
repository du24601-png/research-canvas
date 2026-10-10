import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../test/testUtils'
import SpecRenderer from './SpecRenderer'
import { changeText, defaultKpiPeriod, formatNumber, kpiFigures, sentenceParts } from './numberText'
import { FIXTURE_DATASETS, NET_MARGIN, ROE, SPEC_DEMO_TEXT } from './specFixtures'
import type { Dataset } from '../chat/research-canvas/types'

const A = NET_MARGIN.entities[0]?.id ?? ''
const B = NET_MARGIN.entities[1]?.id ?? ''

const REVENUE: Dataset = {
  ...NET_MARGIN,
  id: 'research-ds-44444444-4444-4444-8444-444444444444',
  metric: 'revenue',
  unit: '亿元',
  data: NET_MARGIN.data.map(point => ({ ...point, value: point.entityId === A && point.period === '2025' ? 50 : point.entityId === A && point.period === '2024' ? 40 : point.value })),
}

describe('numberText', () => {
  afterEach(cleanup)

  it('ratio metrics change in percentage points, flow metrics in percent', () => {
    expect(changeText(NET_MARGIN, A, '2025')).toBe('+0.9 个百分点')
    expect(changeText(REVENUE, A, '2025')).toBe('+25.0%')
    expect(changeText(NET_MARGIN, A, '2021')).toBe('—')
  })

  it('kpi figures read the latest filled period and show — for null', () => {
    expect(defaultKpiPeriod(ROE)).toBe('2025')
    const figures = kpiFigures(ROE, '2021')
    expect(figures.map(f => f.value)).toEqual(['28.4', '—'])
    expect(figures[1]?.unit).toBe('')
    expect(figures[1]?.delta).toBeNull()
    const latest = kpiFigures(NET_MARGIN)
    expect(latest[0]?.label).toBe('示例公司甲 · 净利率 2025')
    expect(latest[0]?.delta).toBe('较 2024 年 +0.9 个百分点')
  })

  it('sentence chips are computed from the dataset; missing values become —', () => {
    const parts = sentenceParts(ROE, `{value:${B}@2021} 与 {gap:${A}@${B}@2025}，{delta:${B}@2022}`)
    const chips = parts.filter(part => part.kind === 'chip')
    expect(chips.map(chip => chip.text)).toEqual(['—', '+11.7 个百分点', '—'])
    expect(chips.map(chip => chip.kind === 'chip' ? chip.index : 0)).toEqual([1, 2, 3])
    const largest = sentenceParts(NET_MARGIN, '{largestChange}')
    expect(largest.map(part => part.kind === 'chip' ? `[${part.text}]` : part.text).join('')).toBe('示例公司乙 2025 年较上年 [−4.2 个百分点]')
  })

  it('non-ratio largestChange is labelled as an amount; minus sign is always −', () => {
    const parts = sentenceParts(REVENUE, '{largestChange}')
    expect(parts.map(part => part.kind === 'chip' ? `[${part.text}]` : part.text).join('')).toBe('示例公司甲 2025 年较上年变化额 [+10.0 亿元]')
    expect(formatNumber(-3.25)).toBe('−3.3')
    expect(formatNumber(-0.04)).toBe('−0.04')
  })

  it('renders the sentence with citation chips and the KPI row', () => {
    renderWithProviders(<SpecRenderer spec={SPEC_DEMO_TEXT} datasets={FIXTURE_DATASETS} fallback={<div>原预览卡</div>} />)
    const blocks = [...document.querySelectorAll('[data-generative-ui-block]')].map(el => el.getAttribute('data-generative-ui-block'))
    expect(blocks).toEqual(['NumberSentence', 'KpiRow'])
    const chips = [...document.querySelectorAll('[data-citation-index]')].map(el => el.textContent)
    expect(chips).toEqual(['45.0%1', '+0.9 个百分点2', '+14.0 个百分点3'])
    fireEvent.focus(document.querySelector('[data-citation-index="1"]') as HTMLElement)
    expect(screen.getAllByText(/来源：上市公司财报/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('示例公司甲 · 2025 年').length).toBeGreaterThan(0)
    expect(document.querySelector('[data-kpi-entity]')?.textContent).toContain('45.0%')
  })
})
