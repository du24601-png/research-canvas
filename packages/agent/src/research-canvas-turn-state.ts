import {
  sanitizeResearchCanvasActiveProposal,
  sanitizeResearchCanvasActiveWidget,
  sanitizeResearchCanvasDatasets,
  sanitizeResearchCanvasSnapshot,
  sanitizeResearchDataset,
  toResearchDatasetMeta,
  RESEARCH_CANVAS_DATASET_LIMIT,
  RESEARCH_CANVAS_DATASET_RECORD_LIMIT,
  type ResearchCanvasActiveProposal,
  type ResearchCanvasActiveWidget,
  type ResearchCanvasDatasetMeta,
  type ResearchCanvasEvent,
  type ResearchCanvasWidgetSnapshot,
  type ResearchDataset,
  type ResearchWidgetProposal,
} from '@opptrix/shared'
import { currentToolSessionId } from './mcp/tool-session-context.js'

export interface ResearchCanvasTurnState {
  widgets: ResearchCanvasWidgetSnapshot[]
  datasets: ResearchCanvasDatasetMeta[]
  records: ResearchDataset[]
  proposals: ResearchWidgetProposal[]
  activeProposal: ResearchCanvasActiveProposal | null
  activeWidget: ResearchCanvasActiveWidget | null
}

const turnStates = new Map<string, ResearchCanvasTurnState>()

