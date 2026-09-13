import { compactChartStyle, sanitizeChartStyle } from '@opptrix/shared/research-chart-style'
import { compactResearchWidgetView, sanitizeResearchWidgetView } from '@opptrix/shared/research-view-params'
import { MOCK_GROSS_MARGIN_DATASET } from './mockGrossMarginDataset'
import type {
  CanvasLayoutItem,
  Dataset,
  PersistedCanvasState,
  ResearchDataPoint,
  ResearchEntity,
  ResearchOhlcBar,
  ResearchSource,
  Widget,
  WidgetType,
} from './types'
import { WIDGET_TYPE_SET } from './types'

export const RESEARCH_CANVAS_STORAGE_KEY = 'opptrix.research-canvas.v1'
export const RESEARCH_DATASET_ID_RE = /^research-ds-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const WIDGET_TYPES = WIDGET_TYPE_SET
const METRIC_IDS = new Set([
  'gross_margin', 'revenue', 'revenue_growth', 'net_income', 'net_margin', 'roe', 'kline',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeWidget(raw: unknown): Widget | null {
  if (!isRecord(raw)) return null
  const { id, type, title, datasetId, sourceProposalId } = raw
  if (typeof id !== 'string' || !id.trim()) return null
  if (typeof type !== 'string' || !WIDGET_TYPES.has(type as WidgetType)) return null
  if (typeof title !== 'string' || !title.trim()) return null
  if (typeof datasetId !== 'string' || !datasetId.trim()) return null
  const widget: Widget = {
    id: id.trim(),
    type: type as WidgetType,
    title: title.trim(),
    datasetId: datasetId.trim(),
  }
  if (typeof sourceProposalId === 'string' && sourceProposalId.trim()) {
    widget.sourceProposalId = sourceProposalId.trim()
  }
  const view = compactResearchWidgetView(sanitizeResearchWidgetView(raw.view))
  if (view) widget.view = view
  const style = compactChartStyle(sanitizeChartStyle(raw.style))
  if (style) widget.style = style
  return widget
}

function normalizeLayoutItem(raw: unknown): CanvasLayoutItem | null {
  if (!isRecord(raw)) return null
  const { i, x, y, w, h, minW, minH } = raw
  if (typeof i !== 'string' || !i.trim()) return null
  if (typeof x !== 'number' || !Number.isFinite(x)) return null
  if (typeof y !== 'number' || !Number.isFinite(y)) return null
  if (typeof w !== 'number' || !Number.isFinite(w)) return null
  if (typeof h !== 'number' || !Number.isFinite(h)) return null
  const item: CanvasLayoutItem = {
    i: i.trim(),
    x: Math.max(0, Math.round(x)),
    y: Math.max(0, Math.round(y)),
    w: Math.max(1, Math.round(w)),
    h: Math.max(1, Math.round(h)),
  }
  if (typeof minW === 'number' && Number.isFinite(minW)) item.minW = Math.max(1, Math.round(minW))
  if (typeof minH === 'number' && Number.isFinite(minH)) item.minH = Math.max(1, Math.round(minH))
  return item
}

function normalizeEntity(raw: unknown): ResearchEntity | null {
  if (!isRecord(raw)) return null
  const id = typeof raw.id === 'string' ? raw.id.trim() : ''
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  const ticker = typeof raw.ticker === 'string' ? raw.ticker.trim() : ''
  if (!id || !name || raw.market !== 'CN') return null
  if (raw.type === 'group') {
    if (!Array.isArray(raw.memberIds) || !raw.memberIds.length) return null
    const memberIds = raw.memberIds
      .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
      .map(item => item.trim())
    if (!memberIds.length) return null
    return { id, name, ticker: ticker || id, market: 'CN', type: 'group', memberIds }
  }
  if (raw.type !== 'equity' || !ticker) return null
  return { id, name, ticker, market: 'CN', type: 'equity' }
}

function normalizePoint(raw: unknown, entityIds: ReadonlySet<string>): ResearchDataPoint | null {
  if (!isRecord(raw)) return null
  const entityId = typeof raw.entityId === 'string' ? raw.entityId.trim() : ''
  const period = typeof raw.period === 'string' ? raw.period.trim() : ''
  if (!entityId || !period || !entityIds.has(entityId)) return null
  if (raw.value === null) return { entityId, period, value: null }
  if (typeof raw.value !== 'number' || !Number.isFinite(raw.value)) return null
  return { entityId, period, value: raw.value }
}

function normalizeOhlc(raw: unknown, entityIds: ReadonlySet<string>): ResearchOhlcBar | null {
  if (!isRecord(raw)) return null
  const entityId = typeof raw.entityId === 'string' ? raw.entityId.trim() : ''
  const time = typeof raw.time === 'string' ? raw.time.trim() : ''
  if (!entityId || !time || !entityIds.has(entityId)) return null
  if (![raw.open, raw.high, raw.low, raw.close].every(value => typeof value === 'number' && Number.isFinite(value))) {
    return null
  }
  const bar: ResearchOhlcBar = {
    entityId,
    time,
    open: raw.open as number,
    high: raw.high as number,
    low: raw.low as number,
    close: raw.close as number,
  }
  if (raw.volume === null) bar.volume = null
  else if (typeof raw.volume === 'number' && Number.isFinite(raw.volume)) bar.volume = raw.volume
  return bar
}

function normalizeSource(raw: unknown, entityIds: ReadonlySet<string>): ResearchSource | null {
  if (!isRecord(raw)) return null
  const entityId = typeof raw.entityId === 'string' ? raw.entityId.trim() : ''
  const metric = typeof raw.metric === 'string' ? raw.metric.trim() : ''
  const fetchedAt = typeof raw.fetchedAt === 'string' ? raw.fetchedAt.trim() : ''
  if (!entityId || !metric || !fetchedAt || !entityIds.has(entityId)) return null
  const provider = typeof raw.provider === 'string' && raw.provider.trim()
    ? raw.provider.trim()
    : 'unknown'
  const source: ResearchSource = { provider, entityId, metric, fetchedAt }
  if (typeof raw.period === 'string' && raw.period.trim()) source.period = raw.period.trim()
  if (typeof raw.sourceUrl === 'string' && raw.sourceUrl.trim()) source.sourceUrl = raw.sourceUrl.trim()
  return source
}

export function normalizeResearchDataset(raw: unknown): Dataset | null {
  if (!isRecord(raw)) return null
  if (typeof raw.id !== 'string' || !RESEARCH_DATASET_ID_RE.test(raw.id)) return null
  if (raw.id === MOCK_GROSS_MARGIN_DATASET.id) return null
  const title = typeof raw.title === 'string' ? raw.title.trim() : ''
  const metric = typeof raw.metric === 'string' ? raw.metric.trim() : ''
  const unit = typeof raw.unit === 'string' ? raw.unit.trim() : ''
  if (!title || !METRIC_IDS.has(metric) || !unit) return null
  if (!Array.isArray(raw.entities) || !Array.isArray(raw.periods) || !Array.isArray(raw.data)) return null
  const entities: ResearchEntity[] = []
  const entityIds = new Set<string>()
  for (const item of raw.entities) {
    const entity = normalizeEntity(item)
    if (!entity || entityIds.has(entity.id)) return null
    entityIds.add(entity.id)
    entities.push(entity)
  }
  if (!entities.length) return null
  const periods: string[] = []
  const periodSet = new Set<string>()
  for (const item of raw.periods) {
    if (typeof item !== 'string' || !item.trim() || periodSet.has(item.trim())) return null
    periodSet.add(item.trim())
    periods.push(item.trim())
  }
  if (!periods.length) return null
  const data: ResearchDataPoint[] = []
  for (const item of raw.data) {
    const point = normalizePoint(item, entityIds)
    if (!point || !periodSet.has(point.period)) return null
    data.push(point)
  }
  const sources: ResearchSource[] = []
  if (Array.isArray(raw.sources)) {
    for (const item of raw.sources) {
      const source = normalizeSource(item, entityIds)
      if (!source) return null
      sources.push(source)
    }
  }
  let ohlc: ResearchOhlcBar[] | undefined
  if (raw.ohlc !== undefined) {
    if (!Array.isArray(raw.ohlc)) return null
    ohlc = []
    for (const item of raw.ohlc) {
      const bar = normalizeOhlc(item, entityIds)
      if (!bar || !periodSet.has(bar.time)) return null
      ohlc.push(bar)
    }
  }
  const dataset: Dataset = { id: raw.id, title, metric, unit, entities, periods, data, sources }
  if (ohlc) dataset.ohlc = ohlc
  const query = normalizeQuery(raw.query, metric, periods)
  if (raw.query !== undefined && !query) return null
  if (query) dataset.query = query
  if (raw.parentDatasetId !== undefined) {
    if (typeof raw.parentDatasetId !== 'string' || !RESEARCH_DATASET_ID_RE.test(raw.parentDatasetId)) return null
    if (raw.parentDatasetId === raw.id) return null
    dataset.parentDatasetId = raw.parentDatasetId
  }
  const transform = normalizeTransform(raw.transform)
  if (raw.transform !== undefined && !transform) return null
  if (transform) dataset.transform = transform
  if (raw.createdAt !== undefined) {
    if (typeof raw.createdAt !== 'string' || !raw.createdAt.trim()) return null
    dataset.createdAt = raw.createdAt.trim()
  }
  return dataset
}

const YEAR_RE = /^\d{4}$/

function normalizeQuery(
  raw: unknown,
  metric: string,
  periods: readonly string[],
): Dataset['query'] | null {
  if (raw === undefined) return null
  if (!isRecord(raw) || !Array.isArray(raw.entities) || !raw.entities.length) return null
  const entities: string[] = []
  const seen = new Set<string>()
  for (const item of raw.entities) {
    if (typeof item !== 'string' || !item.trim() || seen.has(item.trim())) return null
    seen.add(item.trim())
    entities.push(item.trim())
  }
  const queryMetric = typeof raw.metric === 'string' ? raw.metric.trim() : ''
  const start = typeof raw.start === 'string' ? raw.start.trim() : ''
  const end = typeof raw.end === 'string' ? raw.end.trim() : ''
  if (queryMetric !== metric || !YEAR_RE.test(start) || !YEAR_RE.test(end) || start > end) return null
  if (metric !== 'kline' && periods.length && (start !== periods[0] || end !== periods[periods.length - 1])) {
    return null
  }
  return { entities, metric: queryMetric, start, end }
}

function normalizeIdList(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || !raw.length) return null
  const ids: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (typeof item !== 'string' || !item.trim() || seen.has(item.trim())) return null
    seen.add(item.trim())
    ids.push(item.trim())
  }
  return ids
}

