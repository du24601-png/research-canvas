import type { ChatDisplayMessage } from '../../types/chat'
import { getActiveWidgetContext, type ActiveWidgetContext } from './activeWidgetContext'
import { parseToolStepJson } from './proposalFromToolStep'
import { RESEARCH_DATASET_ID_RE, clonePersistedDataset } from './layoutStorage'
import type { ResearchAdjustProposal } from './researchPreviewAdjust'
import type { Dataset, PersistedCanvasState } from './types'

const RECORD_LIMIT = 32
const META_LIMIT = 20

function asDatasetId(value: unknown): string | null {
  return typeof value === 'string' && RESEARCH_DATASET_ID_RE.test(value.trim())
    ? value.trim()
    : null
}

function datasetIdFromJson(raw: Record<string, unknown> | null): string | null {
  if (!raw) return null
  return asDatasetId(raw.datasetId)
}

export function collectSessionDatasetIds(messages: readonly ChatDisplayMessage[]): string[] {
  const ids: string[] = []
  for (const message of messages) {
    for (const step of message.toolSteps ?? []) {
      const fromResult = datasetIdFromJson(parseToolStepJson(step.resultDetail))
      const fromArgs = datasetIdFromJson(parseToolStepJson(step.argsDetail))
      if (fromResult) ids.push(fromResult)
      else if (fromArgs) ids.push(fromArgs)
    }
  }
  return ids
}

function pushUnique(out: string[], seen: Set<string>, raw: string | undefined): void {
  if (!raw || !RESEARCH_DATASET_ID_RE.test(raw) || seen.has(raw)) return
  seen.add(raw)
  out.push(raw)
}

export function rankSessionDatasetIds(input: {
  activeProposalDatasetId?: string
  widgetDatasetIds: readonly string[]
  sessionDatasetIds: readonly string[]
}): string[] {
  const ranked: string[] = []
  const seen = new Set<string>()
  pushUnique(ranked, seen, input.activeProposalDatasetId)
  for (const id of input.widgetDatasetIds) pushUnique(ranked, seen, id)
  for (let i = input.sessionDatasetIds.length - 1; i >= 0; i -= 1) {
    pushUnique(ranked, seen, input.sessionDatasetIds[i])
  }
  return ranked
}

function toMeta(dataset: Dataset) {
  const first = dataset.periods[0] ?? ''
  const last = dataset.periods[dataset.periods.length - 1] ?? first
  return {
    id: dataset.id,
    metric: dataset.metric,
    title: dataset.title,
    entityNames: dataset.entities.map(entity => entity.name),
    periodRange: first === last ? first : `${first}–${last}`,
    ...(dataset.parentDatasetId ? { parentDatasetId: dataset.parentDatasetId } : {}),
  }
}

export function cloneDataset(dataset: Dataset): Dataset {
  return clonePersistedDataset(dataset)
}

export function selectScopedDatasetRecords(
  store: readonly Dataset[],
  rankedIds: readonly string[],
  limit: number,
): Dataset[] {
  const byId = new Map(store.map(dataset => [dataset.id, dataset]))
  const records: Dataset[] = []
  for (const id of rankedIds) {
    if (records.length >= limit) break
    const dataset = byId.get(id)
    if (!dataset) continue
    records.push(clonePersistedDataset(dataset))
  }
  return records
}

export interface ResearchCanvasAgentSnapshot {
  widgets: Array<{ id: string; type: string; title: string; datasetId: string }>
  datasets: ReturnType<typeof toMeta>[]
  datasetRecords: Dataset[]
  activeProposal?: ResearchAdjustProposal
  activeWidget?: ActiveWidgetContext
}

export function buildResearchCanvasAgentSnapshot(input: {
  state: PersistedCanvasState
  messages: readonly ChatDisplayMessage[]
  activeProposal?: ResearchAdjustProposal | null
  activeWidgetId?: string | null
}): ResearchCanvasAgentSnapshot {
  const ranked = rankSessionDatasetIds({
    activeProposalDatasetId: input.activeProposal?.datasetId,
    widgetDatasetIds: input.state.widgets.map(widget => widget.datasetId),
    sessionDatasetIds: collectSessionDatasetIds(input.messages),
  })
  const records = selectScopedDatasetRecords(input.state.datasets, ranked, RECORD_LIMIT)
  const snapshot: ResearchCanvasAgentSnapshot = {
    widgets: input.state.widgets.map(widget => ({
      id: widget.id,
      type: widget.type,
      title: widget.title,
      datasetId: widget.datasetId,
    })),
    datasets: records.slice(0, META_LIMIT).map(toMeta),
    datasetRecords: records,
  }
  if (input.activeProposal) snapshot.activeProposal = input.activeProposal
  const activeWidget = getActiveWidgetContext(
    input.state.widgets,
    input.state.datasets,
    input.activeWidgetId ?? null,
  )
  if (activeWidget) snapshot.activeWidget = activeWidget
  return snapshot
}
