import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import type { ChatDisplayMessage, MessageSelection, SessionContextRef } from '../../types/chat'
import type { ChatToolStep } from '../../types/chatProgress'
import { renderWithProviders } from '../../test/testUtils'
import { writePersistedCanvasState } from '../../chat/research-canvas/layoutStorage'
import { PinBoardProvider } from '../../chat/pin-board/PinBoardContext'
import ResearchTurnUi from '../ResearchTurnUi'
import { NET_MARGIN, ROE } from '../specFixtures'
import { ReportFollowupProvider, TurnIndexProvider } from './ReportFollowupContext'
import {
  REPORT_FOLLOWUP_STORAGE_KEY,
  describeBlockForQuote,
  followupOrigin,
  readFollowupLinks,
  recordFollowupOnSubmit,
  resolveReportVersions,
} from './reportVersions'

vi.mock('../../chat/research-canvas/LineChartWidget', () => ({ default: () => <div data-testid="chart" /> }))

const SESSION = 'sess-followup'

function compose(spec: unknown, id: string): ChatToolStep {
  return { id, tool: 'compose_research_ui', label: 'c', status: 'done', startedAt: '2026-10-09T00:00:00.000Z', resultDetail: JSON.stringify({ ok: true, spec }) }
}

const V1 = compose({ version: 1, blocks: [{ component: 'ComparisonView', datasetIds: [NET_MARGIN.id, ROE.id] }] }, 'c1')
const V2 = compose({ version: 1, blocks: [{ component: 'TrendView', datasetId: ROE.id }] }, 'c2')

const MESSAGES: ChatDisplayMessage[] = [
  { role: 'user', content: '对比净利率和 ROE', at: 't0' },
  { role: 'assistant', content: '回答一', at: 't1', toolSteps: [V1] },
  { role: 'user', content: '只看 ROE 的走势', at: 't2' },
  { role: 'assistant', content: '回答二', at: 't3', toolSteps: [V2] },
]

const SELECTION: SessionContextRef = {
  kind: 'selection', selectedText: '…', sourceMessageIndex: 1, sourceRole: 'assistant', anchorAt: 't1', preview: '…', turns: [],
}

function Chat({ quote = () => {} }: { quote?: (selection: MessageSelection) => void }) {
  return (
    <PinBoardProvider chatFirst sessionId={SESSION}>
      <ReportFollowupProvider sessionId={SESSION} messages={MESSAGES} quote={quote} scrollTo={() => {}}>
        {MESSAGES.map((m, i) => m.role === 'assistant' ? (
          <div key={m.at} data-turn={i}>
            <TurnIndexProvider index={i}>
              <ResearchTurnUi steps={m.toolSteps ?? []} sessionId={SESSION}><div>原预览卡</div></ResearchTurnUi>
            </TurnIndexProvider>
          </div>
        ) : null)}
      </ReportFollowupProvider>
    </PinBoardProvider>
  )
}

describe('report follow-up (M4b)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    writePersistedCanvasState(SESSION, { version: 2, widgets: [], layout: [], datasets: [NET_MARGIN, ROE] })
  })
  afterEach(() => cleanup())

  it('links a follow-up to the quoted answer; unmatched links are ignored', () => {
    const versions = resolveReportVersions(MESSAGES, [{ sourceAt: 't1', question: '只看 ROE 的走势' }, { sourceAt: 't1', question: '没发过' }])
    expect(versions.get(1)).toEqual([{ version: 1, messageIndex: 1 }, { version: 2, messageIndex: 3, question: '只看 ROE 的走势' }])
    expect(followupOrigin(versions, 3)).toEqual({ sourceIndex: 1, version: 2 })
    expect(followupOrigin(versions, 1)).toBeNull()
  })

  it('records only when the switch is on and the quote is from an answer', () => {
    recordFollowupOnSubmit(SESSION, SELECTION, '只看 ROE 的走势')
    expect(readFollowupLinks(SESSION)).toEqual([])
    window.localStorage.setItem(REPORT_FOLLOWUP_STORAGE_KEY, '1')
    recordFollowupOnSubmit(SESSION, { ...SELECTION, sourceRole: 'user' }, '只看 ROE 的走势')
    recordFollowupOnSubmit(SESSION, null, '只看 ROE 的走势')
    expect(readFollowupLinks(SESSION)).toEqual([])
    recordFollowupOnSubmit(SESSION, SELECTION, '  只看 ROE 的走势 ')
    expect(readFollowupLinks(SESSION)).toEqual([{ sourceAt: 't1', question: '只看 ROE 的走势' }])
  })

  it('quote text for a component carries names, metrics and periods but no values', () => {
    const text = describeBlockForQuote({ component: 'TrendView', datasetId: ROE.id }, id => (id === ROE.id ? ROE : undefined))
    expect(text).toContain('示例公司甲')
    expect(text).toContain('2021–2025')
    expect(text.replace(/20\d{2}/g, '')).not.toMatch(/\d/)
  })

  it('switch off: no follow-up buttons, no versions', () => {
    window.localStorage.setItem('finframe.reportFollowups.' + SESSION, JSON.stringify([{ sourceAt: 't1', question: '只看 ROE 的走势' }]))
    renderWithProviders(<Chat />)
    expect(screen.queryByText('追问这部分')).toBeNull()
    expect(document.querySelector('[data-report-versions]')).toBeNull()
  })

  it('switch on: quote a component, show v2 on the old report, keep v1, compare side by side', () => {
    window.localStorage.setItem(REPORT_FOLLOWUP_STORAGE_KEY, '1')
    window.localStorage.setItem('finframe.reportFollowups.' + SESSION, JSON.stringify([{ sourceAt: 't1', question: '只看 ROE 的走势' }]))
    const quoted: MessageSelection[] = []
    renderWithProviders(<Chat quote={selection => quoted.push(selection)} />)
    const source = document.querySelector('[data-turn="1"]') as HTMLElement
    expect(source.querySelector('[data-report-version="2"] [data-generative-ui-block="TrendView"]')).toBeTruthy()
    expect(source.querySelector('[data-generative-ui-block="ComparisonView"]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'v1 原始' }))
    expect(source.querySelector('[data-report-version="1"] [data-generative-ui-block="ComparisonView"]')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '并排对比' }))
    expect(source.querySelectorAll('[data-report-compare] [data-report-version]').length).toBe(2)
    expect(document.querySelector('[data-turn="3"] [data-report-followup-origin="2"]')).toBeTruthy()
    fireEvent.click(source.querySelector('[data-report-followup="ComparisonView"]') as HTMLElement)
    expect(quoted[0]).toMatchObject({ messageIndex: 1, messageRole: 'assistant' })
  })
})