function normalizeTransform(raw: unknown): Dataset['transform'] | null {
  if (raw === undefined) return null
  if (!isRecord(raw) || typeof raw.type !== 'string') return null
  if (raw.type === 'filter_entities') {
    const removedEntityIds = normalizeIdList(raw.removedEntityIds)
    return removedEntityIds ? { type: 'filter_entities', removedEntityIds } : null
  }
  if (raw.type === 'add_entities') {
    const addedEntityIds = normalizeIdList(raw.addedEntityIds)
    return addedEntityIds ? { type: 'add_entities', addedEntityIds } : null
  }
  if (raw.type === 'filter_period') {
    const start = typeof raw.start === 'string' ? raw.start.trim() : ''
    const end = typeof raw.end === 'string' ? raw.end.trim() : ''
    if (!YEAR_RE.test(start) || !YEAR_RE.test(end) || start > end) return null
    return { type: 'filter_period', start, end }
  }
  return null
}

function hasUniqueIds(ids: string[]): boolean {
  return new Set(ids).size === ids.length
}

function normalizeAcceptedProposalIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const ids: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string' || !item.trim()) continue
    const id = item.trim()
    if (seen.has(id)) continue
    seen.add(id)
    ids.push(id)
  }
  return ids
}

function normalizeWidgetsAndLayout(raw: Record<string, unknown>): {
  widgets: Widget[]
  layout: CanvasLayoutItem[]
} | null {
  if (!Array.isArray(raw.widgets) || !Array.isArray(raw.layout)) return null
  const widgets: Widget[] = []
  for (const item of raw.widgets) {
    const widget = normalizeWidget(item)
    if (!widget) return null
    widgets.push(widget)
  }
  const layout: CanvasLayoutItem[] = []
  for (const item of raw.layout) {
    const layoutItem = normalizeLayoutItem(item)
    if (!layoutItem) return null
    layout.push(layoutItem)
  }
  const widgetIds = widgets.map(widget => widget.id)
  const layoutIds = layout.map(item => item.i)
  if (!hasUniqueIds(widgetIds) || !hasUniqueIds(layoutIds)) return null
  if (widgetIds.length !== layoutIds.length) return null
  if (layoutIds.some(id => !new Set(widgetIds).has(id))) return null
  return { widgets, layout }
}

