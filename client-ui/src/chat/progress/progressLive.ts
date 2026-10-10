import type { ChatToolStep } from '../../types/chatProgress'
import { parseToolStepJson } from '../research-canvas/proposalFromToolStep'
import { resolveInvestorStatusLabel } from '../tracePresentation'
import { formatYearRange, readableMetricLabel } from './progressSummary'

/** 界面组装的合成步骤，不算一步 */
const SYNTHETIC_TOOLS = new Set(['compose_research_ui'])
const RESEARCH_TOOLS = new Set(['query_data', 'refine_dataset', 'propose_widget', 'resolve_industry_universe'])
const ACTION_NAME_LIMIT = 2

export interface ProgressCounts {
  done: number
  total: number
}

/**
 * 进度卡右上角「已完成 / 总步数」。总步数事先不可知：
 * 运行中的步骤算在总数里；模型在两步之间思考时，把「下一步」记为 1 步待完成。
 */
export function buildProgressCounts(steps: ChatToolStep[]): ProgressCounts {
  const counted = steps.filter(step => !SYNTHETIC_TOOLS.has(step.tool))
  const done = counted.filter(step => step.status !== 'running').length
  const hasRunning = counted.length > done
  return { done, total: hasRunning ? counted.length : done + 1 }
}

export function progressRatio(counts: ProgressCounts): number {
  if (counts.total <= 0) return 0
  return Math.min(1, Math.max(0, counts.done / counts.total))
}

/** 进度卡左上角标题：研究取数用「取数」，其他任务用「分析」 */
export function progressHeading(steps: ChatToolStep[]): string {
  if (!steps.length) return '取数'
  return steps.some(step => RESEARCH_TOOLS.has(step.tool)) ? '取数' : '分析'
}

function queryActionLabel(step: ChatToolStep): string | undefined {
  const args = parseToolStepJson(step.argsDetail)
  if (!args) return undefined
  const metric = readableMetricLabel(typeof args.metric === 'string' ? args.metric.trim() : '')
  if (!metric) return undefined
  const start = typeof args.start === 'string' ? args.start.trim() : ''
  const end = typeof args.end === 'string' ? args.end.trim() : ''
  const range = formatYearRange(start, end)
  const entities = Array.isArray(args.entities)
    ? args.entities.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
  // 只是代码（如 600519.SH）时不展示，避免出现投资者看不懂的编号
  const readable = entities.length > 0 && entities.length <= ACTION_NAME_LIMIT
    && entities.every(item => !/^[0-9A-Za-z.]+$/.test(item.trim()))
  const names = readable ? entities.map(item => item.trim()).join('、') : ''
  const when = range ? ` ${range} 年` : ''
  return `正在取${names}${when}${metric}…`
}

/** 进度卡的一行当前动作（投资者语言） */
export function resolveProgressActionLabel(input: {
  phaseLabel?: string
  steps: ChatToolStep[]
}): string | undefined {
  const running = input.steps.find(step => step.status === 'running')
  if (running?.tool === 'query_data') {
    const label = queryActionLabel(running)
    if (label) return label
  }
  return resolveInvestorStatusLabel(input)
}
