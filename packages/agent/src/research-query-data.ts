import {
  datasetShape,
  derivedDatasetTitle,
  inferViewIntent,
  isKlineMetricId,
  klineBarBudget,
  periodsBetween,
  pickRecommendedView,
  recommendViews,
  buildResearchViewTitle,
  RESEARCH_DATASET_ENTITY_LIMIT,
  resolveResearchMetric,
  uniqueSortedPeriods,
  type FinancialSummary,
  type InstrumentRef,
  type ResearchDataset,
  type ResearchDatasetQuery,
  type ResearchEntity,
  type ResearchMetric,
  type ResearchOhlcBar,
  type ResearchSource,
} from '@opptrix/shared'
import { randomUUID } from 'node:crypto'
import { searchHitsFromHubData, resolveResearchEntity } from './research-entity-resolver.js'
import {
  requireTurnCanvasState,
  upsertTurnDatasetRecord,
} from './research-canvas-turn-state.js'

export interface ResearchDataHub {
  dispatch(feature: string, params: Record<string, unknown>): Promise<{
    success: boolean
    data?: unknown
    message: string
  }>
  de: {
    queryInstrumentData(
      ref: InstrumentRef,
      capability: string,
      opts?: {
        reportType?: string
        period?: string
        startDate?: string
        endDate?: string
        count?: number
      },
    ): Promise<{
      success: boolean
      data?: unknown
      source?: string
      cached?: boolean
      error?: string
      meta?: {
        provider?: string
        cached?: boolean
        cachedAt?: number
        expiresAt?: number
      }
    }>
  }
}

const YEAR_RE = /^\d{4}$/
const MAX_ENTITIES = RESEARCH_DATASET_ENTITY_LIMIT
const MAX_SPAN = 20

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseYear(raw: unknown): string | { error: string } {
  if (typeof raw !== 'string' || !YEAR_RE.test(raw.trim())) return { error: '年份须为四位数字' }
  return raw.trim()
}

function parseEntities(raw: unknown): string[] | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { error: 'entities 至少包含一家公司' }
  if (raw.length > MAX_ENTITIES) return { error: `最多比较 ${MAX_ENTITIES} 家公司` }
  const names: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string' || !item.trim()) return { error: 'entities 须为公司名称或代码' }
    names.push(item.trim())
  }
  return names
}

function annualYear(row: FinancialSummary): string | null {
  const date = typeof row.reportDate === 'string' ? row.reportDate.trim() : ''
  const year = date.slice(0, 4)
  if (!YEAR_RE.test(year)) return null
  if (!/(?:-12-31|1231)$/.test(date)) return null
  return year
}

function metricValue(row: FinancialSummary, metric: ResearchMetric): number | null {
  if (!metric.financialField) return null
  const value = row[metric.financialField]
  if (value == null) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

function providerFromResult(result: {
  source?: string
  cached?: boolean
  meta?: { provider?: string }
}): string {
  // 缓存命中时顶层 source 是 'cache'，真实 provider 只存在于 meta 中。
  const fromMeta = typeof result.meta?.provider === 'string' ? result.meta.provider.trim() : ''
  if (fromMeta && fromMeta !== 'cache') return fromMeta
  const source = typeof result.source === 'string' ? result.source.trim() : ''
  if (!source || source === 'cache' || result.cached) return 'unknown'
  return source
}

function asKlineRows(data: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(data)) {
    return data.filter((row): row is Record<string, unknown> => isRecord(row))
  }
  if (!isRecord(data)) return []
  const nested = data.items ?? data.recentKlines ?? data.klines
  if (!Array.isArray(nested)) return []
  return nested.filter((row): row is Record<string, unknown> => isRecord(row))
}