export function normalizePersistedCanvasState(raw: unknown): PersistedCanvasState | null {
  if (!isRecord(raw)) return null
  if (raw.version !== 1 && raw.version !== 2) return null
  const core = normalizeWidgetsAndLayout(raw)
  if (!core) return null
  const datasets: Dataset[] = []
  const seen = new Set<string>()
  if (raw.version === 2 && Array.isArray(raw.datasets)) {
    for (const item of raw.datasets) {
      const dataset = normalizeResearchDataset(item)
      if (!dataset || seen.has(dataset.id)) continue
      seen.add(dataset.id)
      datasets.push(dataset)
    }
  }
  return {
    version: 2,
    widgets: core.widgets,
    layout: core.layout,
    datasets,
    acceptedProposalIds: normalizeAcceptedProposalIds(raw.acceptedProposalIds),
  }
}

export function createDefaultCanvasState(): PersistedCanvasState {
  return {
    version: 2,
    widgets: [],
    layout: [],
    datasets: [],
    acceptedProposalIds: [],
  }
}

export function readPersistedCanvasState(): PersistedCanvasState {
  if (typeof window === 'undefined') return createDefaultCanvasState()
  try {
    const raw = localStorage.getItem(RESEARCH_CANVAS_STORAGE_KEY)
    if (!raw) return createDefaultCanvasState()
    const parsed = normalizePersistedCanvasState(JSON.parse(raw))
    return parsed ?? createDefaultCanvasState()
  } catch {
    return createDefaultCanvasState()
  }
}

