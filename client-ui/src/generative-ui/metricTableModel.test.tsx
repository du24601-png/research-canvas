import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../test/testUtils'
import SpecRenderer from './SpecRenderer'
import { renderedKeyPoints } from './KeyPoints'
import { cellText, firstLastChange, heatWash, metricTableModel, sparkPath } from './metricTableModel'
import { FIXTURE_DATASETS, NET_MARGIN, ROE, SPEC_DEMO_TABLE } from './specFixtures'
import type { Dataset } from '../chat/research-canvas/types'

const A = NET_MARGIN.entities[0]?.id ?? ''
const B = NET_MARGIN.entities[1]?.id ?? ''
const REVENUE: Dataset = { ...NET_MARGIN, id: 'research-ds-55555555-5555-4555-8555-555555555555', metric: 'revenue', unit: '亿元' }

function chipText(parts: ReturnType<typeof renderedKeyPoints>[number]['parts']): string {
  return parts.map(part => part.kind === 'chip' ? `[${part.text}]` : part.text).join('')
}

describe('metricTable helpers', () => {
  afterEach(cleanup)

  it('first→last change: percentage points for ratios, percent otherwise, — when an end is missing', () => {
    expect(firstLastChange(NET_MARGIN, A)).toBe('+4.8 个百分点')
    expect(firstLastChange(ROE, B)).toBe('—')
    expect(firstLastChange(REVENUE, A)).toBe('+11.9%')
  })

  it('cells: ratio values carry %, others plain numbers; null → —', () => {
    expect(cellText(NET_MARGIN, 45)).toBe('45.0%')
    expect(cellText(REVENUE, 45)).toBe('45.0')
    expect(cellText(ROE, null)).toBe('—')
    const model = metricTableModel(ROE)
    expect(model.caption).toBe('净资产收益率（%）')
    expect(model.changeHeader).toBe('2021→2025')
    const rowB = model.rows[1]
    expect(rowB?.cells[0]).toEqual({ period: '2021', value: null, text: '—', shade: null })
    expect(heatWash(null)).toBeNull()
    expect(heatWash(0.5)).toBeNull()
    expect(heatWash(0)?.side).toBe('low')
    expect(heatWash(1)?.side).toBe('high')
    const shades = model.rows.flatMap(row => row.cells.map(cell => cell.shade)).filter((v): v is number => v != null)
    expect(Math.min(...shades)).toBe(0)
    expect(Math.max(...shades)).toBe(1)
  })

  it('sparkline breaks at missing values and needs two points', () => {
    expect(sparkPath([1, null, 3], 10, 10)).toBe('M0.0 10.0 M10.0 0.0')
    expect(sparkPath([1, 2], 10, 10)).toBe('M0.0 10.0 L10.0 0.0')
    expect(sparkPath([null, 2, null])).toBeNull()
    expect(sparkPath([5, 5], 10, 10)).toBe('M0.0 5.0 L10.0 5.0')
  })

  it('key points are picked and worded by code; numbers are chips from the dataset', () => {
    const points = renderedKeyPoints([NET_MARGIN, ROE])
    expect(points.map(p => p.point.kind)).toEqual(['extreme', 'extreme', 'missing'])
    expect(chipText(points[0]?.parts ?? [])).toBe('示例公司甲 净利率 2025 年为 [45.0%]，是 2021–2025 年的最高值。')
    expect(chipText(points[2]?.parts ?? [])).toContain('有 1 处数据没有取到')
    expect(renderedKeyPoints([])).toEqual([])
  })

  it('renders key points and the table with focusable cells and source tooltips', () => {
    renderWithProviders(<SpecRenderer spec={SPEC_DEMO_TABLE} datasets={FIXTURE_DATASETS} fallback={<div>原预览卡</div>} />)
    const blocks = [...document.querySelectorAll('[data-generative-ui-block]')].map(el => el.getAttribute('data-generative-ui-block'))
    expect(blocks).toEqual(['KeyPoints', 'MetricTable'])
    expect(document.querySelectorAll('[data-metric-table]').length).toBe(2)
    expect(document.querySelectorAll('[data-key-point]').length).toBe(3)
    const roeTable = document.querySelector(`[data-metric-table="${ROE.id}"]`)
    const missingCell = roeTable?.querySelector(`tr[data-entity="${B}"] td[data-period="2021"]`) as HTMLElement
    expect(missingCell.textContent).toBe('—')
    expect(missingCell.getAttribute('aria-label')).toContain('暂无数据')
    const cell = roeTable?.querySelector(`tr[data-entity="${A}"] td[data-period="2025"]`) as HTMLElement
    expect(cell.textContent).toBe('32.0%')
    expect(cell.tabIndex).toBe(0)
    fireEvent.focus(cell)
    expect(screen.getAllByText('示例公司甲 · 2025 年').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/来源：/).length).toBeGreaterThan(0)
    expect(roeTable?.querySelector(`tr[data-entity="${A}"] [data-change]`)?.textContent).toBe('+3.6 个百分点')
    expect(cell.style.backgroundColor).toContain('--opptrix-error')
    const lowCell = roeTable?.querySelector(`tr[data-entity="${B}"] td[data-period="2025"]`) as HTMLElement
    expect(lowCell.style.backgroundColor).toContain('--opptrix-success')
  })
})
