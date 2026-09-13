import {
  mergeChartStyle,
  sanitizeChartStyle,
  sanitizeResearchCanvasTitle,
  type ResearchCanvasEvent,
  type ResearchWidgetProposal,
} from '@opptrix/shared'
import { compactResearchWidgetView, sanitizeResearchWidgetView } from '@opptrix/shared/research-view-params'
import {
  requireTurnCanvasState,
  upsertTurnProposal,
} from './research-canvas-turn-state.js'
import { bindChartStyle } from './research-style-bind.js'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function resolveProposalId(
  raw: unknown,
  proposals: readonly ResearchWidgetProposal[],
): string | { error: string } {
  if (typeof raw === 'string' && raw.trim()) {
    const id = raw.trim()
    if (proposals.some(item => item.id === id)) return id
    return { error: '预览不存在' }
  }
  const ready = proposals.filter(item => item.status === 'ready')
  if (ready.length === 1) return ready[0]?.id ?? ''
  if (ready.length === 0) return { error: '当前没有可调整的研究预览' }
  return { error: '存在多个预览，请指定 proposalId' }
}

export function executeUpdateProposal(args: Record<string, unknown>): Record<string, unknown> {
  if (!isRecord(args)) return { error: '参数无效' }
  const turn = requireTurnCanvasState()
  if ('error' in turn) return turn
  const proposalId = resolveProposalId(args.proposalId, turn.proposals)
  if (typeof proposalId !== 'string') return proposalId
  const current = turn.proposals.find(item => item.id === proposalId)
  if (!current || current.status !== 'ready') return { error: '预览不存在或已处理' }

  const next: ResearchWidgetProposal = { ...current }
  if ('title' in args) {
    const title = sanitizeResearchCanvasTitle(args.title)
    if (!title) return { error: 'title 无效' }
    next.title = title
  }
  if ('style' in args) {
    const stylePatch = bindChartStyle(
      sanitizeChartStyle(args.style),
      current.datasetId,
      turn.records,
    )
    if (!stylePatch) return { error: 'style 无效' }
    const merged = mergeChartStyle(current.style, stylePatch)
    if (merged) next.style = merged
    else delete next.style
  }
  if ('view' in args) {
    const view = compactResearchWidgetView(sanitizeResearchWidgetView(args.view))
    if (view) next.view = view
    else delete next.view
  }
  if (!('title' in args) && !('style' in args) && !('view' in args)) {
    return { error: '至少提供 title、style 或 view 之一' }
  }

  upsertTurnProposal(turn.sessionId, next)
  const event: ResearchCanvasEvent = { type: 'widget_proposed', proposal: next }
  return {
    ok: true,
    proposalId: next.id,
    title: next.title,
    datasetId: next.datasetId,
    type: next.type,
    ...(next.view ? { view: next.view } : {}),
    ...(next.style ? { style: next.style } : {}),
    canvas_event: event,
  }
}
