import type { ChatToolStep } from '../types/chatProgress'
import { formatLiveThinkingStatus } from './sessionStreamRuntime'
import { resolveInvestorStatusLabel } from './tracePresentation'

/** 流式执行中：工具级状态文案（面向投资者，无技术术语） */
const TOOL_LIVE_LABELS: Record<string, string> = {
  query_data: '正在查询研究数据',
  refine_dataset: '正在调整研究范围',
  propose_widget: '正在生成研究视图',
  resolve_industry_universe: '正在确认对比公司',
  create_widget: '正在添加研究组件',
  update_widget: '正在更新研究组件',
  ask_user: '等待你的确认',
}

export function liveLabelForRunningStep(step: ChatToolStep): string | undefined {
  const mapped = TOOL_LIVE_LABELS[step.tool]
  if (mapped) return mapped
  const label = step.label?.trim()
  if (label) return label.replace(/[….]+$/u, '')
  return undefined
}

export function resolveLiveTraceStatusLabel(input: {
  phaseLabel?: string
  estimatedTokens?: number
  steps: ChatToolStep[]
  thinkingLabel?: string
}): string | undefined {
  return resolveInvestorStatusLabel({
    phaseLabel: input.phaseLabel,
    steps: input.steps,
  }) ?? input.thinkingLabel
}

export function previewLoadingStageLabel(input: {
  hasProposal: boolean
  hasDataset: boolean
}): string {
  if (!input.hasProposal) return '正在生成研究视图…'
  if (!input.hasDataset) return '正在整理图表数据…'
  return '正在生成研究视图…'
}
