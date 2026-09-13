import { isKlineMetricId, isResearchMetricId, type ResearchMetricId } from './research-metrics.js'

export const RESEARCH_DATASET_ID_PREFIX = 'research-ds-'
export const LEGACY_MOCK_RESEARCH_DATASET_ID = 'ds-tire-gross-margin-2021-2025'

const DATASET_ID_RE = /^research-ds-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TITLE_MAX = 80
export const RESEARCH_DATASET_ENTITY_LIMIT = 20
const ENTITY_LIMIT = RESEARCH_DATASET_ENTITY_LIMIT
const PERIOD_LIMIT = 20
const POINT_LIMIT = ENTITY_LIMIT * PERIOD_LIMIT
const KLINE_BARS_PER_YEAR = 250
const KLINE_PERIOD_LIMIT = 2500
const KLINE_POINT_LIMIT = 5000
const OHLC_LIMIT = 5000

/** 按起止年份估算日 K 根数，避免硬编码 800 截断多年窗口。 */
export function klineBarBudget(startYear: string, endYear: string): number {
  const start = Number(startYear)
  const end = Number(endYear)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return KLINE_BARS_PER_YEAR
  }
  const years = Math.max(end - start + 1, 1)
  return Math.min(years * KLINE_BARS_PER_YEAR, KLINE_PERIOD_LIMIT)
}

export interface ResearchEntity {
  id: string
  name: string
  ticker: string
  market: 'CN'
  type: 'equity' | 'group'
  memberIds?: string[]
}

export interface ResearchDataPoint {
  entityId: string
  period: string
  value: number | null
}

export interface ResearchOhlcBar {
  entityId: string
  time: string
  open: number
  high: number
  low: number
  close: number
  volume?: number | null
}

export interface ResearchSource {
  provider: string
  entityId: string
  metric: string
  /** 财务指标必填；日 K 可为交易日或省略（按实体级来源） */
  period?: string
  fetchedAt: string
  sourceUrl?: string
  /** 投资者可读科目名，如「净资产收益率」 */
  fieldLabel?: string
}

export interface ResearchDatasetQuery {
  entities: string[]
  metric: string
  start: string
  end: string
}

export type DatasetTransform =
  | {
    type: 'filter_entities'
    removedEntityIds: string[]
  }
  | {
    type: 'add_entities'
    addedEntityIds: string[]
  }
  | {
    type: 'filter_period'
    start: string
    end: string
  }
  | {
    type: 'aggregate_groups'
    method: 'arithmetic_mean'
    groups: Array<{ id: string; name: string; memberIds: string[] }>
  }

export interface ResearchDataset {
  id: string
  title: string
  metric: ResearchMetricId | string
  unit: string
  entities: ResearchEntity[]
  periods: string[]
  data: ResearchDataPoint[]
  ohlc?: ResearchOhlcBar[]
  sources: ResearchSource[]
  query?: ResearchDatasetQuery
  parentDatasetId?: string
  transform?: DatasetTransform
  createdAt?: string
}