function emptyTurnState(): ResearchCanvasTurnState {
  return {
    widgets: [],
    datasets: [],
    records: [],
    proposals: [],
    activeProposal: null,
    activeWidget: null,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hydrateRecords(raw: unknown): ResearchDataset[] {
  if (!isRecord(raw) || !Array.isArray(raw.datasetRecords)) return []
  const records: ResearchDataset[] = []
  const seen = new Set<string>()
  for (const item of raw.datasetRecords) {
    if (records.length >= RESEARCH_CANVAS_DATASET_RECORD_LIMIT) break
    const dataset = sanitizeResearchDataset(item)
    if (!dataset || seen.has(dataset.id)) continue
    seen.add(dataset.id)
    records.push(dataset)
  }
  return records
}

function metaFromRecords(records: ResearchDataset[]): ResearchCanvasDatasetMeta[] {
  const metas: ResearchCanvasDatasetMeta[] = []
  const seen = new Set<string>()
  for (const dataset of records) {
    if (metas.length >= RESEARCH_CANVAS_DATASET_LIMIT) break
    if (seen.has(dataset.id)) continue
    seen.add(dataset.id)
    metas.push(toResearchDatasetMeta(dataset))
  }
  return metas
}

export function beginResearchCanvasTurn(sessionId: string, snapshot: unknown): void {
  const id = sessionId.trim()
  if (!id) return
  const widgets = sanitizeResearchCanvasSnapshot(snapshot)
  const records = hydrateRecords(snapshot)
  const datasets = records.length
    ? metaFromRecords(records)
    : sanitizeResearchCanvasDatasets(snapshot)
  turnStates.set(id, {
    widgets,
    datasets,
    records,
    proposals: [],
    activeProposal: isRecord(snapshot)
      ? sanitizeResearchCanvasActiveProposal(snapshot.activeProposal)
      : null,
    activeWidget: isRecord(snapshot)
      ? sanitizeResearchCanvasActiveWidget(snapshot.activeWidget)
      : null,
  })
}

export function endResearchCanvasTurn(sessionId: string): void {
  const id = sessionId.trim()
  if (!id) return
  turnStates.delete(id)
}

export function getTurnCanvasWidgets(sessionId: string): ResearchCanvasWidgetSnapshot[] | null {
  const id = sessionId.trim()
  if (!id) return null
  return turnStates.get(id)?.widgets ?? null
}

export function getTurnCanvasDatasets(sessionId: string): ResearchCanvasDatasetMeta[] | null {
  const id = sessionId.trim()
  if (!id) return null
  return turnStates.get(id)?.datasets ?? null
}

export function getTurnCanvasRecords(sessionId: string): ResearchDataset[] | null {
  const id = sessionId.trim()
  if (!id) return null
  return turnStates.get(id)?.records ?? null
}

export function getTurnCanvasProposals(sessionId: string): ResearchWidgetProposal[] | null {
  const id = sessionId.trim()
  if (!id) return null
  return turnStates.get(id)?.proposals ?? null
}

export function getTurnCanvasActiveProposal(
  sessionId: string,
): ResearchCanvasActiveProposal | null {
  const id = sessionId.trim()
  if (!id) return null
  return turnStates.get(id)?.activeProposal ?? null
}

export function getTurnCanvasActiveWidget(
  sessionId: string,
): ResearchCanvasActiveWidget | null {
  const id = sessionId.trim()
  if (!id) return null
  return turnStates.get(id)?.activeWidget ?? null
}

export function requireTurnCanvasState():
  | { error: string }
  | {
    sessionId: string
    widgets: ResearchCanvasWidgetSnapshot[]
    datasets: ResearchCanvasDatasetMeta[]
    records: ResearchDataset[]
    proposals: ResearchWidgetProposal[]
    activeProposal: ResearchCanvasActiveProposal | null
    activeWidget: ResearchCanvasActiveWidget | null
  } {
  const sessionId = currentToolSessionId()?.trim()
  if (!sessionId) return { error: '当前会话不可用' }
  const state = turnStates.get(sessionId)
  if (!state) return { error: '研究画布本轮状态未就绪' }
  return {
    sessionId,
    widgets: state.widgets,
    datasets: state.datasets,
    records: state.records,
    proposals: state.proposals,
    activeProposal: state.activeProposal,
    activeWidget: state.activeWidget,
  }
}

export function requireTurnCanvasWidgets():
  | { error: string }
  | { sessionId: string; widgets: ResearchCanvasWidgetSnapshot[] } {
  const turn = requireTurnCanvasState()
  if ('error' in turn) return turn
  return { sessionId: turn.sessionId, widgets: turn.widgets }
}

export function knownTurnDatasetIds(datasets: readonly ResearchCanvasDatasetMeta[]): Set<string> {
  return new Set(datasets.map(item => item.id))
}

export function applyTurnCanvasEvent(
  widgets: ResearchCanvasWidgetSnapshot[],
  event: ResearchCanvasEvent,
): ResearchCanvasWidgetSnapshot[] {
  if (event.type === 'dataset_created' || event.type === 'widget_proposed') return widgets
  if (event.type === 'widget_created') {
    return [...widgets, { ...event.widget }]
  }
  if (event.type === 'widget_updated') {
    return widgets.map(widget => (
      widget.id === event.id ? { ...widget, ...event.patch } : widget
    ))
  }
  return widgets.filter(widget => widget.id !== event.id)
}

export function replaceTurnCanvasWidgets(
  sessionId: string,
  widgets: ResearchCanvasWidgetSnapshot[],
): void {
  const current = turnStates.get(sessionId) ?? emptyTurnState()
  turnStates.set(sessionId, { ...current, widgets })
}

export function replaceTurnCanvasDatasets(
  sessionId: string,
  datasets: ResearchCanvasDatasetMeta[],
): void {
  const current = turnStates.get(sessionId) ?? emptyTurnState()
  turnStates.set(sessionId, { ...current, datasets })
}

export function upsertTurnDatasetRecord(sessionId: string, dataset: ResearchDataset): void {
  const current = turnStates.get(sessionId) ?? emptyTurnState()
  const records = [...current.records.filter(item => item.id !== dataset.id), dataset]
  const meta = toResearchDatasetMeta(dataset)
  const datasets = [...current.datasets.filter(item => item.id !== meta.id), meta]
  turnStates.set(sessionId, { ...current, records, datasets })
}

export function upsertTurnProposal(sessionId: string, proposal: ResearchWidgetProposal): void {
  const current = turnStates.get(sessionId)
  if (!current) return
  turnStates.set(sessionId, {
    ...current,
    proposals: [...current.proposals.filter(item => item.id !== proposal.id), proposal],
  })
}

export function upsertTurnDatasetFromEvent(event: ResearchCanvasEvent): void {
  if (event.type !== 'dataset_created') return
  const sessionId = currentToolSessionId()?.trim()
  if (!sessionId) return
  upsertTurnDatasetRecord(sessionId, event.dataset)
}