export function writePersistedCanvasState(state: PersistedCanvasState): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(RESEARCH_CANVAS_STORAGE_KEY, JSON.stringify({
      version: 2,
      widgets: state.widgets,
      layout: state.layout,
      datasets: state.datasets,
      acceptedProposalIds: state.acceptedProposalIds ?? [],
    }))
  } catch {
    /* ignore quota / private mode */
  }
}

export function clonePersistedDataset(dataset: Dataset): Dataset {
  const cloned: Dataset = {
    id: dataset.id,
    title: dataset.title,
    metric: dataset.metric,
    unit: dataset.unit,
    entities: dataset.entities.map(entity => ({ ...entity })),
    periods: [...dataset.periods],
    data: dataset.data.map(point => ({ ...point })),
    sources: dataset.sources.map(source => ({ ...source })),
  }
  if (dataset.ohlc) cloned.ohlc = dataset.ohlc.map(bar => ({ ...bar }))
  if (dataset.query) cloned.query = { ...dataset.query, entities: [...dataset.query.entities] }
  if (dataset.parentDatasetId) cloned.parentDatasetId = dataset.parentDatasetId
  if (dataset.transform) {
    if (dataset.transform.type === 'filter_period') {
      cloned.transform = { ...dataset.transform }
    } else if (dataset.transform.type === 'filter_entities') {
      cloned.transform = { type: 'filter_entities', removedEntityIds: [...dataset.transform.removedEntityIds] }
    } else if (dataset.transform.type === 'add_entities') {
      cloned.transform = { type: 'add_entities', addedEntityIds: [...dataset.transform.addedEntityIds] }
    } else {
      cloned.transform = {
        type: 'aggregate_groups',
        method: dataset.transform.method,
        groups: dataset.transform.groups.map(group => ({
          id: group.id,
          name: group.name,
          memberIds: [...group.memberIds],
        })),
      }
    }
  }
  if (dataset.createdAt) cloned.createdAt = dataset.createdAt
  return cloned
}

export function removeWidgetFromState(
  state: PersistedCanvasState,
  widgetId: string,
): PersistedCanvasState {
  return {
    version: 2,
    widgets: state.widgets.filter(widget => widget.id !== widgetId),
    layout: state.layout.filter(item => item.i !== widgetId),
    datasets: state.datasets.map(dataset => clonePersistedDataset(dataset)),
    acceptedProposalIds: [...(state.acceptedProposalIds ?? [])],
  }
}

export function syncLayoutItems(
  layout: readonly CanvasLayoutItem[],
  widgets: readonly Widget[],
): CanvasLayoutItem[] {
  const widgetIds = new Set(widgets.map(widget => widget.id))
  return layout.filter(item => widgetIds.has(item.i)).map(item => ({ ...item }))
}

export function resolveDatasetFromState(
  state: Pick<PersistedCanvasState, 'datasets'>,
  datasetId: string,
): Dataset | undefined {
  if (datasetId === MOCK_GROSS_MARGIN_DATASET.id) return MOCK_GROSS_MARGIN_DATASET
  return state.datasets.find(dataset => dataset.id === datasetId)
}

/** Research Preview only: never fall back to the Phase 2 mock dataset. */
export function resolveLiveResearchDataset(
  state: Pick<PersistedCanvasState, 'datasets'>,
  datasetId: string,
): Dataset | undefined {
  if (datasetId === MOCK_GROSS_MARGIN_DATASET.id) return undefined
  if (!RESEARCH_DATASET_ID_RE.test(datasetId)) return undefined
  return state.datasets.find(dataset => dataset.id === datasetId)
}
