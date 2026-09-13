/**
 * Research Canvas Agent protocol — widget snapshot, dataset metadata, canvas events.
 * Full Dataset numeric rows may appear only on dataset_created SSE, never in LLM tool results.
 */

import {
  compactChartStyle,
  mergeChartStyle,
  sanitizeChartStyle,
  type ChartStyle,
} from './research-chart-style.js'
import {
  compactResearchWidgetView,
  sanitizeResearchWidgetView,
  type ResearchWidgetView,
} from './research-view-params.js'
import {
  isKnownResearchCanvasDatasetId,
  isLegacyMockResearchDatasetId,
  isResearchDatasetId,
  sanitizeResearchDataset,
  sanitizeResearchDatasetMeta,
  type ResearchCanvasDatasetMeta,
  type ResearchDataset,
} from './research-dataset.js'

export const RESEARCH_CANVAS_WIDGET_TYPES = [
  'line_chart',
  'bar_chart',
  'grouped_bar',
  'stacked_bar',
  'stacked_bar_percent',
  'combo_bar_line',
  'pie_chart',
  'donut_chart',
  'candlestick',
  'heatmap_table',
  'table',
  'sources',
] as const
export type ResearchCanvasWidgetType = (typeof RESEARCH_CANVAS_WIDGET_TYPES)[number]

/** @deprecated Phase 2 mock id — real query_data datasets must use research-ds-<uuid> */
export const RESEARCH_CANVAS_DATASET_ID = 'ds-tire-gross-margin-2021-2025'
export const RESEARCH_CANVAS_TITLE_MAX = 80
export const RESEARCH_CANVAS_WIDGET_LIMIT = 50
export const RESEARCH_CANVAS_DATASET_LIMIT = 20
export const RESEARCH_WIDGET_PROPOSAL_STATUSES = ['ready', 'accepted', 'dismissed'] as const
export type ResearchWidgetProposalStatus = (typeof RESEARCH_WIDGET_PROPOSAL_STATUSES)[number]

export interface ResearchCanvasWidgetSnapshot {
  id: string
  type: ResearchCanvasWidgetType
  title: string
  datasetId: string
  view?: ResearchWidgetView
  style?: ChartStyle
}

export interface ResearchWidgetProposal {
  id: string
  type: ResearchCanvasWidgetType
  title: string
  datasetId: string
  status: ResearchWidgetProposalStatus
  view?: ResearchWidgetView
  style?: ChartStyle
}

export interface ResearchCanvasActiveProposal {
  proposalId: string
  type: ResearchCanvasWidgetType
  title: string
  datasetId: string
}

export interface ResearchCanvasActiveWidget {
  widgetId: string
  type: ResearchCanvasWidgetType
  title: string
  datasetId?: string
  subject?: {
    ticker?: string
    companyName?: string
  }
  period?: {
    from?: string
    to?: string
  }
  metrics?: string[]
}

export type ResearchCanvasEvent =
  | { type: 'widget_created'; widget: ResearchCanvasWidgetSnapshot }
  | {
    type: 'widget_updated'
    id: string
    patch: Partial<Pick<ResearchCanvasWidgetSnapshot, 'type' | 'title' | 'datasetId' | 'view' | 'style'>>
  }
  | { type: 'widget_deleted'; id: string }
  | { type: 'dataset_created'; dataset: ResearchDataset }
  | { type: 'widget_proposed'; proposal: ResearchWidgetProposal }

const WIDGET_TYPE_SET = new Set<string>(RESEARCH_CANVAS_WIDGET_TYPES)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isResearchCanvasWidgetType(value: unknown): value is ResearchCanvasWidgetType {
  return typeof value === 'string' && WIDGET_TYPE_SET.has(value)
}

export function isAllowedResearchCanvasDatasetId(
  value: unknown,
  knownIds?: ReadonlySet<string>,
): value is string {
  return isKnownResearchCanvasDatasetId(value, knownIds)
}

export function sanitizeResearchCanvasTitle(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const title = value.trim()
  if (!title || title.length > RESEARCH_CANVAS_TITLE_MAX) return null
  return title
}

