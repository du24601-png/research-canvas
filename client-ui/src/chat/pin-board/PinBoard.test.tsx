import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import type { ChatToolStep } from '../../types/chatProgress'
import { renderWithProviders } from '../../test/testUtils'
import { readPersistedCanvasState, writePersistedCanvasState } from '../research-canvas/layoutStorage'
import { resetActiveWidgetForTests } from '../research-canvas/activeWidgetSelection'
import type { Dataset } from '../research-canvas/types'
import { resolveChatFirstLayout } from './chatFirstLayout'
import { adoptLabels } from './pinLabels'
import { PinBoardProvider } from './PinBoardContext'
import PinBoardButton from './PinBoardButton'
import PinBoardDrawer from './PinBoardDrawer'
import ResearchWidgetPreviewCard from '../research-canvas/ResearchWidgetPreviewCard'

vi.mock('../research-canvas/LineChartWidget', () => ({ default: () => <div>line-preview</div> }))
vi.mock('../workspace/WorkspaceUiContext', () => ({ useWorkspaceUi: () => ({ presentMode: false }) }))
/** 看板里的画布：真实 useResearchCanvas 状态，只把渲染换成标题列表 */
vi.mock('../research-canvas/ResearchCanvas', async () => {
  const { useResearchCanvas } = await import('../research-canvas/useResearchCanvas')
  function BoardCanvasStub({ sessionId }: { sessionId: string | null }) {
    const { widgets } = useResearchCanvas(sessionId)
    return <ul data-testid="board-widgets">{widgets.map(w => <li key={w.id}>{w.title}</li>)}</ul>
  }
  return { default: BoardCanvasStub }
})

const SESSION = 'sess-pin-board'
const DATASET_ID = 'research-ds-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const TITLE = '贵州茅台、五粮液 净利率'

function dataset(): Dataset {
  return {
    id: DATASET_ID,
    title: TITLE,
    metric: 'net_margin',
    unit: '%',
    entities: [{ id: 'CN:SH.600519', name: '贵州茅台', ticker: '600519', market: 'CN', type: 'equity' }],
    periods: ['2024'],
    data: [{ entityId: 'CN:SH.600519', period: '2024', value: 50 }],
    sources: [{ provider: 'tushare', entityId: 'CN:SH.600519', metric: 'net_margin', period: '2024', fetchedAt: '2026-10-09T00:00:00.000Z' }],
  }
}

function step(): ChatToolStep {
  return {
    id: 'call_pin_1',
    tool: 'propose_widget',
    label: '提出研究视图',
    status: 'done',
    startedAt: '2026-10-09T00:00:00.000Z',
    resultDetail: JSON.stringify({ ok: true, proposalId: 'call_pin_1', type: 'line_chart', title: TITLE, datasetId: DATASET_ID }),
  }
}

function ChatFirstTurn() {
  return (
    <PinBoardProvider chatFirst sessionId={SESSION}>
      <PinBoardButton />
      <ResearchWidgetPreviewCard step={step()} sessionId={SESSION} />
      <PinBoardDrawer sessionId={SESSION} />
    </PinBoardProvider>
  )
}

describe('chat-first flag', () => {
  it('defaults on; env or storage can turn it off; storage wins', () => {
    expect(resolveChatFirstLayout(undefined, null)).toBe(true)
    expect(resolveChatFirstLayout('0', null)).toBe(false)
    expect(resolveChatFirstLayout('0', '1')).toBe(true)
    expect(resolveChatFirstLayout(undefined, '0')).toBe(false)
  })

  it('keeps the legacy wording when off', () => {
    expect(adoptLabels(false).adopt).toBe('添加到画布')
    expect(adoptLabels(true).adopt).toBe('钉住')
  })
})

describe('pin to board', () => {
  beforeEach(() => {
    window.localStorage.clear()
    resetActiveWidgetForTests()
    writePersistedCanvasState(SESSION, { version: 2, widgets: [], layout: [], datasets: [dataset()] })
  })
  afterEach(() => cleanup())

  it('nothing reaches the board until the user clicks 钉住', async () => {
    renderWithProviders(<ChatFirstTurn />)
    expect(screen.getByRole('button', { name: '钉住' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '添加到画布' })).toBeNull()
    expect(readPersistedCanvasState(SESSION).widgets).toHaveLength(0)
    expect(screen.getByTestId('board-widgets').children).toHaveLength(0)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '钉住' }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(readPersistedCanvasState(SESSION).widgets).toHaveLength(1)
    expect(screen.getByText('已钉住')).toBeTruthy()
    expect(screen.getByRole('button', { name: '看板，已钉住 1 项' })).toBeTruthy()
  })

  it('chat-first board ignores agent widget_created; legacy canvas still applies it', async () => {
    const { useResearchCanvas } = await import('../research-canvas/useResearchCanvas')
    const { publishResearchCanvasEvent } = await import('../research-canvas/researchCanvasBus')
    const created = { type: 'widget_created', widget: { id: 'w-agent-1', type: 'line_chart', title: TITLE, datasetId: DATASET_ID } }
    function Host({ ignore }: { ignore: boolean }) {
      useResearchCanvas(SESSION, { ignoreAgentCreates: ignore })
      return null
    }
    const first = renderWithProviders(<Host ignore />)
    await act(async () => publishResearchCanvasEvent(created))
    expect(readPersistedCanvasState(SESSION).widgets).toHaveLength(0)
    first.unmount()
    renderWithProviders(<Host ignore={false} />)
    await act(async () => publishResearchCanvasEvent(created))
    expect(readPersistedCanvasState(SESSION).widgets).toHaveLength(1)
  })

  it('board stays closed after pinning and shows the pinned item when opened', async () => {
    const { container } = renderWithProviders(<ChatFirstTurn />)
    const drawer = container.ownerDocument.querySelector('[data-pin-board]')
    if (!drawer) throw new Error('看板抽屉未挂载')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '钉住' }))
    })
    expect(drawer.getAttribute('data-pin-board')).toBe('closed')
    fireEvent.click(screen.getByRole('button', { name: '在看板中查看' }))
    expect(drawer.getAttribute('data-pin-board')).toBe('open')
    expect(screen.getByTestId('board-widgets').textContent).toContain(TITLE)
    fireEvent.click(screen.getByRole('button', { name: '收起' }))
    expect(drawer.getAttribute('data-pin-board')).toBe('closed')
  })
})
