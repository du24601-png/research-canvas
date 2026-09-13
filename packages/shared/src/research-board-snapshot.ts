import {
  RESEARCH_CANVAS_DATASET_LIMIT,
  RESEARCH_CANVAS_WIDGET_LIMIT,
  sanitizeResearchCanvasSnapshot,
  sanitizeResearchCanvasTitle,
  type ResearchCanvasWidgetSnapshot,
} from './research-canvas-protocol.js'
import { sanitizeResearchDataset, type ResearchDataset } from './research-dataset.js'

export interface ResearchBoardSnapshotLayoutItem {
  i: string
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
}

export interface ResearchBoardSnapshotPayload {
  title: string
  widgets: ResearchCanvasWidgetSnapshot[]
  layout: ResearchBoardSnapshotLayoutItem[]
  datasets: ResearchDataset[]
}

const SNAPSHOT_ID_RE = /^[a-f0-9-]{36}$/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sanitizeLayoutItem(raw: unknown): ResearchBoardSnapshotLayoutItem | null {
  if (!isRecord(raw)) return null
  const i = typeof raw.i === 'string' ? raw.i.trim() : ''
  if (!i) return null
  const x = Number(raw.x)
  const y = Number(raw.y)
  const w = Number(raw.w)
  const h = Number(raw.h)
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) {
    return null
  }
  if (w <= 0 || h <= 0) return null
  const minWRaw = raw.minW == null ? undefined : Number(raw.minW)
  const minHRaw = raw.minH == null ? undefined : Number(raw.minH)
  return {
    i,
    x: Math.max(0, Math.round(x)),
    y: Math.max(0, Math.round(y)),
    w: Math.max(1, Math.round(w)),
    h: Math.max(1, Math.round(h)),
    ...(Number.isFinite(minWRaw) ? { minW: Math.max(1, Math.round(minWRaw as number)) } : {}),
    ...(Number.isFinite(minHRaw) ? { minH: Math.max(1, Math.round(minHRaw as number)) } : {}),
  }
}

export function sanitizeResearchBoardSnapshotPayload(raw: unknown): ResearchBoardSnapshotPayload | null {
  if (!isRecord(raw)) return null
  const title = sanitizeResearchCanvasTitle(raw.title)
  if (!title) return null
  const widgetsRaw = Array.isArray(raw.widgets) ? raw.widgets : []
  if (widgetsRaw.length > RESEARCH_CANVAS_WIDGET_LIMIT) return null
  const datasetsRaw = Array.isArray(raw.datasets) ? raw.datasets : []
  if (datasetsRaw.length > RESEARCH_CANVAS_DATASET_LIMIT) return null
  const widgets = sanitizeResearchCanvasSnapshot(raw)
  if (!widgets.length) return null
  const widgetIds = new Set(widgets.map(widget => widget.id))
  const layoutRaw = Array.isArray(raw.layout) ? raw.layout : []
  const layout: ResearchBoardSnapshotLayoutItem[] = []
  const seenLayout = new Set<string>()
  for (const item of layoutRaw) {
    if (layout.length >= RESEARCH_CANVAS_WIDGET_LIMIT) break
    const next = sanitizeLayoutItem(item)
    if (!next || !widgetIds.has(next.i) || seenLayout.has(next.i)) continue
    seenLayout.add(next.i)
    layout.push(next)
  }
  if (!layout.length) return null
  const datasets: ResearchDataset[] = []
  const seenDataset = new Set<string>()
  for (const item of datasetsRaw) {
    if (datasets.length >= RESEARCH_CANVAS_DATASET_LIMIT) break
    const dataset = sanitizeResearchDataset(item)
    if (!dataset || seenDataset.has(dataset.id)) continue
    seenDataset.add(dataset.id)
    datasets.push(dataset)
  }
  if (!datasets.length) return null
  const usedDatasetIds = new Set(widgets.map(widget => widget.datasetId))
  if (!widgets.every(widget => usedDatasetIds.has(widget.datasetId) && datasets.some(d => d.id === widget.datasetId))) {
    return null
  }
  return { title, widgets, layout, datasets }
}

export function isResearchBoardSnapshotId(value: unknown): value is string {
  return typeof value === 'string' && SNAPSHOT_ID_RE.test(value.trim())
}

export function latestBoardSnapshotPeriod(datasets: readonly ResearchDataset[]): string | null {
  let latest: string | null = null
  for (const dataset of datasets) {
    for (const period of dataset.periods) {
      if (!period.trim()) continue
      if (!latest || period > latest) latest = period
    }
  }
  return latest
}