export function sanitizeResearchCanvasDatasets(raw: unknown): ResearchCanvasDatasetMeta[] {
  if (!isRecord(raw) || !Array.isArray(raw.datasets)) return []
  const seen = new Set<string>()
  const datasets: ResearchCanvasDatasetMeta[] = []
  for (const item of raw.datasets) {
    if (datasets.length >= RESEARCH_CANVAS_DATASET_LIMIT) break
    const meta = sanitizeResearchDatasetMeta(item)
    if (!meta || seen.has(meta.id) || isLegacyMockResearchDatasetId(meta.id)) continue
    seen.add(meta.id)
    datasets.push(meta)
  }
  return datasets
}

/** Fail-soft: drop illegal items; cap at 50; keep first occurrence of each id. */
export function sanitizeResearchCanvasSnapshot(raw: unknown): ResearchCanvasWidgetSnapshot[] {
  if (!isRecord(raw) || !Array.isArray(raw.widgets)) return []
  const knownIds = new Set(sanitizeResearchCanvasDatasets(raw).map(item => item.id))
  const seen = new Set<string>()
  const widgets: ResearchCanvasWidgetSnapshot[] = []
  for (const item of raw.widgets) {
    if (widgets.length >= RESEARCH_CANVAS_WIDGET_LIMIT) break
    const widget = sanitizeSnapshotWidget(item, knownIds)
    if (!widget || seen.has(widget.id)) continue
    seen.add(widget.id)
    widgets.push(widget)
  }
  return widgets
}

function sanitizeProposalId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const id = value.trim()
  if (id.length < 8 || id.length > 128) return null
  if (!/^[A-Za-z0-9:_-]+$/.test(id)) return null
  return id
}

export function sanitizeResearchWidgetProposal(
  raw: unknown,
  knownIds?: ReadonlySet<string>,
): ResearchWidgetProposal | null {
  if (!isRecord(raw)) return null
  const id = sanitizeProposalId(raw.id)
  if (!id) return null
  if (!isResearchCanvasWidgetType(raw.type)) return null
  const title = sanitizeResearchCanvasTitle(raw.title)
  if (!title) return null
  if (!isResearchDatasetId(raw.datasetId)) return null
  if (knownIds && !knownIds.has(raw.datasetId)) return null
  const status: ResearchWidgetProposalStatus = raw.status === 'accepted' || raw.status === 'dismissed'
    ? raw.status
    : 'ready'
  const proposal: ResearchWidgetProposal = { id, type: raw.type, title, datasetId: raw.datasetId, status }
  const view = compactResearchWidgetView(sanitizeResearchWidgetView(raw.view))
  if (view) proposal.view = view
  const style = compactChartStyle(sanitizeChartStyle(raw.style))
  if (style) proposal.style = style
  return proposal
}

export function sanitizeResearchCanvasActiveProposal(
  raw: unknown,
): ResearchCanvasActiveProposal | null {
  if (!isRecord(raw)) return null
  const proposalId = sanitizeProposalId(raw.proposalId)
  if (!proposalId) return null
  if (!isResearchCanvasWidgetType(raw.type)) return null
  const title = sanitizeResearchCanvasTitle(raw.title)
  if (!title) return null
  if (!isResearchDatasetId(raw.datasetId)) return null
  return { proposalId, type: raw.type, title, datasetId: raw.datasetId }
}

function optionalTrimmed(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  return text ? text : undefined
}

export function sanitizeResearchCanvasActiveWidget(
  raw: unknown,
): ResearchCanvasActiveWidget | null {
  if (!isRecord(raw)) return null
  const widgetId = optionalTrimmed(raw.widgetId)
  if (!widgetId || widgetId.length > 128) return null
  if (!isResearchCanvasWidgetType(raw.type)) return null
  const title = sanitizeResearchCanvasTitle(raw.title)
  if (!title) return null
  const context: ResearchCanvasActiveWidget = { widgetId, type: raw.type, title }
  const datasetId = optionalTrimmed(raw.datasetId)
  if (datasetId) context.datasetId = datasetId
  if (isRecord(raw.subject)) {
    const ticker = optionalTrimmed(raw.subject.ticker)
    const companyName = optionalTrimmed(raw.subject.companyName)
    if (ticker || companyName) {
      context.subject = {
        ...(ticker ? { ticker } : {}),
        ...(companyName ? { companyName } : {}),
      }
    }
  }
  if (isRecord(raw.period)) {
    const from = optionalTrimmed(raw.period.from)
    const to = optionalTrimmed(raw.period.to)
    if (from || to) {
      context.period = {
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      }
    }
  }
  if (Array.isArray(raw.metrics)) {
    const metrics = raw.metrics
      .filter((item): item is string => typeof item === 'string')
      .map(item => item.trim())
      .filter(Boolean)
      .slice(0, 8)
    if (metrics.length) context.metrics = metrics
  }
  return context
}

