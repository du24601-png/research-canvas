import {
  RESEARCH_CANVAS_WIDGET_TYPES,
  buildResearchViewTitle,
  compactChartStyle,
  compactResearchWidgetView,
  isLegacyMockResearchDatasetId,
  isResearchCanvasWidgetType,
  isResearchViewIntent,
  parseResearchCanvasEvent,
  pickRecommendedView,
  sanitizeChartStyle,
  sanitizeResearchCanvasTitle,
  sanitizeResearchWidgetView,
  widgetTypeShapeWarning,
  type ResearchCanvasEvent,
  type ResearchCanvasWidgetType,
  type ResearchViewIntent,
  type ResearchWidgetProposal,
  type ResearchWidgetView,
} from '@opptrix/shared'
import { randomUUID } from 'node:crypto'
import { currentToolCallId } from './mcp/tool-session-context.js'
import {
  knownTurnDatasetIds,
  requireTurnCanvasState,
  upsertTurnProposal,
} from './research-canvas-turn-state.js'
import { bindChartStyle } from './research-style-bind.js'

const TYPE_ENUM = [...RESEARCH_CANVAS_WIDGET_TYPES]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseType(raw: unknown): ResearchCanvasWidgetType | { error: string } | null {
  if (raw == null || raw === '') return null
  if (!isResearchCanvasWidgetType(raw)) {
    return { error: `type 须为 ${TYPE_ENUM.join(' / ')}` }
  }
  return raw
}

function parseIntent(raw: unknown): ResearchViewIntent | { error: string } | undefined {
  if (raw == null || raw === '') return undefined
  if (!isResearchViewIntent(raw)) {
    return { error: 'intent 须为 trend / rank / compare / composition / price' }
  }
  return raw
}

function parseTitle(raw: unknown): string | { error: string } | null {
  if (raw == null || raw === '') return null
  const title = sanitizeResearchCanvasTitle(raw)
  if (!title) return { error: 'title 不超过 80 字' }
  return title
}

function resolveProposalDatasetId(
  raw: unknown,
  knownIds: ReadonlySet<string>,
): string | { error: string } {
  if (isLegacyMockResearchDatasetId(raw)) return { error: '请先查询真实数据' }
  if (raw != null && raw !== '') {
    if (typeof raw !== 'string' || !knownIds.has(raw)) return { error: 'datasetId 不受支持' }
    return raw
  }
  if (knownIds.size === 1) return [...knownIds][0] ?? ''
  if (knownIds.size === 0) return { error: '请先查询数据，再生成研究视图' }
  return { error: '存在多个数据集，请指定 datasetId' }
}

function mergeView(
  picked: ResearchWidgetView,
  rawParams: unknown,
  intent: ResearchViewIntent | undefined,
): ResearchWidgetView {
  const extra = sanitizeResearchWidgetView(
    isRecord(rawParams) ? { ...rawParams, intent } : { intent },
  )
  return compactResearchWidgetView({
    intent: extra?.intent ?? intent ?? picked.intent,
    period: extra?.period ?? picked.period,
    topN: extra?.topN ?? picked.topN,
  }) ?? picked
}

export function executeProposeWidget(args: Record<string, unknown>): Record<string, unknown> {
  if (!isRecord(args)) return { error: '参数无效' }
  const parsedType = parseType(args.type)
  if (parsedType && typeof parsedType !== 'string') return parsedType
  const parsedTitle = parseTitle(args.title)
  if (parsedTitle && typeof parsedTitle !== 'string') return parsedTitle
  const intent = parseIntent(args.intent)
  if (intent && typeof intent !== 'string') return intent
  const turn = requireTurnCanvasState()
  if ('error' in turn) return turn
  const datasetId = resolveProposalDatasetId(args.datasetId, knownTurnDatasetIds(turn.datasets))
  if (typeof datasetId !== 'string') return datasetId
  const record = turn.records.find(item => item.id === datasetId)
  const picked = record ? pickRecommendedView(record, intent) : null
  const type = parsedType ?? picked?.type
  if (!type) return { error: '请指定 type，或先查询数据' }
  const view = mergeView(
    { intent, period: picked?.params.period, topN: picked?.params.topN },
    args.params,
    intent,
  )
  const suggestedTitle = record
    ? buildResearchViewTitle({
      entityCount: record.entities.length,
      entityNames: record.entities.map(entity => entity.name),
      metric: record.metric,
      type,
      intent: view.intent,
      period: view.period,
      periods: record.periods,
    })
    : ''
  const title = parsedTitle ?? (suggestedTitle || null)
  if (!title) return { error: 'title 必填且不超过 80 字' }
  const compactView = compactResearchWidgetView(view)
  const compactStyle = bindChartStyle(
    compactChartStyle(sanitizeChartStyle(args.style)),
    datasetId,
    turn.records,
  )
  const warning = record ? widgetTypeShapeWarning(type, record) : null
  const proposalId = currentToolCallId() ?? `research-wp-${randomUUID()}`
  const proposal: ResearchWidgetProposal = {
    id: proposalId,
    type,
    title,
    datasetId,
    status: 'ready',
    ...(compactView ? { view: compactView } : {}),
    ...(compactStyle ? { style: compactStyle } : {}),
  }
  upsertTurnProposal(turn.sessionId, proposal)
  const event: ResearchCanvasEvent = { type: 'widget_proposed', proposal }
  return {
    ok: true,
    proposalId,
    type,
    title,
    datasetId,
    suggestedTitle: suggestedTitle || title,
    ...(compactView ? { view: compactView } : {}),
    ...(compactStyle ? { style: compactStyle } : {}),
    ...(warning ? { warning } : {}),
    canvas_event: event,
  }
}

export function extractProposedEvent(result: unknown): ResearchCanvasEvent | null {
  if (!isRecord(result) || result.error) return null
  return parseResearchCanvasEvent(result.canvas_event)
}