export interface ResearchCanvasDatasetMeta {
  id: string
  metric: string
  title: string
  entityNames: string[]
  periodRange: string
  parentDatasetId?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isLegacyMockResearchDatasetId(value: unknown): value is string {
  return value === LEGACY_MOCK_RESEARCH_DATASET_ID
}

export function isResearchDatasetId(value: unknown): value is string {
  return typeof value === 'string' && DATASET_ID_RE.test(value)
}

export function isKnownResearchCanvasDatasetId(
  value: unknown,
  knownIds?: ReadonlySet<string>,
): value is string {
  if (isLegacyMockResearchDatasetId(value)) return true
  if (typeof value !== 'string' || !value.trim()) return false
  if (knownIds?.has(value)) return true
  return isResearchDatasetId(value)
}

function sanitizeMemberIds(raw: unknown): string[] | null {
  const ids = sanitizeIdList(raw)
  return ids
}

function sanitizeEntity(raw: unknown): ResearchEntity | null {
  if (!isRecord(raw)) return null
  const id = typeof raw.id === 'string' ? raw.id.trim() : ''
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  const ticker = typeof raw.ticker === 'string' ? raw.ticker.trim() : ''
  if (!id || !name) return null
  if (raw.market !== 'CN') return null
  const entityType = raw.type === 'group' ? 'group' : raw.type === 'equity' ? 'equity' : null
  if (!entityType) return null
  if (entityType === 'equity') {
    if (!ticker) return null
    return { id, name, ticker, market: 'CN', type: 'equity' }
  }
  const memberIds = sanitizeMemberIds(raw.memberIds)
  if (!memberIds) return null
  return { id, name, ticker: ticker || id, market: 'CN', type: 'group', memberIds }
}

function finiteNumber(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null
  return raw
}

function sanitizeOhlcBar(raw: unknown, entityIds: ReadonlySet<string>): ResearchOhlcBar | null {
  if (!isRecord(raw)) return null
  const entityId = typeof raw.entityId === 'string' ? raw.entityId.trim() : ''
  const time = typeof raw.time === 'string' ? raw.time.trim() : ''
  const open = finiteNumber(raw.open)
  const high = finiteNumber(raw.high)
  const low = finiteNumber(raw.low)
  const close = finiteNumber(raw.close)
  if (!entityId || !time || !entityIds.has(entityId)) return null
  if (open == null || high == null || low == null || close == null) return null
  const bar: ResearchOhlcBar = { entityId, time, open, high, low, close }
  if (raw.volume === null) bar.volume = null
  else if (typeof raw.volume === 'number' && Number.isFinite(raw.volume)) bar.volume = raw.volume
  return bar
}

function sanitizePoint(raw: unknown, entityIds: ReadonlySet<string>): ResearchDataPoint | null {
  if (!isRecord(raw)) return null
  const entityId = typeof raw.entityId === 'string' ? raw.entityId.trim() : ''
  const period = typeof raw.period === 'string' ? raw.period.trim() : ''
  if (!entityId || !period || !entityIds.has(entityId)) return null
  if (raw.value === null) return { entityId, period, value: null }
  if (typeof raw.value !== 'number' || !Number.isFinite(raw.value)) return null
  return { entityId, period, value: raw.value }
}

function isBlockedResearchProvider(raw: string): boolean {
  const id = raw.trim().toLowerCase()
  return !id || id === 'mixed' || id === 'cache'
}

function sanitizeSource(
  raw: unknown,
  entityIds: ReadonlySet<string>,
  metric: string,
): ResearchSource | null {
  if (!isRecord(raw)) return null
  const entityId = typeof raw.entityId === 'string' ? raw.entityId.trim() : ''
  const sourceMetric = typeof raw.metric === 'string' ? raw.metric.trim() : ''
  const fetchedAt = typeof raw.fetchedAt === 'string' ? raw.fetchedAt.trim() : ''
  if (!entityId || !sourceMetric || !fetchedAt || !entityIds.has(entityId)) return null
  const provider = typeof raw.provider === 'string' ? raw.provider.trim() : ''
  if (isBlockedResearchProvider(provider)) return null
  const period = typeof raw.period === 'string' ? raw.period.trim() : ''
  const kline = isKlineMetricId(metric)
  if (!kline && !period) return null
  const source: ResearchSource = {
    provider,
    entityId,
    metric: sourceMetric,
    fetchedAt,
  }
  if (period) source.period = period
  if (typeof raw.fieldLabel === 'string' && raw.fieldLabel.trim()) {
    source.fieldLabel = raw.fieldLabel.trim()
  }
  if (typeof raw.sourceUrl === 'string' && raw.sourceUrl.trim()) source.sourceUrl = raw.sourceUrl.trim()
  return source
}

export function sanitizeResearchDataset(raw: unknown): ResearchDataset | null {
  if (!isRecord(raw)) return null
  if (!isResearchDatasetId(raw.id) || isLegacyMockResearchDatasetId(raw.id)) return null
  const title = typeof raw.title === 'string' ? raw.title.trim() : ''
  if (!title || title.length > TITLE_MAX) return null
  const metric = typeof raw.metric === 'string' ? raw.metric.trim() : ''
  if (!isResearchMetricId(metric)) return null
  const unit = typeof raw.unit === 'string' ? raw.unit.trim() : ''
  if (!unit) return null
  if (!Array.isArray(raw.entities) || !Array.isArray(raw.periods) || !Array.isArray(raw.data)) return null
  const kline = isKlineMetricId(metric)
  const periodCap = kline ? KLINE_PERIOD_LIMIT : PERIOD_LIMIT
  const pointCap = kline ? KLINE_POINT_LIMIT : POINT_LIMIT
  if (raw.entities.length === 0 || raw.entities.length > ENTITY_LIMIT) return null
  if (raw.periods.length === 0 || raw.periods.length > periodCap) return null
  if (raw.data.length > pointCap) return null

  const entities: ResearchEntity[] = []
  const seenEntities = new Set<string>()
  for (const item of raw.entities) {
    const entity = sanitizeEntity(item)
    if (!entity || seenEntities.has(entity.id)) return null
    seenEntities.add(entity.id)
    entities.push(entity)
  }

  const periods: string[] = []
  const seenPeriods = new Set<string>()
  for (const item of raw.periods) {
    if (typeof item !== 'string' || !item.trim() || seenPeriods.has(item.trim())) return null
    seenPeriods.add(item.trim())
    periods.push(item.trim())
  }

  const data: ResearchDataPoint[] = []
  for (const item of raw.data) {
    const point = sanitizePoint(item, seenEntities)
    if (!point || !seenPeriods.has(point.period)) return null
    data.push(point)
  }

  const sources: ResearchSource[] = []
  const sourceKeys = new Set<string>()
  if (Array.isArray(raw.sources)) {
    for (const item of raw.sources) {
      const source = sanitizeSource(item, seenEntities, metric)
      if (!source) return null
      const key = `${source.entityId}\0${source.period ?? ''}`
      if (sourceKeys.has(key)) return null
      sourceKeys.add(key)
      sources.push(source)
    }
  }

  const query = sanitizeDatasetQuery(raw.query, metric, periods)
  if (raw.query !== undefined && !query) return null
  const parentDatasetId = sanitizeParentDatasetId(raw.parentDatasetId, raw.id)
  if (raw.parentDatasetId !== undefined && !parentDatasetId) return null
  const transform = sanitizeDatasetTransform(raw.transform)
  if (raw.transform !== undefined && !transform) return null
  const createdAt = typeof raw.createdAt === 'string' ? raw.createdAt.trim() : ''
  if (raw.createdAt !== undefined && !createdAt) return null

  let ohlc: ResearchOhlcBar[] | undefined
  if (raw.ohlc !== undefined) {
    if (!Array.isArray(raw.ohlc) || raw.ohlc.length > OHLC_LIMIT) return null
    ohlc = []
    for (const item of raw.ohlc) {
      const bar = sanitizeOhlcBar(item, seenEntities)
      if (!bar || !seenPeriods.has(bar.time)) return null
      ohlc.push(bar)
    }
  }

  const dataset: ResearchDataset = { id: raw.id, title, metric, unit, entities, periods, data, sources }
  if (ohlc) dataset.ohlc = ohlc
  if (query) dataset.query = query
  if (parentDatasetId) dataset.parentDatasetId = parentDatasetId
  if (transform) dataset.transform = transform
  if (createdAt) dataset.createdAt = createdAt
  return dataset
}

const YEAR_RE = /^\d{4}$/

function sanitizeDatasetQuery(
  raw: unknown,
  metric: string,
  periods: readonly string[],
): ResearchDatasetQuery | null {
  if (raw === undefined) return null
  if (!isRecord(raw)) return null
  if (!Array.isArray(raw.entities) || raw.entities.length === 0) return null
  const entities: string[] = []
  const seen = new Set<string>()
  for (const item of raw.entities) {
    if (typeof item !== 'string' || !item.trim() || seen.has(item.trim())) return null
    seen.add(item.trim())
    entities.push(item.trim())
  }
  if (entities.length > ENTITY_LIMIT) return null
  const queryMetric = typeof raw.metric === 'string' ? raw.metric.trim() : ''
  if (queryMetric !== metric) return null
  const start = typeof raw.start === 'string' ? raw.start.trim() : ''
  const end = typeof raw.end === 'string' ? raw.end.trim() : ''
  if (!YEAR_RE.test(start) || !YEAR_RE.test(end) || start > end) return null
  if (!isKlineMetricId(metric) && periods.length && (start !== periods[0] || end !== periods[periods.length - 1])) {
    return null
  }
  return { entities, metric: queryMetric, start, end }
}

function sanitizeParentDatasetId(raw: unknown, selfId: string): string | null {
  if (raw === undefined) return null
  if (!isResearchDatasetId(raw) || raw === selfId) return null
  return raw
}

function sanitizeIdList(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const ids: string[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    if (typeof item !== 'string' || !item.trim() || seen.has(item.trim())) return null
    seen.add(item.trim())
    ids.push(item.trim())
  }
  return ids
}

function sanitizeDatasetTransform(raw: unknown): DatasetTransform | null {
  if (raw === undefined) return null
  if (!isRecord(raw) || typeof raw.type !== 'string') return null
  if (raw.type === 'filter_entities') {
    const removedEntityIds = sanitizeIdList(raw.removedEntityIds)
    return removedEntityIds ? { type: 'filter_entities', removedEntityIds } : null
  }
  if (raw.type === 'add_entities') {
    const addedEntityIds = sanitizeIdList(raw.addedEntityIds)
    return addedEntityIds ? { type: 'add_entities', addedEntityIds } : null
  }
  if (raw.type === 'filter_period') {
    const start = typeof raw.start === 'string' ? raw.start.trim() : ''
    const end = typeof raw.end === 'string' ? raw.end.trim() : ''
    if (!YEAR_RE.test(start) || !YEAR_RE.test(end) || start > end) return null
    return { type: 'filter_period', start, end }
  }
  if (raw.type === 'aggregate_groups') {
    if (raw.method !== 'arithmetic_mean') return null
    if (!Array.isArray(raw.groups) || !raw.groups.length) return null
    const groups: Array<{ id: string; name: string; memberIds: string[] }> = []
    for (const item of raw.groups) {
      if (!isRecord(item)) return null
      const groupId = typeof item.id === 'string' ? item.id.trim() : ''
      const groupName = typeof item.name === 'string' ? item.name.trim() : ''
      const memberIds = sanitizeIdList(item.memberIds)
      if (!groupId || !groupName || !memberIds) return null
      groups.push({ id: groupId, name: groupName, memberIds })
    }
    return { type: 'aggregate_groups', method: 'arithmetic_mean', groups }
  }
  return null
}

export function toResearchDatasetMeta(dataset: ResearchDataset): ResearchCanvasDatasetMeta {
  const first = dataset.periods[0] ?? ''
  const last = dataset.periods[dataset.periods.length - 1] ?? first
  const meta: ResearchCanvasDatasetMeta = {
    id: dataset.id,
    metric: dataset.metric,
    title: dataset.title,
    entityNames: dataset.entities.map(entity => entity.name),
    periodRange: first === last ? first : `${first}–${last}`,
  }
  if (dataset.parentDatasetId) meta.parentDatasetId = dataset.parentDatasetId
  return meta
}

export function sanitizeResearchDatasetMeta(raw: unknown): ResearchCanvasDatasetMeta | null {
  if (!isRecord(raw)) return null
  if (!isResearchDatasetId(raw.id)) return null
  const metric = typeof raw.metric === 'string' ? raw.metric.trim() : ''
  const title = typeof raw.title === 'string' ? raw.title.trim() : ''
  const periodRange = typeof raw.periodRange === 'string' ? raw.periodRange.trim() : ''
  if (!metric || !title || title.length > TITLE_MAX) return null
  if (!Array.isArray(raw.entityNames)) return null
  const entityNames = raw.entityNames
    .filter((name): name is string => typeof name === 'string' && Boolean(name.trim()))
    .map(name => name.trim())
    .slice(0, ENTITY_LIMIT)
  const meta: ResearchCanvasDatasetMeta = { id: raw.id, metric, title, entityNames, periodRange }
  if (raw.parentDatasetId !== undefined) {
    if (!isResearchDatasetId(raw.parentDatasetId) || raw.parentDatasetId === raw.id) return null
    meta.parentDatasetId = raw.parentDatasetId
  }
  return meta
}