function sanitizeSnapshotWidget(
  raw: unknown,
  knownIds?: ReadonlySet<string>,
): ResearchCanvasWidgetSnapshot | null {
  if (!isRecord(raw)) return null
  const id = typeof raw.id === 'string' ? raw.id.trim() : ''
  if (!id) return null
  if (!isResearchCanvasWidgetType(raw.type)) return null
  const title = sanitizeResearchCanvasTitle(raw.title)
  if (!title) return null
  if (!isAllowedResearchCanvasDatasetId(raw.datasetId, knownIds)) return null
  const widget: ResearchCanvasWidgetSnapshot = { id, type: raw.type, title, datasetId: raw.datasetId }
  const view = compactResearchWidgetView(sanitizeResearchWidgetView(raw.view))
  if (view) widget.view = view
  const style = compactChartStyle(sanitizeChartStyle(raw.style))
  if (style) widget.style = style
  return widget
}

function sanitizeWidgetPatch(raw: unknown): Partial<Pick<ResearchCanvasWidgetSnapshot, 'type' | 'title' | 'datasetId' | 'view' | 'style'>> | null {
  if (!isRecord(raw)) return null
  const patch: Partial<Pick<ResearchCanvasWidgetSnapshot, 'type' | 'title' | 'datasetId' | 'view' | 'style'>> = {}
  if ('type' in raw) {
    if (!isResearchCanvasWidgetType(raw.type)) return null
    patch.type = raw.type
  }
  if ('title' in raw) {
    const title = sanitizeResearchCanvasTitle(raw.title)
    if (!title) return null
    patch.title = title
  }
  if ('datasetId' in raw) {
    if (!isAllowedResearchCanvasDatasetId(raw.datasetId)) return null
    patch.datasetId = raw.datasetId
  }
  if ('view' in raw) {
    const view = compactResearchWidgetView(sanitizeResearchWidgetView(raw.view))
    if (view) patch.view = view
  }
  if ('style' in raw) {
    const style = compactChartStyle(sanitizeChartStyle(raw.style))
    if (style) patch.style = style
  }
  return Object.keys(patch).length ? patch : null
}

export { mergeChartStyle, sanitizeChartStyle, compactChartStyle, type ChartStyle }

export function parseResearchCanvasEvent(raw: unknown): ResearchCanvasEvent | null {
  if (!isRecord(raw) || typeof raw.type !== 'string') return null
  if (raw.type === 'dataset_created') {
    const dataset = sanitizeResearchDataset(raw.dataset)
    if (!dataset) return null
    return { type: 'dataset_created', dataset }
  }
  if (raw.type === 'widget_created') {
    const widget = sanitizeSnapshotWidget(raw.widget)
    if (!widget) return null
    return { type: 'widget_created', widget }
  }
  if (raw.type === 'widget_updated') {
    if (typeof raw.id !== 'string' || !raw.id.trim()) return null
    const patch = sanitizeWidgetPatch(raw.patch)
    if (!patch) return null
    return { type: 'widget_updated', id: raw.id.trim(), patch }
  }
  if (raw.type === 'widget_deleted') {
    if (typeof raw.id !== 'string' || !raw.id.trim()) return null
    return { type: 'widget_deleted', id: raw.id.trim() }
  }
  if (raw.type === 'widget_proposed') {
    const proposal = sanitizeResearchWidgetProposal(raw.proposal)
    if (!proposal) return null
    return { type: 'widget_proposed', proposal }
  }
  return null
}
