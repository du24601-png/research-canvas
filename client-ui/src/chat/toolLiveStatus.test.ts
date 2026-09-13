import { describe, expect, it } from 'vitest'
import type { ChatToolStep } from '../types/chatProgress'
import { previewLoadingStageLabel, resolveLiveTraceStatusLabel } from './toolLiveStatus'

function runningStep(tool: string): ChatToolStep {
  return {
    id: 's1',
    tool,
    label: '查询研究数据',
    status: 'running',
    startedAt: '2026-09-12T00:00:00.000Z',
  }
}

describe('resolveLiveTraceStatusLabel', () => {
  it('prioritizes running tool-specific label', () => {
    const label = resolveLiveTraceStatusLabel({
      phaseLabel: '模型正在思考',
      steps: [runningStep('query_data')],
    })
    expect(label).toBe('正在查询研究数据…')
  })

  it('falls back to morphed phase label when no running step', () => {
    const label = resolveLiveTraceStatusLabel({
      phaseLabel: '模型正在整理结果',
      estimatedTokens: 1200,
      steps: [{ ...runningStep('query_data'), status: 'done' }],
    })
    expect(label).toBe('正在整理回答…')
  })
})

describe('previewLoadingStageLabel', () => {
  it('describes proposal vs dataset stages', () => {
    expect(previewLoadingStageLabel({ hasProposal: false, hasDataset: false }))
      .toBe('正在生成研究视图…')
    expect(previewLoadingStageLabel({ hasProposal: true, hasDataset: false }))
      .toBe('正在整理图表数据…')
  })
})
