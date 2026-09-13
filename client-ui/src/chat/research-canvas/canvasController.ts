import { compactChartStyle, sanitizeChartStyle } from '@opptrix/shared/research-chart-style'
import { compactResearchWidgetView, sanitizeResearchWidgetView } from '@opptrix/shared/research-view-params'
import { MOCK_GROSS_MARGIN_DATASET } from './mockGrossMarginDataset'
import { adoptProposalIntoState } from './adoptProposal'
import type { Dataset, PersistedCanvasState, Widget, WidgetType } from './types'
import { WIDGET_TYPE_SET } from './types'
import { placeNewWidgetLayout } from './layoutPlacement'
import {
  normalizeResearchDataset,
  RESEARCH_DATASET_ID_RE,
  resolveDatasetFromState,
  syncLayoutItems,
} from './layoutStorage'
import { cloneDataset } from './sessionDatasetSnapshot'

export const RESEARCH_CANVAS_TITLE_MAX = 80

const WIDGET_TYPES = WIDGET_TYPE_SET

export type ResearchCanvasEvent =
  | { type: 'widget_created'; widget: Widget }
  | { type: 'widget_updated'; id: string; patch: Partial<Pick<Widget, 'type' | 'title' | 'datasetId' | 'view' | 'style'>> }
  | { type: 'widget_deleted'; id: string }
  | { type: 'dataset_created'; dataset: Dataset }
  | {
    type: 'widget_proposed'
    proposal: { id: string; type: WidgetType; title: string; datasetId: string; status?: string; view?: Widget['view']; style?: Widget['style'] }
  }
  | {
    type: 'widget_adopted'
    proposal: { id: string; type: WidgetType; title: string; datasetId: string; view?: Widget['view']; style?: Widget['style'] }
  }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isWidgetType(value: unknown): value is WidgetType {
  return typeof value === 'string' && WIDGET_TYPES.has(value as WidgetType)
}

function isAllowedDatasetId(value: unknown, knownIds: ReadonlySet<string>): value is string {
  if (value === MOCK_GROSS_MARGIN_DATASET.id) return true
  return typeof value === 'string' && knownIds.has(value) && RESEARCH_DATASET_ID_RE.test(value)
}

function sanitizeTitle(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const title = value.trim()
  if (!title || title.length > RESEARCH_CANVAS_TITLE_MAX) return null
  return title
}

function sanitizeWidget(raw: unknown, knownIds: ReadonlySet<string>): Widget | null {
  if (!isRecord(raw)) return null
  if (typeof raw.id !== 'string' || !raw.id.trim()) return null
  if (!isWidgetType(raw.type)) return null
  const title = sanitizeTitle(raw.title)
  if (!title) return null
  if (!isAllowedDatasetId(raw.datasetId, knownIds)) return null
  const widget: Widget = {
    id: raw.id.trim(),
    type: raw.type,
    title,
    datasetId: raw.datasetId,
  }
  const view = compactResearchWidgetView(sanitizeResearchWidgetView(raw.view))
  if (view) widget.view = view
  const style = compactChartStyle(sanitizeChartStyle(raw.style))
  if (style) widget.style = style
  return widget
}

function sanitizeProposal(
  raw: unknown,
  knownIds: ReadonlySet<string>,
  requireKnownDataset: boolean,
): { id: string; type: WidgetType; title: string; datasetId: string; view?: Widget['view'] } | null {
  if (!isRecord(raw)) return null
  if (typeof raw.id !== 'string' || !raw.id.trim()) return null
  if (!isWidgetType(raw.type)) return null
  const title = sanitizeTitle(raw.title)
  if (!title) return null
  if (typeof raw.datasetId !== 'string' || !RESEARCH_DATASET_ID_RE.test(raw.datasetId)) return null
  if (requireKnownDataset && !knownIds.has(raw.datasetId)) return null
  const proposal: { id: string; type: WidgetType; title: string; datasetId: string; view?: Widget['view']; style?: Widget['style'] } = {
    id: raw.id.trim(),
    type: raw.type,
    title,
    datasetId: raw.datasetId,
  }
  const view = compactResearchWidgetView(sanitizeResearchWidgetView(raw.view))
  if (view) proposal.view = view
  const style = compactChartStyle(sanitizeChartStyle(raw.style))
  if (style) proposal.style = style
  return proposal
}

