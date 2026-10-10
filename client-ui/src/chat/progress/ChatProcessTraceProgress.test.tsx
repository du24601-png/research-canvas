import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import type { ChatToolStep } from '../../types/chatProgress'
import { renderWithProviders } from '../../test/testUtils'
import { PinBoardProvider } from '../pin-board/PinBoardContext'
import ChatProcessTrace from '../ChatProcessTrace'

vi.mock('../../generative-ui/ResearchTurnUi', () => ({ default: () => null }))
vi.mock('../plan-gate/LivePlanGateCard', () => ({ default: () => null }))

afterEach(cleanup)

const runningStep: ChatToolStep = {
  id: 'q1',
  tool: 'query_data',
  label: '查询研究数据',
  status: 'running',
  startedAt: '2026-10-09T00:00:00.000Z',
  argsDetail: JSON.stringify({ entities: ['平安银行'], metric: 'roe', start: '2020', end: '2024' }),
}

const doneStep: ChatToolStep = {
  ...runningStep,
  status: 'done',
  resultDetail: JSON.stringify({
    ok: true,
    datasetId: 'research-ds-22222222-2222-4222-8222-222222222222',
    metric: 'roe',
    coverage: { filled: 4, total: 5 },
    series: [{ name: '平安银行' }],
  }),
}

function renderTrace(chatFirst: boolean, steps: ChatToolStep[], live: boolean) {
  return renderWithProviders(
    <PinBoardProvider chatFirst={chatFirst} sessionId={null}>
      <ChatProcessTrace steps={steps} live={live} phaseLabel="模型正在思考" />
    </PinBoardProvider>,
  )
}

describe('ChatProcessTrace progress card B', () => {
  it('shows step count and the current action while running', () => {
    const { container } = renderTrace(true, [runningStep], true)
    expect(container.querySelector('[data-progress-card="b"]')).not.toBeNull()
    expect(screen.getByText('0 / 1')).toBeTruthy()
    expect(screen.getByText('正在取平安银行 2020–2024 年净资产收益率…')).toBeTruthy()
    expect(screen.queryByText('收起')).toBeNull()
  })

  it('collapses to one summary line when done, expandable by clicking it', () => {
    renderTrace(true, [doneStep], false)
    expect(screen.getByText('已查完')).toBeTruthy()
    expect(screen.getByText('净资产收益率 2020–2024')).toBeTruthy()
    expect(screen.getByText('缺 1 项数据')).toBeTruthy()
    expect(screen.queryByText(/数据来源/)).toBeNull()
    expect(screen.queryByText('展开详细过程')).toBeNull()
    fireEvent.click(screen.getByText('已查完'))
    expect(screen.getByText('查询研究数据')).toBeTruthy()
  })

  it('keeps the legacy receipt when chat-first is off', () => {
    renderTrace(false, [doneStep], false)
    expect(screen.getByText('数据来源 · 1 次查询 · 展开过程')).toBeTruthy()
    expect(screen.getByText('展开详细过程')).toBeTruthy()
    expect(screen.queryByText('已查完')).toBeNull()
  })
})
