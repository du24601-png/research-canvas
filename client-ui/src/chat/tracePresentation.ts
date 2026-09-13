import type { ChatToolStep } from '../types/chatProgress'
import type { ReasoningSegment } from './reasoningTimeline'

const RESEARCH_DATA_TOOLS = new Set(['query_data', 'refine_dataset', 'resolve_industry_universe'])

const TOOL_LIVE_LABELS: Record<string, string> = {
  query_data: '正在查询研究数据',
  refine_dataset: '正在调整研究范围',
  propose_widget: '正在生成研究视图',
  resolve_industry_universe: '正在确认对比公司',
  create_widget: '正在添加研究组件',
  update_widget: '正在更新研究组件',
  ask_user: '等待你的确认',
}

function liveLabelForRunningStep(step: ChatToolStep): string | undefined {
  const mapped = TOOL_LIVE_LABELS[step.tool]
  if (mapped) return mapped
  const label = step.label?.trim()
  if (label) return label.replace(/[….]+$/u, '')
  return undefined
}

/** 投资者可读的阶段文案（去掉「模型」前缀等技术语感） */
export function morphPhaseLabelForInvestor(phaseLabel: string): string {
  const base = phaseLabel.replace(/[…]+$/u, '').replace(/\.{2,}$/u, '').trim()
  if (base === '模型正在思考') return '正在理解你的问题'
  if (base === '模型正在整理结果') return '正在整理回答'
  if (base === '正在整理消息') return '正在整理回答'
  if (base.startsWith('模型正在')) return base.replace(/^模型正在/u, '正在')
  return base
}

/** live 单行 status：业务语义，不含 token / 步数 */
export function resolveInvestorStatusLabel(input: {
  phaseLabel?: string
  steps: ChatToolStep[]
}): string | undefined {
  const running = input.steps.find(step => step.status === 'running')
  if (running) {
    const toolLabel = liveLabelForRunningStep(running)
    if (toolLabel) return `${toolLabel}…`
  }
  const raw = input.phaseLabel?.trim()
  if (!raw) return undefined
  return `${morphPhaseLabelForInvestor(raw)}…`
}

function pushChip(chips: string[], seen: Set<string>, raw: string) {
  const text = raw.trim()
  if (!text || text.length > 56 || seen.has(text)) return
  seen.add(text)
  chips.push(text)
}

function chipsFromArgsPreview(preview: string, seen: Set<string>, chips: string[]) {
  for (const part of preview.split(/[·•|]/u)) {
    pushChip(chips, seen, part)
  }
}

function chipsFromArgsJson(raw: string | undefined, seen: Set<string>, chips: string[]) {
  if (!raw?.trim()) return
  try {
    const args = JSON.parse(raw) as Record<string, unknown>
    const inst = args.instrument
    if (inst && typeof inst === 'object') {
      const row = inst as Record<string, unknown>
      const symbol = typeof row.symbol === 'string' ? row.symbol.trim() : ''
      const name = typeof row.name === 'string' ? row.name.trim() : ''
      if (symbol && name) pushChip(chips, seen, `${symbol} ${name}`)
      else if (symbol) pushChip(chips, seen, symbol)
    }
    const scope = typeof args.scope === 'string' ? args.scope.trim() : ''
    if (scope) pushChip(chips, seen, scope)
    const datasetKind = typeof args.dataset_kind === 'string' ? args.dataset_kind.trim() : ''
    if (datasetKind) pushChip(chips, seen, datasetKind)
  } catch {
    /* ignore malformed JSON */
  }
}

/** 已完成研究取数步骤 → 溯源 chip（来自 argsPreview / argsDetail） */
export function extractSourceChips(steps: ChatToolStep[]): string[] {
  const chips: string[] = []
  const seen = new Set<string>()
  for (const step of steps) {
    if (step.status !== 'done' || !RESEARCH_DATA_TOOLS.has(step.tool)) continue
    if (step.argsPreview) chipsFromArgsPreview(step.argsPreview, seen, chips)
    chipsFromArgsJson(step.argsDetail, seen, chips)
    if (chips.length >= 8) break
  }
  return chips.slice(0, 8)
}

export function buildTraceReceipt(steps: ChatToolStep[], expandable = false): string | null {
  const queries = steps.filter(s => s.tool === 'query_data' && s.status === 'done').length
  const refines = steps.filter(s => s.tool === 'refine_dataset' && s.status === 'done').length
  const widgets = steps.filter(s => s.tool === 'propose_widget' && s.status === 'done').length
  const dataOps = queries + refines
  if (dataOps === 0 && widgets === 0) return null
  const parts: string[] = ['数据来源']
  if (dataOps > 0) parts.push(`${dataOps} 次查询`)
  if (widgets > 0) parts.push(`${widgets} 张图表`)
  if (expandable) parts.push('展开过程')
  return parts.join(' · ')
}

function truncateSummary(text: string, maxLen: number): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (compact.length <= maxLen) return compact
  const slice = compact.slice(0, maxLen)
  const lastPause = Math.max(slice.lastIndexOf('。'), slice.lastIndexOf('，'), slice.lastIndexOf('. '))
  if (lastPause > maxLen * 0.45) return `${slice.slice(0, lastPause + 1).trim()}…`
  return `${slice.trim()}…`
}

export function computeThinkingDurationSec(segments: ReasoningSegment[]): number | undefined {
  const stamps = segments
    .map(seg => seg.at)
    .filter((iso): iso is string => typeof iso === 'string' && iso.trim().length > 0)
    .map(iso => new Date(iso).getTime())
    .filter(t => !Number.isNaN(t))
  if (stamps.length < 2) return undefined
  return Math.max(1, Math.round((Math.max(...stamps) - Math.min(...stamps)) / 1000))
}

export function buildThinkingSummary(segments: ReasoningSegment[]): {
  line: string
  durationSec?: number
} | null {
  if (!segments.length) return null
  const line = truncateSummary(segments[0].content, 120)
  if (!line) return null
  return { line, durationSec: computeThinkingDurationSec(segments) }
}

export function countHiddenDetailSteps(steps: ChatToolStep[]): number {
  return steps.filter(step => step.tool !== 'propose_widget').length
}