export function parseResearchCanvasEvent(
  raw: unknown,
  knownIds: ReadonlySet<string> = new Set(),
): ResearchCanvasEvent | null {
  if (!isRecord(raw) || typeof raw.type !== 'string') return null
  if (raw.type === 'dataset_created') {
    const dataset = normalizeResearchDataset(raw.dataset)
    if (!dataset) return null
    return { type: 'dataset_created', dataset }
  }
  if (raw.type === 'widget_created') {
    const widget = sanitizeWidget(raw.widget, knownIds)
    if (!widget) return null
    return { type: 'widget_created', widget }
  }
  if (raw.type === 'widget_updated') {
    if (typeof raw.id !== 'string' || !raw.id.trim()) return null
    if (!isRecord(raw.patch)) return null
    const patch: Partial<Pick<Widget, 'type' | 'title' | 'datasetId' | 'view' | 'style'>> = {}
    if ('type' in raw.patch) {
      if (!isWidgetType(raw.patch.type)) return null
      patch.type = raw.patch.type
    }
    if ('title' in raw.patch) {
      const title = sanitizeTitle(raw.patch.title)
      if (!title) return null
      patch.title = title
    }
    if ('datasetId' in raw.patch) {
      if (!isAllowedDatasetId(raw.patch.datasetId, knownIds)) return null
      patch.datasetId = raw.patch.datasetId
    }
    if ('view' in raw.patch) {
      const view = compactResearchWidgetView(sanitizeResearchWidgetView(raw.patch.view))
      if (view) patch.view = view
    }
    if ('style' in raw.patch) {
      const style = compactChartStyle(sanitizeChartStyle(raw.patch.style))
      if (style) patch.style = style
    }
    if (!Object.keys(patch).length) return null
    return { type: 'widget_updated', id: raw.id.trim(), patch }
  }
  if (raw.type === 'widget_deleted') {
    if (typeof raw.id !== 'string' || !raw.id.trim()) return null
    return { type: 'widget_deleted', id: raw.id.trim() }
  }
  if (raw.type === 'widget_proposed') {
    const proposal = sanitizeProposal(raw.proposal, knownIds, false)
    if (!proposal) return null
    return { type: 'widget_proposed', proposal }
  }
  if (raw.type === 'widget_adopted') {
    const proposal = sanitizeProposal(raw.proposal, knownIds, true)
    if (!proposal) return null
    return { type: 'widget_adopted', proposal }
  }
  return null
}

function cloneState(state: PersistedCanvasState): PersistedCanvasState {
  return {
    version: 2,
    widgets: state.widgets.map(widget => ({ ...widget })),
    layout: state.layout.map(item => ({ ...item })),
    datasets: state.datasets.map(dataset => cloneDataset(dataset)),
    acceptedProposalIds: [...(state.acceptedProposalIds ?? [])],
  }
}

/** Client authority: reject events that do not match live canvas state. */
export function applyResearchCanvasEvent(
  state: PersistedCanvasState,
  rawEvent: unknown,
): PersistedCanvasState | null {
  const knownIds = new Set(state.datasets.map(dataset => dataset.id))
  const event = parseResearchCanvasEvent(rawEvent, knownIds)
  if (!event) return null

  if (event.type === 'widget_proposed') return null

  if (event.type === 'dataset_created') {
    if (event.dataset.id === MOCK_GROSS_MARGIN_DATASET.id) return null
    const datasets = [
      ...state.datasets.filter(dataset => dataset.id !== event.dataset.id),
      event.dataset,
    ]
    return { ...cloneState(state), datasets }
  }

  if (event.type === 'widget_adopted') {
    return adoptProposalIntoState(state, event.proposal)
  }

  if (event.type === 'widget_created') {
    if (state.widgets.some(widget => widget.id === event.widget.id)) return null
    if (state.layout.some(item => item.i === event.widget.id)) return null
    if (!resolveDatasetFromState(state, event.widget.datasetId)) return null
    const next = cloneState(state)
    return {
      ...next,
      widgets: [...state.widgets, { ...event.widget }],
      layout: [...state.layout, placeNewWidgetLayout(state.layout, event.widget)],
    }
  }

  if (event.type === 'widget_updated') {
    const index = state.widgets.findIndex(widget => widget.id === event.id)
    if (index < 0) return null
    if (event.patch.datasetId && !resolveDatasetFromState(state, event.patch.datasetId)) return null
    const next = cloneState(state)
    return {
      ...next,
      widgets: state.widgets.map(widget => (
        widget.id === event.id ? { ...widget, ...event.patch } : widget
      )),
    }
  }

  const exists = state.widgets.some(widget => widget.id === event.id)
  if (!exists) return null
  const widgets = state.widgets.filter(widget => widget.id !== event.id)
  const next = cloneState(state)
  return {
    ...next,
    widgets,
    layout: syncLayoutItems(state.layout, widgets),
  }
}
