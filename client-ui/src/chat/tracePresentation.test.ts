import { describe, expect, it } from 'vitest'
import type { ChatToolStep } from '../types/chatProgress'
import {
  buildTraceReceipt,
  buildThinkingSummary,
  extractSourceChips,
  morphPhaseLabelForInvestor,
  resolveInvestorStatusLabel,
} from './tracePresentation'

function doneStep(partial: Partial<ChatToolStep> & Pick<ChatToolStep, 'tool'>): ChatToolStep {
  return {
    id: 's1',
    label: '查询研究数据',
    status: 'done',
    startedAt: '2026-09-12T00:00:00.000Z',
    ...partial,
  }
}

describe('morphPhaseLabelForInvestor', () => {
  it('maps internal phase labels', () => {
    expect(morphPhaseLabelForInvestor('模型正在思考')).toBe('正在理解你的问题')
    expect(morphPhaseLabelForInvestor('正在整理消息')).toBe('正在整理回答')
  })
})

describe('resolveInvestorStatusLabel', () => {
  it('prioritizes running tool label without token noise', () => {
    const label = resolveInvestorStatusLabel({
      phaseLabel: '模型正在思考',
      steps: [{
        id: '1',
        tool: 'query_data',
        label: 'x',
        status: 'running',
        startedAt: '2026-09-12T00:00:00.000Z',
      }],
    })
    expect(label).toBe('正在查询研究数据…')
  })

  it('morphs idle phase label', () => {
    const label = resolveInvestorStatusLabel({
      phaseLabel: '模型正在整理结果',
      steps: [],
    })
    expect(label).toBe('正在整理回答…')
  })
})

describe('extractSourceChips', () => {
  it('parses argsPreview segments', () => {
    const chips = extractSourceChips([
      doneStep({
        tool: 'query_data',
        argsPreview: '600519 茅台 · 利润表 · 近5年',
      }),
    ])
    expect(chips).toContain('600519 茅台')
    expect(chips).toContain('利润表')
  })
})

describe('buildTraceReceipt', () => {
  it('summarizes queries and widgets', () => {
    const text = buildTraceReceipt([
      doneStep({ tool: 'query_data' }),
      doneStep({ id: 's2', tool: 'propose_widget', label: '生成视图' }),
    ], true)
    expect(text).toBe('数据来源 · 1 次查询 · 1 张图表 · 展开过程')
  })
})

describe('buildThinkingSummary', () => {
  it('truncates first segment', () => {
    const summary = buildThinkingSummary([
      { content: '先确定对比公司，再查询利润表并生成柱状图。', at: '2026-09-12T00:00:01.000Z' },
      { content: '第二段', at: '2026-09-12T00:00:13.000Z' },
    ])
    expect(summary?.line).toContain('先确定对比公司')
    expect(summary?.durationSec).toBe(12)
  })
})
