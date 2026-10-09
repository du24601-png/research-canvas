import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import type { ChatToolStep } from '../../types/chatProgress'
import { renderWithProviders } from '../../test/testUtils'
import { registerResearchFetchPlanDraftSink } from '../research-canvas/researchFetchPlanAdjust'
import { publishPlanGate } from './planGateBus'
import LivePlanGateCard, { PLAN_CANCEL_STEER } from './LivePlanGateCard'

const steer = vi.fn(async () => ({ ok: true }))
vi.mock('../../api/client', () => ({ steerSessionChat: (...args: unknown[]) => steer(...(args as [])) }))

const PLAN = { entities: ['贵州茅台', '五粮液'], metric: 'net_margin', metricLabel: '净利率', start: '2021', end: '2025', statement: '查 贵州茅台、五粮液，净利率，2021–2025 年年报', tier: 'auto' as const }
const running: ChatToolStep = { id: 'call_1', tool: 'query_data', label: 'q', status: 'running', startedAt: '' }

describe('LivePlanGateCard', () => {
  afterEach(() => {
    cleanup()
    steer.mockClear()
  })

  it('shows the plan with a countdown; 先别查 sends the stop steer', async () => {
    publishPlanGate({ sessionId: 's1', stepId: 'call_1', plan: PLAN, autoContinueMs: 4000 })
    renderWithProviders(<LivePlanGateCard sessionId="s1" steps={[running]} />)
    expect(screen.getByText(PLAN.statement)).toBeTruthy()
    expect(screen.getByText(/秒后自动开始/)).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '先别查' })) })
    expect(steer).toHaveBeenCalledWith('s1', PLAN_CANCEL_STEER)
    expect(screen.getByText('已请 AI 先停下，等你说明怎么调整。')).toBeTruthy()
  })

  it('修改 stops the fetch and puts the plan into the composer', async () => {
    const drafts: string[] = []
    const off = registerResearchFetchPlanDraftSink(text => drafts.push(text))
    publishPlanGate({ sessionId: 's2', stepId: 'call_1', plan: PLAN, autoContinueMs: 4000 })
    renderWithProviders(<LivePlanGateCard sessionId="s2" steps={[running]} />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: '修改' })) })
    expect(steer).toHaveBeenCalledTimes(1)
    expect(drafts[0]).toContain(PLAN.statement)
    off()
  })

  it('hides once the fetch step finished, and when there is no plan', () => {
    publishPlanGate({ sessionId: 's3', stepId: 'call_1', plan: PLAN, autoContinueMs: 4000 })
    renderWithProviders(<LivePlanGateCard sessionId="s3" steps={[{ ...running, status: 'done' }]} />)
    expect(document.querySelector('[data-plan-gate]')).toBeNull()
    cleanup()
    renderWithProviders(<LivePlanGateCard sessionId="nobody" steps={[]} />)
    expect(document.querySelector('[data-plan-gate]')).toBeNull()
  })
})
