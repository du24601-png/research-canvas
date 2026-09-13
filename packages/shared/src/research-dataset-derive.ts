import { isKlineMetricId, resolveResearchMetric } from './research-metrics.js'
import type {
  DatasetTransform,
  ResearchDataset,
  ResearchDatasetQuery,
  ResearchEntity,
  ResearchSource,
} from './research-dataset.js'

const YEAR_RE = /^\d{4}$/
const TITLE_MAX = 80

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function cloneResearchDataset(dataset: ResearchDataset): ResearchDataset {
  const cloned: ResearchDataset = {
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
  if (dataset.query) {
    cloned.query = { ...dataset.query, entities: [...dataset.query.entities] }
  }
  if (dataset.parentDatasetId) cloned.parentDatasetId = dataset.parentDatasetId
  if (dataset.transform) cloned.transform = cloneTransform(dataset.transform)
  if (dataset.createdAt) cloned.createdAt = dataset.createdAt
  return cloned
}

function cloneTransform(transform: DatasetTransform): DatasetTransform {
  if (transform.type === 'filter_entities') {
    return { type: 'filter_entities', removedEntityIds: [...transform.removedEntityIds] }
  }
  if (transform.type === 'add_entities') {
    return { type: 'add_entities', addedEntityIds: [...transform.addedEntityIds] }
  }
  if (transform.type === 'aggregate_groups') {
    return {
      type: 'aggregate_groups',
      method: transform.method,
      groups: transform.groups.map(group => ({
        id: group.id,
        name: group.name,
        memberIds: [...group.memberIds],
      })),
    }
  }
  return { type: 'filter_period', start: transform.start, end: transform.end }
}

export function canonicalQueryOf(dataset: ResearchDataset): ResearchDatasetQuery | null {
  if (dataset.query) {
    return { ...dataset.query, entities: [...dataset.query.entities] }
  }
  const first = dataset.periods[0] ?? ''
  const last = dataset.periods[dataset.periods.length - 1] ?? ''
  const start = YEAR_RE.test(first) ? first : first.slice(0, 4)
  const end = YEAR_RE.test(last) ? last : last.slice(0, 4)
  if (!YEAR_RE.test(start) || !YEAR_RE.test(end)) return null
  const metric = typeof dataset.metric === 'string' ? dataset.metric.trim() : ''
  if (!metric) return null
  const entities = dataset.entities.map(entity => entity.ticker).filter(Boolean)
  if (!entities.length) return null
  return { entities, metric, start, end }
}

export function periodsBetween(start: string, end: string): string[] {
  const years: string[] = []
  for (let year = Number(start); year <= Number(end); year += 1) years.push(String(year))
  return years
}

export function uniqueSortedPeriods(data: ResearchDataset['data']): string[] {
  return [...new Set(data.map(point => point.period))].sort()
}

export function derivedDatasetTitle(entities: readonly ResearchEntity[], metric: string): string {
  const metricName = resolveResearchMetric(metric)?.name ?? metric
  const names = entities.map(entity => entity.name).join('、')
  return `${names}${metricName}`.slice(0, TITLE_MAX)
}

function normalizeEntityLabel(value: string): string {
  return value.replace(/股份有限公司|有限公司|集团/g, '').trim().toLowerCase()
}

function tickerBare(ticker: string): string {
  return ticker.split('.')[0]?.toLowerCase() ?? ticker.toLowerCase()
}

function entityMatchesNeedle(entity: ResearchEntity, needle: string): boolean {
  const raw = needle.trim()
  if (!raw) return false
  if (entity.id === raw || entity.ticker === raw || entity.name === raw) return true
  if (tickerBare(entity.ticker) === tickerBare(raw)) return true
  const needleNorm = normalizeEntityLabel(raw)
  const nameNorm = normalizeEntityLabel(entity.name)
  if (nameNorm === needleNorm) return true
  return nameNorm.startsWith(needleNorm) || needleNorm.startsWith(nameNorm)
}

export function matchEntitiesInDataset(
  entities: readonly ResearchEntity[],
  needles: readonly string[],
): { entities: ResearchEntity[] } | { error: string } {
  if (!needles.length) return { error: '至少指定一家公司' }
  const matched: ResearchEntity[] = []
  const used = new Set<string>()
  for (const needle of needles) {
    const hits = entities.filter(entity => entityMatchesNeedle(entity, needle) && !used.has(entity.id))
    if (hits.length !== 1) {
      return { error: hits.length ? `「${needle.trim()}」对应多家公司` : `无法确认「${needle.trim()}」` }
    }
    const entity = hits[0]
    if (!entity) return { error: `无法确认「${needle.trim()}」` }
    used.add(entity.id)
    matched.push(entity)
  }
  return { entities: matched }
}

export function filterDatasetByEntityIds(
  parent: ResearchDataset,
  keepIds: ReadonlySet<string>,
): Omit<ResearchDataset, 'id' | 'parentDatasetId' | 'transform' | 'createdAt'> | { error: string } {
  const entities = parent.entities.filter(entity => keepIds.has(entity.id)).map(entity => ({ ...entity }))
  if (!entities.length) return { error: '调整后没有可保留的公司' }
  const data = parent.data
    .filter(point => keepIds.has(point.entityId))
    .map(point => ({ ...point }))
  const ohlc = parent.ohlc
    ?.filter(bar => keepIds.has(bar.entityId))
    .map(bar => ({ ...bar }))
  const hasValues = data.some(point => point.value != null) || Boolean(ohlc?.length)
  if (!hasValues) return { error: '调整后没有可用数值' }
  const sources = parent.sources
    .filter(source => keepIds.has(source.entityId))
    .map(source => ({ ...source }))
  const query = canonicalQueryOf(parent)
  return {
    title: derivedDatasetTitle(entities, parent.metric),
    metric: parent.metric,
    unit: parent.unit,
    entities,
    periods: [...parent.periods],
    data,
    ...(ohlc ? { ohlc } : {}),
    sources,
    query: query
      ? { ...query, entities: entities.map(entity => entity.ticker) }
      : undefined,
  }
}

function periodYear(period: string): string {
  return YEAR_RE.test(period) ? period : period.slice(0, 4)
}

function periodInYearRange(period: string, start: string, end: string): boolean {
  const year = periodYear(period)
  return YEAR_RE.test(year) && year >= start && year <= end
}

export function filterDatasetByPeriod(
  parent: ResearchDataset,
  start: string,
  end: string,
): Omit<ResearchDataset, 'id' | 'parentDatasetId' | 'transform' | 'createdAt'> | { error: string } {
  if (!YEAR_RE.test(start) || !YEAR_RE.test(end) || start > end) {
    return { error: '年份无效' }
  }
  const periods = parent.periods.filter(period => periodInYearRange(period, start, end))
  if (!periods.length) return { error: '目标年份与现有数据没有交集' }
  const periodSet = new Set(periods)
  const data = parent.data
    .filter(point => periodSet.has(point.period))
    .map(point => ({ ...point }))
  const ohlc = parent.ohlc
    ?.filter(bar => periodSet.has(bar.time))
    .map(bar => ({ ...bar }))
  const hasValues = data.some(point => point.value != null) || Boolean(ohlc?.length)
  if (!hasValues) return { error: '调整后没有可用数值' }
  const query = canonicalQueryOf(parent)
  return {
    title: derivedDatasetTitle(parent.entities, parent.metric),
    metric: parent.metric,
    unit: parent.unit,
    entities: parent.entities.map(entity => ({ ...entity })),
    periods,
    data,
    ...(ohlc ? { ohlc } : {}),
    sources: parent.sources.map(source => ({ ...source })),
    query: query ? { ...query, start, end } : undefined,
  }
}

export function periodIsSubsetOfParent(parent: ResearchDataset, start: string, end: string): boolean {
  if (!YEAR_RE.test(start) || !YEAR_RE.test(end) || start > end) return false
  if (isKlineMetricId(parent.metric)) {
    const wanted = periodsBetween(start, end)
    if (!wanted.length) return false
    const years = new Set(parent.periods.map(period => periodYear(period)))
    return wanted.every(year => years.has(year))
  }
  const wanted = periodsBetween(start, end)
  return wanted.length > 0 && wanted.every(year => parent.periods.includes(year))
}

export function mergeAddedEntitySlice(
  parent: ResearchDataset,
  addedEntities: ResearchEntity[],
  addedData: ResearchDataset['data'],
  addedSources: ResearchSource[],
  addedOhlc?: ResearchDataset['ohlc'],
): Omit<ResearchDataset, 'id' | 'parentDatasetId' | 'transform' | 'createdAt'> | { error: string } {
  const seen = new Set(parent.entities.map(entity => entity.id))
  for (const entity of addedEntities) {
    if (seen.has(entity.id)) return { error: '公司列表含重复标的' }
    seen.add(entity.id)
  }
  const entities = [
    ...parent.entities.map(entity => ({ ...entity })),
    ...addedEntities.map(entity => ({ ...entity })),
  ]
  const data = [
    ...parent.data.map(point => ({ ...point })),
    ...addedData.map(point => ({ ...point })),
  ]
  const ohlcBars = [
    ...(parent.ohlc ?? []).map(bar => ({ ...bar })),
    ...(addedOhlc ?? []).map(bar => ({ ...bar })),
  ]
  const hasValues = data.some(point => point.value != null) || ohlcBars.length > 0
  if (!hasValues) return { error: '调整后没有可用数值' }
  const sources = [
    ...parent.sources.map(source => ({ ...source })),
    ...addedSources.map(source => ({ ...source })),
  ]
  const query = canonicalQueryOf(parent)
  const periods = isKlineMetricId(parent.metric)
    ? uniqueSortedPeriods(data)
    : [...parent.periods]
  return {
    title: derivedDatasetTitle(entities, parent.metric),
    metric: parent.metric,
    unit: parent.unit,
    entities,
    periods,
    data,
    ...(ohlcBars.length ? { ohlc: ohlcBars } : {}),
    sources,
    query: query
      ? { ...query, entities: entities.map(entity => entity.ticker) }
      : undefined,
  }
}

export function datasetsStructurallyEqual(left: ResearchDataset, right: ResearchDataset): boolean {
  return JSON.stringify(toComparable(left)) === JSON.stringify(toComparable(right))
}

function toComparable(dataset: ResearchDataset): unknown {
  return {
    id: dataset.id,
    title: dataset.title,
    metric: dataset.metric,
    unit: dataset.unit,
    entities: dataset.entities,
    periods: dataset.periods,
    data: dataset.data,
    ohlc: dataset.ohlc ?? null,
    sources: dataset.sources,
    query: dataset.query ?? null,
    parentDatasetId: dataset.parentDatasetId ?? null,
    transform: dataset.transform ?? null,
    createdAt: dataset.createdAt ?? null,
  }
}

export function isRecordValue(value: unknown): value is Record<string, unknown> {
  return isRecord(value)
}
