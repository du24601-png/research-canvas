import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import type { ChatToolStep } from '../../types/chatProgress'
import { renderWithProviders } from '../../test/testUtils'
import { writePersistedCanvasState, readPersistedCanvasState } from './layoutStorage'
import { publishResearchCanvasEvent } from './researchCanvasBus'
import { resetActiveWidgetForTests, getActiveWidgetId } from './activeWidgetSelection'
import { useResearchCanvas } from './useResearchCanvas'
import type { Dataset } from './types'

const TEST_SESSION = 'sess-test-canvas'

vi.mock('./LineChartWidget', () => ({
  default: (props: { style?: { series?: Record<string, { color?: string }> } }) => (
    <div data-testid="line-preview" data-style={JSON.stringify(props.style ?? null)}>line-preview</div>
  ),
}))
vi.mock('./BarChartWidget', () => ({ default: () => <div>bar-preview</div> }))
vi.mock('./GroupedBarChartWidget', () => ({ default: () => <div>grouped-preview</div> }))
vi.mock('./TableWidget', () => ({ default: () => <div>table-preview</div> }))
vi.mock('./SourcesWidget', () => ({ default: () => <div>sources-preview</div> }))
vi.mock('./HeatmapWidget', () => ({ default: () => <div>heatmap-preview</div> }))
vi.mock('./ExtraChartWidgets', () => ({
  StackedBarChartWidget: () => <div>stacked-preview</div>,
  ComboBarLineChartWidget: () => <div>combo-preview</div>,
  PieDonutChartWidget: () => <div>pie-preview</div>,
  CandlestickChartWidget: () => <div>candle-preview</div>,
}))

const DATASET_ID = 'research-ds-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function dataset(): Dataset {
  return {
    id: DATASET_ID,
    title: 'Operating margin',
    metric: 'gross_margin',
    unit: '%',
    entities: [{
      id: 'CN:SH.601058',
      name: 'Microsoft',
      ticker: 'MSFT',
      market: 'CN',
      type: 'equity',
    }],
    periods: ['2022', '2026'],
    data: [{ entityId: 'CN:SH.601058', period: '2022', value: 40 }],
    sources: [{
      provider: 'tushare',
      entityId: 'CN:SH.601058',
      metric: 'gross_margin',
      period: '2022',
      fetchedAt: '2026-09-10T00:00:00.000Z',
    }],
  }
}

function step(): ChatToolStep {
  return {
    id: 'call_compare_google',
    tool: 'propose_widget',
    label: '提出研究视图',
    status: 'done',
    startedAt: '2026-09-10T00:00:00.000Z',
    resultDetail: JSON.stringify({
      ok: true,
      proposalId: 'call_compare_google',
      type: 'line_chart',
      title: 'Microsoft vs Google Operating Margin',
      datasetId: DATASET_ID,
    }),
  }
}

