import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../test/testUtils'
import { readPersistedCanvasState, writePersistedCanvasState } from '../chat/research-canvas/layoutStorage'
import { subscribeResearchCanvasEvents } from '../chat/research-canvas/researchCanvasBus'
import SpecRenderer from './SpecRenderer'
import { evidenceSourceText } from './EvidencePanel'
import { FIXTURE_DATASETS, INVALID_SPECS, NET_MARGIN, NET_MARGIN_DELTA, ROE, SPEC_DEMO_A, SPEC_DEMO_C } from './specFixtures'

vi.mock('../chat/research-canvas/LineChartWidget', () => ({
  default: ({ dataset }: { dataset: { id: string } }) => <div data-testid="chart" data-dataset={dataset.id} />,
}))

const SESSION = 'sess-generative-ui'
const FALLBACK = <div>原预览卡</div>

/** 渲染文本里的数值断言：去掉年份、获取时间、代码算的覆盖计数（如 9/10） */
function claimNumbers(text: string): number[] {
  const stripped = text
    .replace(/获取时间：[^\n]*?(?=覆盖|$)/g, ' ')
    .replace(/（\d+\/\d+）/g, ' ')
    .replace(/\d{4}[-–]\d{4}/g, ' ')
  return [...stripped.matchAll(/\d+(?:\.\d+)?/g)]
    .map(m => Number(m[0]))
    .filter(n => !(Number.isInteger(n) && n >= 1990 && n <= 2100))
}

describe('SpecRenderer', () => {
  let events: unknown[] = []
  let unsubscribe = () => {}
  beforeEach(() => {
    window.localStorage.clear()
    writePersistedCanvasState(SESSION, { version: 2, widgets: [], layout: [], datasets: [NET_MARGIN] })
    events = []
    unsubscribe = subscribeResearchCanvasEvents(event => { events.push(event) })
  })
  afterEach(() => {
    unsubscribe()
    cleanup()
  })

  it('renders a valid Demo A spec with registered components, datasets side by side', () => {
    renderWithProviders(<SpecRenderer spec={SPEC_DEMO_A} datasets={FIXTURE_DATASETS} fallback={FALLBACK} />)
    expect(screen.queryByText('原预览卡')).toBeNull()
    const blocks = [...document.querySelectorAll('[data-generative-ui-block]')].map(el => el.getAttribute('data-generative-ui-block'))
    expect(blocks).toEqual(['ComparisonView', 'TrendView', 'EvidencePanel'])
    const charts = screen.getAllByTestId('chart').map(el => el.getAttribute('data-dataset'))
    expect(charts).toEqual([NET_MARGIN.id, ROE.id, NET_MARGIN.id])
  })

  it.each(Object.entries(INVALID_SPECS))('rejects the whole spec (%s) and falls back to the old preview', (_name, spec) => {
    renderWithProviders(<SpecRenderer spec={spec} datasets={FIXTURE_DATASETS} fallback={FALLBACK} />)
    expect(screen.getByText('原预览卡')).toBeTruthy()
    expect(document.querySelector('[data-generative-ui-block]')).toBeNull()
  })

  it('largest change is computed by code from the delta dataset; no other numbers appear', () => {
    renderWithProviders(<SpecRenderer spec={SPEC_DEMO_A} datasets={FIXTURE_DATASETS} fallback={FALLBACK} />)
    fireEvent.click(screen.getByRole('button', { name: '看变化最大的年份' }))
    const note = document.querySelector('[data-largest-change]')?.textContent ?? ''
    expect(note).toContain('示例公司乙 2025 年较上年 −4.2 个百分点')
    const allowed = new Set(FIXTURE_DATASETS.flatMap(d => d.data.map(p => Math.abs(p.value ?? NaN))))
    const shown = claimNumbers(document.body.textContent ?? '')
    expect(shown.length).toBeGreaterThan(0)
    for (const n of shown) expect(allowed.has(n), `数字 ${n} 不在任何 Dataset 中`).toBe(true)
    expect(allowed.has(4.2)).toBe(true)
    expect(NET_MARGIN_DELTA.transform).toEqual({ type: 'yoy_delta' })
  })

  it('rendering and actions never touch the board; pin only calls back to the host', () => {
    const onAction = vi.fn()
    renderWithProviders(<SpecRenderer spec={SPEC_DEMO_A} datasets={FIXTURE_DATASETS} fallback={FALLBACK} onAction={onAction} />)
    fireEvent.click(screen.getByRole('button', { name: '看变化最大的年份' }))
    expect(events).toEqual([])
    expect(readPersistedCanvasState(SESSION).widgets).toEqual([])
    fireEvent.click(screen.getAllByRole('button', { name: '钉住' })[0] as HTMLElement)
    expect(onAction).toHaveBeenCalledWith('pin', expect.objectContaining({ component: 'ComparisonView' }))
    expect(events).toEqual([])
    expect(readPersistedCanvasState(SESSION).widgets).toEqual([])
  })

  it('Demo C shows missing cells as gaps and mixed sources as 未标注', () => {
    renderWithProviders(<SpecRenderer spec={SPEC_DEMO_C} datasets={FIXTURE_DATASETS} fallback={FALLBACK} />)
    expect(screen.getByText('示例公司乙：2021 年没有取到')).toBeTruthy()
    expect(evidenceSourceText(ROE)).toBe('来源未标注')
    expect(screen.getByText('2021–2025 年报')).toBeTruthy()
  })
})