function normalizeBarTime(raw: string): string | null {
  const trimmed = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)
  if (/^\d{8}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4, 6)}-${trimmed.slice(6, 8)}`
  }
  return null
}

function klineBarFromRow(
  entityId: string,
  row: Record<string, unknown>,
  start: string,
  end: string,
): ResearchOhlcBar | null {
  const rawTime = typeof row.date === 'string'
    ? row.date
    : typeof row.time === 'string' ? row.time : ''
  const time = normalizeBarTime(rawTime)
  if (!time) return null
  const year = time.slice(0, 4)
  if (!YEAR_RE.test(year) || year < start || year > end) return null
  const open = typeof row.open === 'number' ? row.open : null
  const high = typeof row.high === 'number' ? row.high : null
  const low = typeof row.low === 'number' ? row.low : null
  const close = typeof row.close === 'number' ? row.close : null
  if (open == null || high == null || low == null || close == null) return null
  if (![open, high, low, close].every(Number.isFinite)) return null
  const bar: ResearchOhlcBar = { entityId, time, open, high, low, close }
  if (typeof row.volume === 'number' && Number.isFinite(row.volume)) bar.volume = row.volume
  return bar
}

async function fetchEntityKlineSlice(
  hub: ResearchDataHub,
  entity: ResearchEntity,
  start: string,
  end: string,
  fetchedAt: string,
): Promise<{ data: ResearchDataset['data']; ohlc: ResearchOhlcBar[]; sources: ResearchSource[] }> {
  const barBudget = klineBarBudget(start, end)
  const result = await hub.de.queryInstrumentData(refFromEntity(entity), 'kline', {
    period: 'daily',
    startDate: `${start}-01-01`,
    endDate: `${end}-12-31`,
    count: barBudget,
  })
  const ohlc: ResearchOhlcBar[] = []
  const data: ResearchDataset['data'] = []
  const sources: ResearchSource[] = []
  if (!result.success) return { data, ohlc, sources }
  for (const row of asKlineRows(result.data)) {
    const bar = klineBarFromRow(entity.id, row, start, end)
    if (!bar) continue
    ohlc.push(bar)
  }
  ohlc.sort((left, right) => left.time.localeCompare(right.time))
  const kept = ohlc.slice(-barBudget)
  for (const bar of kept) {
    data.push({ entityId: bar.entityId, period: bar.time, value: bar.close })
  }
  if (kept.length) {
    sources.push({
      provider: providerFromResult(result),
      entityId: entity.id,
      metric: 'kline',
      fetchedAt,
    })
  }
  return { data, ohlc: kept, sources }
}

function asFinancialRows(data: unknown): FinancialSummary[] {
  if (!Array.isArray(data)) return []
  return data.filter((row): row is FinancialSummary => (
    isRecord(row) && typeof row.reportDate === 'string'
  )) as FinancialSummary[]
}

function refFromEntity(entity: ResearchEntity): InstrumentRef {
  const [symbol, exchange] = entity.ticker.includes('.')
    ? entity.ticker.split('.')
    : [entity.ticker, undefined]
  return {
    market: 'CN',
    assetClass: 'EQUITY',
    symbol,
    ...(exchange ? { exchange } : {}),
  }
}

export function makeResearchSearch(hub: ResearchDataHub) {
  return {
    search: async (keyword: string) => {
      const result = await hub.dispatch('instrument_search', { keyword, markets: ['CN'], limit: 8 })
      if (!result.success) throw new Error(result.message)
      return searchHitsFromHubData(result.data)
    },
  }
}

export async function fetchEntityMetricSlice(
  hub: ResearchDataHub,
  entity: ResearchEntity,
  metric: ResearchMetric,
  start: string,
  end: string,
  fetchedAt: string,
): Promise<{ data: ResearchDataset['data']; ohlc?: ResearchOhlcBar[]; sources: ResearchSource[] }> {
  if (isKlineMetricId(metric.id)) {
    return fetchEntityKlineSlice(hub, entity, start, end, fetchedAt)
  }
  const periods = periodsBetween(start, end)
  const result = await hub.de.queryInstrumentData(refFromEntity(entity), 'financials', {
    reportType: 'annual',
  })
  const data: ResearchDataset['data'] = []
  const sources: ResearchSource[] = []
  if (!result.success) {
    for (const period of periods) data.push({ entityId: entity.id, period, value: null })
    return { data, sources }
  }
  const summaries = asFinancialRows(result.data)
  if (!summaries.length) {
    for (const period of periods) data.push({ entityId: entity.id, period, value: null })
    return { data, sources }
  }
  const byYear = new Map<string, number | null>()
  for (const row of summaries) {
    const year = annualYear(row)
    if (!year || year < start || year > end) continue
    byYear.set(year, metricValue(row, metric))
  }
  sources.push({
    provider: providerFromResult(result),
    entityId: entity.id,
    metric: metric.id,
    fetchedAt,
  })
  for (const period of periods) {
    data.push({
      entityId: entity.id,
      period,
      value: byYear.has(period) ? byYear.get(period) ?? null : null,
    })
  }
  return { data, sources }
}

export async function fetchEntitiesMetricSlice(
  hub: ResearchDataHub,
  entities: ResearchEntity[],
  metric: ResearchMetric,
  start: string,
  end: string,
): Promise<{
  data: ResearchDataset['data']
  ohlc?: ResearchOhlcBar[]
  sources: ResearchSource[]
  fetchedAt: string
}> {
  const fetchedAt = new Date().toISOString()
  const rows = await Promise.all(entities.map(entity => (
    fetchEntityMetricSlice(hub, entity, metric, start, end, fetchedAt)
  )))
  const ohlc = rows.flatMap(row => row.ohlc ?? [])
  return {
    data: rows.flatMap(row => row.data),
    sources: rows.flatMap(row => row.sources),
    fetchedAt,
    ...(ohlc.length ? { ohlc } : {}),
  }
}

export async function executeQueryData(
  hub: ResearchDataHub,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!isRecord(args)) return { error: '参数无效' }
  const names = parseEntities(args.entities)
  if (!Array.isArray(names)) return names
  const metric = resolveResearchMetric(args.metric)
  if (!metric) return { error: '不支持该指标' }
  const start = parseYear(args.start)
  if (typeof start !== 'string') return start
  const end = parseYear(args.end)
  if (typeof end !== 'string') return end
  if (start > end) return { error: '起始年份不能晚于结束年份' }
  if (Number(end) - Number(start) + 1 > MAX_SPAN) return { error: '年份跨度过大' }

  const entities: ResearchEntity[] = []
  const search = makeResearchSearch(hub)
  for (const name of names) {
    const resolved = await resolveResearchEntity(name, search)
    if ('error' in resolved) return resolved
    if (entities.some(item => item.id === resolved.entity.id)) {
      return { error: '公司列表含重复标的' }
    }
    entities.push(resolved.entity)
  }
  if (isKlineMetricId(metric.id) && entities.length > 2) {
    return { error: 'K 线最多比较两只标的' }
  }

  const slice = await fetchEntitiesMetricSlice(hub, entities, metric, start, end)
  const periods = isKlineMetricId(metric.id)
    ? uniqueSortedPeriods(slice.data)
    : periodsBetween(start, end)
  if (!periods.length || slice.data.every(point => point.value == null)) {
    return { error: '当前数据源未能提供该指标，请稍后再试' }
  }

  const query: ResearchDatasetQuery = {
    entities: entities.map(entity => entity.ticker),
    metric: metric.id,
    start,
    end,
  }
  const dataset: ResearchDataset = {
    id: `research-ds-${randomUUID()}`,
    title: derivedDatasetTitle(entities, metric.id),
    metric: metric.id,
    unit: metric.unit,
    entities,
    periods,
    data: slice.data,
    sources: slice.sources,
    query,
    createdAt: slice.fetchedAt,
  }
  if (slice.ohlc?.length) dataset.ohlc = slice.ohlc

  const turn = requireTurnCanvasState()
  if ('error' in turn) return turn
  upsertTurnDatasetRecord(turn.sessionId, dataset)

  return {
    ok: true,
    datasetId: dataset.id,
    metric: metric.id,
    entities: entities.length,
    periods: periods.length,
    ...describeDatasetForModel(dataset),
    canvas_event: { type: 'dataset_created', dataset },
  }
}

/** 模型可见的数据形状与选图建议（不含明细数字） */
export function describeDatasetForModel(dataset: ResearchDataset): Record<string, unknown> {
  const shape = datasetShape(dataset)
  const intent = inferViewIntent(dataset)
  const candidates = recommendViews(dataset, intent)
  const picked = pickRecommendedView(dataset, intent)
  const suggestedTitle = buildResearchViewTitle({
    entityCount: dataset.entities.length,
    entityNames: dataset.entities.map(entity => entity.name),
    metric: dataset.metric,
    type: picked.type,
    intent,
    period: picked.params.period,
    periods: dataset.periods,
  })
  return {
    coverage: {
      filled: shape.filled,
      total: shape.total,
      byPeriod: shape.byPeriod,
      latestCompletePeriod: shape.latestCompletePeriod,
    },
    series: dataset.entities.map(entity => ({
      id: entity.id,
      name: entity.name,
      ticker: entity.ticker,
    })),
    intent,
    view: {
      recommended: picked.type,
      ...(picked.params.period ? { period: picked.params.period } : {}),
      ...(picked.params.topN ? { topN: picked.params.topN } : {}),
      alternatives: candidates.filter(item => item.type !== picked.type).map(item => item.type),
      reason: picked.reason,
      suggestedTitle,
      candidates: candidates.map(item => ({
        type: item.type,
        label: item.label,
        fit: item.fit,
        reason: item.reason,
        ...(item.params.period ? { period: item.params.period } : {}),
        ...(item.params.topN ? { topN: item.params.topN } : {}),
      })),
    },
  }
}