describe('create widget proposal card', () => {
  beforeEach(() => {
    window.localStorage.clear()
    resetActiveWidgetForTests()
    writePersistedCanvasState(TEST_SESSION, {
      version: 2,
      widgets: [],
      layout: [],
      datasets: [dataset()],
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the proposal and cancel leaves the canvas unchanged', async () => {
    const { default: Preview } = await import('./ResearchWidgetPreviewCard')
    renderWithProviders(<Preview step={step()} sessionId={TEST_SESSION} />)
    expect(screen.getByText('Microsoft vs Google Operating Margin')).toBeTruthy()
    expect(screen.getByText(/2022/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.queryByText('Microsoft vs Google Operating Margin')).toBeNull()
    expect(readPersistedCanvasState(TEST_SESSION).widgets).toEqual([])
  })

  it('confirm adds the widget, uses preferred placement, and selects it', async () => {
    const { default: Preview } = await import('./ResearchWidgetPreviewCard')
    function Bound() {
      useResearchCanvas(TEST_SESSION)
      return <Preview step={step()} sessionId={TEST_SESSION} />
    }
    renderWithProviders(<Bound />)
    fireEvent.click(screen.getByRole('button', { name: '添加到画布' }))
    const persisted = readPersistedCanvasState(TEST_SESSION)
    expect(persisted.widgets).toHaveLength(1)
    expect(persisted.widgets[0]?.title).toBe('Microsoft vs Google Operating Margin')
    expect(persisted.widgets[0]?.sourceProposalId).toBe('call_compare_google')
    expect(persisted.layout[0]).toMatchObject({ x: 0, y: 0, w: 8, h: 10 })
    expect(getActiveWidgetId()).toBe(persisted.widgets[0]?.id)
    expect(screen.getByText('已添加到画布')).toBeTruthy()
  })

  it('carries preview style to canvas on adopt', async () => {
    const { default: Preview } = await import('./ResearchWidgetPreviewCard')
    function Bound() {
      useResearchCanvas(TEST_SESSION)
      return <Preview step={step()} sessionId={TEST_SESSION} />
    }
    renderWithProviders(<Bound />)
    await act(async () => {
      publishResearchCanvasEvent({
        type: 'widget_proposed',
        proposal: {
          id: 'call_compare_google',
          type: 'line_chart',
          title: 'Microsoft vs Google Operating Margin',
          datasetId: DATASET_ID,
          status: 'ready',
          style: { series: { 'CN:SH.601058': { color: '#EA580C' } } },
        },
      })
    })
    fireEvent.click(screen.getByRole('button', { name: '添加到画布' }))
    expect(readPersistedCanvasState(TEST_SESSION).widgets[0]?.style?.series?.['CN:SH.601058']?.color).toBe('#EA580C')
  })

  it('applies preview style updates from update_proposal without adopt', async () => {
    const { default: Preview } = await import('./ResearchWidgetPreviewCard')
    renderWithProviders(<Preview step={step()} sessionId={TEST_SESSION} />)
    await act(async () => {
      publishResearchCanvasEvent({
        type: 'widget_proposed',
        proposal: {
          id: 'call_compare_google',
          type: 'line_chart',
          title: 'Microsoft vs Google Operating Margin',
          datasetId: DATASET_ID,
          status: 'ready',
          style: {
            legend: { position: 'right' },
            series: {
              'CN:SH.601058': { color: '#2563EB' },
            },
          },
        },
      })
    })
    const plot = await screen.findByTestId('line-preview')
    const style = JSON.parse(plot.getAttribute('data-style') ?? 'null') as {
      series?: Record<string, { color?: string }>
    }
    expect(style.series?.['CN:SH.601058']?.color).toBe('#2563EB')
    expect(readPersistedCanvasState(TEST_SESSION).widgets).toEqual([])
  })

  it('shows add again after the canvas widget is deleted', async () => {
    const { default: Preview } = await import('./ResearchWidgetPreviewCard')
    function Bound() {
      const { handleDeleteWidget } = useResearchCanvas(TEST_SESSION)
      return (
        <>
          <Preview step={step()} sessionId={TEST_SESSION} />
          <button type="button" onClick={() => handleDeleteWidget(readPersistedCanvasState(TEST_SESSION).widgets[0]?.id ?? '')}>
            删除画布图
          </button>
        </>
      )
    }
    renderWithProviders(<Bound />)
    fireEvent.click(screen.getByRole('button', { name: '添加到画布' }))
    expect(screen.getByText('已添加到画布')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '删除画布图' }))
    expect(readPersistedCanvasState(TEST_SESSION).widgets).toHaveLength(0)
    expect(screen.getByRole('button', { name: '添加到画布' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '添加到画布' }))
    expect(readPersistedCanvasState(TEST_SESSION).widgets).toHaveLength(1)
    expect(screen.getByText('已添加到画布')).toBeTruthy()
  })
})
