import { describe, expect, it } from 'vitest'
import type { ChatToolStep } from '../../types/chatProgress'
import {
  buildProgressCounts,
  progressHeading,
  progressRatio,
  resolveProgressActionLabel,
} from './progressLive'

function step(partial: Partial<ChatToolStep> & Pick<ChatToolStep, 'tool'>): ChatToolStep {
  return { id: 's1', label: '查询', status: 'done', startedAt: '2026-10-09T00:00:00.000Z', ...partial }
}

describe('buildProgressCounts', () => {
  it('counts the running step in the total', () => {
    const counts = buildProgressCounts([
      step({ tool: 'query_data' }),
      step({ id: 's2', tool: 'propose_widget', status: 'running' }),
    ])
    expect(counts).toEqual({ done: 1, total: 2 })
    expect(progressRatio(counts)).toBe(0.5)
  })

  it('treats thinking between steps as one pending step and skips synthetic steps', () => {
    expect(buildProgressCounts([])).toEqual({ done: 0, total: 1 })
    expect(buildProgressCounts([
      step({ tool: 'query_data' }),
      step({ id: 's2', tool: 'compose_research_ui' }),
    ])).toEqual({ done: 1, total: 2 })
  })
})

describe('progressHeading', () => {
  it('uses 取数 for research turns', () => {
    expect(progressHeading([])).toBe('取数')
    expect(progressHeading([step({ tool: 'query_data' })])).toBe('取数')
    expect(progressHeading([step({ tool: 'web_search' })])).toBe('分析')
  })
})

describe('resolveProgressActionLabel', () => {
  const running = (args: Record<string, unknown>) => step({
    tool: 'query_data', status: 'running', argsDetail: JSON.stringify(args),
  })

  it('describes the running fetch in investor language', () => {
    expect(resolveProgressActionLabel({
      steps: [running({ entities: ['平安银行'], metric: 'roe', start: '2020', end: '2024' })],
    })).toBe('正在取平安银行 2020–2024 年净资产收益率…')
    expect(resolveProgressActionLabel({
      steps: [running({ entities: ['600519.SH'], metric: 'roe', start: '2019', end: '2024' })],
    })).toBe('正在取 2019–2024 年净资产收益率…')
  })

  it('falls back to the generic status label', () => {
    expect(resolveProgressActionLabel({ steps: [running({ metric: 'unknown_x' })] }))
      .toBe('正在查询研究数据…')
    expect(resolveProgressActionLabel({ steps: [], phaseLabel: '模型正在思考' }))
      .toBe('正在理解你的问题…')
  })
})
