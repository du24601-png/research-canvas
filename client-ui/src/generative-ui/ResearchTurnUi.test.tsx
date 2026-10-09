import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import type { ChatToolStep } from '../types/chatProgress'
import { renderWithProviders } from '../test/testUtils'
import { readPersistedCanvasState, writePersistedCanvasState } from '../chat/research-canvas/layoutStorage'
import { subscribeResearchCanvasEvents } from '../chat/research-canvas/researchCanvasBus'
import { registerResearchFetchPlanDraftSink } from '../chat/research-canvas/researchFetchPlanAdjust'
import { PinBoardProvider } from '../chat/pin-board/PinBoardContext'
import { COMPOSER_STORAGE_KEY } from '../chat/pin-board/chatFirstLayout'
import { applyChatProgressEvent } from '../chat/sessionStreamRuntime'
import ResearchTurnUi from './ResearchTurnUi'
import { NET_MARGIN, ROE } from './specFixtures'

vi.mock('../chat/research-canvas/LineChartWidget', () => ({ default: () => <div data-testid="chart" /> }))

const SESSION = 'sess-turn-ui'
const SPEC = {
  version: 1,
  blocks: [
    { component: 'ComparisonView', datasetIds: [NET_MARGIN.id, ROE.id], actions: ['pin', 'rerun'] },
    { component: 'EvidencePanel', datasetIds: [NET_MARGIN.id, ROE.id] },
  ],
}

function step(tool: string, result: unknown, id = tool): ChatToolStep {
  return { id, tool, label: tool, status: 'done', startedAt: '2026-10-09T00:00:00.000Z', resultDetail: JSON.stringify(result) }
}

const PROPOSAL = step('propose_widget', { ok: true, proposalId: 'call_p1', type: 'line_chart', title: '净利率走势', datasetId: NET_MARGIN.id }, 'call_p1')
const COMPOSE = step('compose_research_ui', { ok: true, spec: SPEC, datasetIds: [NET_MARGIN.id, ROE.id] })

function Turn({ steps, chatFirst = true }: { steps: ChatToolStep[]; chatFirst?: boolean }) {
  return (
    <PinBoardProvider chatFirst={chatFirst} sessionId={SESSION}>
      <ResearchTurnUi steps={steps} sessionId={SESSION}><div>原预览卡</div></ResearchTurnUi>
    </PinBoardProvider>
  )
}

describe('ResearchTurnUi', () => {
  let events: unknown[] = []
  let off = () => {}
  beforeEach(() => {
    window.localStorage.clear()
    writePersistedCanvasState(SESSION, { version: 2, widgets: [], layout: [], datasets: [NET_MARGIN, ROE] })
    events = []
    off = subscribeResearchCanvasEvents(event => { events.push(event) })
  })
  afterEach(() => {
    off()
    cleanup()
  })

  it('old cards until a spec arrives, then the spec replaces them', () => {
    const { rerender } = renderWithProviders(<Turn steps={[PROPOSAL]} />)
    expect(screen.getByText('原预览卡')).toBeTruthy()
    rerender(<Turn steps={[PROPOSAL, COMPOSE]} />)
    expect(screen.queryByText('原预览卡')).toBeNull()
    expect(document.querySelector('[data-generative-ui-block="ComparisonView"]')).toBeTruthy()
  })

  it('keeps old cards when chat-first is off, composer is off, or the spec is invalid', () => {
    renderWithProviders(<Turn steps={[PROPOSAL, COMPOSE]} chatFirst={false} />)
    expect(screen.getByText('原预览卡')).toBeTruthy()
    cleanup()
    window.localStorage.setItem(COMPOSER_STORAGE_KEY, '0')
    renderWithProviders(<Turn steps={[PROPOSAL, COMPOSE]} />)
    expect(screen.getByText('原预览卡')).toBeTruthy()
    cleanup()
    window.localStorage.removeItem(COMPOSER_STORAGE_KEY)
    const bad = step('compose_research_ui', { ok: true, spec: { version: 1, blocks: [{ component: 'TrendView', datasetId: 'research-ds-missing' }] } })
    renderWithProviders(<Turn steps={[PROPOSAL, bad]} />)
    expect(screen.getByText('原预览卡')).toBeTruthy()
  })

  it('pin writes only on click, reusing this turn\'s proposal; rerun only drafts text', () => {
    const drafts: string[] = []
    const unregister = registerResearchFetchPlanDraftSink(text => drafts.push(text))
    renderWithProviders(<Turn steps={[PROPOSAL, COMPOSE]} />)
    expect(events).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: '钉住' }))
    const adopted = events.filter(e => (e as { type?: string }).type === 'widget_adopted') as Array<{ proposal: { id: string; datasetId: string } }>
    expect(adopted.map(e => e.proposal.id)).toEqual(['call_p1', `spec-pin-${ROE.id}`])
    fireEvent.click(screen.getByRole('button', { name: '再查一次' }))
    expect(drafts[0]).toContain('再查一次：')
    expect(readPersistedCanvasState(SESSION).widgets).toEqual([])
    unregister()
  })

  it('stream runtime stores research_ui_spec as a step of the live turn', () => {
    const base = applyChatProgressEvent({ liveTrace: null } as never, { type: 'tool_start', step: { ...PROPOSAL, status: 'running' } })
    const next = applyChatProgressEvent(base, { type: 'research_ui_spec', step: COMPOSE })
    expect(next.liveTrace?.steps.map(s => s.tool)).toEqual(['propose_widget', 'compose_research_ui'])
    expect(applyChatProgressEvent(next, { type: 'research_ui_spec', step: COMPOSE })).toBe(next)
  })
})
