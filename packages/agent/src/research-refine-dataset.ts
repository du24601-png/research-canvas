import {
  aggregateDatasetByGroups,
  canonicalQueryOf,
  cloneResearchDataset,
  datasetsStructurallyEqual,
  derivedDatasetTitle,
  filterDatasetByEntityIds,
  filterDatasetByPeriod,
  isKlineMetricId,
  matchEntitiesInDataset,
  mergeAddedEntitySlice,
  periodIsSubsetOfParent,
  periodsBetween,
  RESEARCH_DATASET_ENTITY_LIMIT,
  resolveResearchMetric,
  uniqueSortedPeriods,
  type AggregateGroupSpec,
  type DatasetTransform,
  type ResearchDataset,
  type ResearchEntity,
} from '@opptrix/shared'
import { randomUUID } from 'node:crypto'
import { resolveResearchEntity } from './research-entity-resolver.js'
import {
  requireTurnCanvasState,
  upsertTurnDatasetRecord,
} from './research-canvas-turn-state.js'
import {
  describeDatasetForModel,
  fetchEntitiesMetricSlice,
  fetchEntityMetricSlice,
  makeResearchSearch,
  type ResearchDataHub,
} from './research-query-data.js'

const YEAR_RE = /^\d{4}$/
const ENTITY_LIMIT = RESEARCH_DATASET_ENTITY_LIMIT
const OPERATION_TYPES = new Set(['remove_entities', 'add_entities', 'change_period', 'aggregate_groups'])
const GROUP_LIMIT = 10

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseYear(raw: unknown): string | { error: string } {
  if (typeof raw !== 'string' || !YEAR_RE.test(raw.trim())) return { error: '年份须为四位数字' }
  return raw.trim()
}

function parseEntities(raw: unknown): string[] | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { error: 'entities 至少包含一家公司' }
  if (raw.length > ENTITY_LIMIT) return { error: `最多比较 ${ENTITY_LIMIT} 家公司` }
  const names: string[] = []
  for (const item of raw) {
    if (typeof item !== 'string' || !item.trim()) return { error: 'entities 须为公司名称或代码' }
    names.push(item.trim())
  }
  return names
}

function parseAggregateGroups(raw: unknown):
  | { method: 'arithmetic_mean'; groups: Array<{ name: string; members: string[] }> }
  | { error: string } {
  if (!isRecord(raw)) return { error: '分组参数无效' }
  if (raw.method !== 'arithmetic_mean') return { error: '暂只支持 arithmetic_mean' }
  if (!Array.isArray(raw.groups) || !raw.groups.length) return { error: '至少指定一个分组' }
  if (raw.groups.length > GROUP_LIMIT) return { error: '分组过多' }
  const groups: Array<{ name: string; members: string[] }> = []
  for (const item of raw.groups) {
    if (!isRecord(item)) return { error: '分组格式无效' }
    const name = typeof item.name === 'string' ? item.name.trim() : ''
    const members = parseEntities(item.members)
    if (!name) return { error: '分组名称不能为空' }
    if (!Array.isArray(members)) return members
    groups.push({ name, members })
  }
  return { method: 'arithmetic_mean', groups }
}

function parseOperation(raw: unknown):
  | { type: 'remove_entities'; entities: string[] }
  | { type: 'add_entities'; entities: string[] }
  | { type: 'change_period'; start: string; end: string }
  | { type: 'aggregate_groups'; method: 'arithmetic_mean'; groups: Array<{ name: string; members: string[] }> }
  | { error: string } {
  if (!isRecord(raw) || typeof raw.type !== 'string' || !OPERATION_TYPES.has(raw.type)) {
    return { error: 'operation.type 须为 remove_entities / add_entities / change_period / aggregate_groups' }
  }
  const allowed = raw.type === 'change_period'
    ? new Set(['type', 'start', 'end'])
    : raw.type === 'aggregate_groups'
      ? new Set(['type', 'method', 'groups'])
      : new Set(['type', 'entities'])
  for (const key of Object.keys(raw)) {
    if (!allowed.has(key)) return { error: `不支持参数 ${key}` }
  }
  if (raw.type === 'change_period') {
    const start = parseYear(raw.start)
    if (typeof start !== 'string') return start
    const end = parseYear(raw.end)
    if (typeof end !== 'string') return end
    if (start > end) return { error: '起始年份不能晚于结束年份' }
    return { type: 'change_period', start, end }
  }
  const entities = parseEntities(raw.entities)
  if (!Array.isArray(entities)) return entities
  if (raw.type === 'remove_entities' || raw.type === 'add_entities') {
    return { type: raw.type, entities }
  }
  if (raw.type === 'aggregate_groups') {
    const aggregate = parseAggregateGroups(raw)
    if ('error' in aggregate) return aggregate
    return { type: 'aggregate_groups', method: aggregate.method, groups: aggregate.groups }
  }
  return { error: 'operation.type 须为 remove_entities / add_entities / change_period / aggregate_groups' }
}

function resolveAggregateGroups(
  parent: ResearchDataset,
  groups: Array<{ name: string; members: string[] }>,
): { specs: AggregateGroupSpec[] } | { error: string } {
  const specs: AggregateGroupSpec[] = []
  for (const group of groups) {
    const matched = matchEntitiesInDataset(parent.entities, group.members)
    if ('error' in matched) return matched
    specs.push({
      id: `group-${randomUUID()}`,
      name: group.name,
      memberIds: matched.entities.map(entity => entity.id),
    })
  }
  return { specs }
}

function finishDerived(
  sessionId: string,
  parent: ResearchDataset,
  body: Omit<ResearchDataset, 'id' | 'parentDatasetId' | 'transform' | 'createdAt'>,
  transform: DatasetTransform,
): Record<string, unknown> {
  const dataset: ResearchDataset = {
    ...body,
    id: `research-ds-${randomUUID()}`,
    parentDatasetId: parent.id,
    transform,
    createdAt: new Date().toISOString(),
  }
  upsertTurnDatasetRecord(sessionId, dataset)
  return {
    ok: true,
    datasetId: dataset.id,
    parentDatasetId: parent.id,
    transform: transform.type,
    entities: dataset.entities.length,
    periods: dataset.periods.length,
    ...describeDatasetForModel(dataset),
    canvas_event: { type: 'dataset_created', dataset },
  }
}

async function addEntities(
  hub: ResearchDataHub,
  parent: ResearchDataset,
  needles: string[],
): Promise<Omit<ResearchDataset, 'id' | 'parentDatasetId' | 'transform' | 'createdAt'> | { error: string }> {
  const metric = resolveResearchMetric(parent.metric)
  if (!metric) return { error: '不支持该指标' }
  const query = canonicalQueryOf(parent)
  if (!query) return { error: '缺少可执行的查询范围' }
  if (isKlineMetricId(parent.metric) && parent.entities.length + needles.length > 2) {
    return { error: 'K 线最多比较两只标的' }
  }
  if (parent.entities.length + needles.length > ENTITY_LIMIT) {
    return { error: `最多比较 ${ENTITY_LIMIT} 家公司` }
  }
  const search = makeResearchSearch(hub)
  const added: ResearchEntity[] = []
  for (const needle of needles) {
    const resolved = await resolveResearchEntity(needle, search)
    if ('error' in resolved) return resolved
    if (
      parent.entities.some(item => item.id === resolved.entity.id)
      || added.some(item => item.id === resolved.entity.id)
    ) {
      return { error: '公司列表含重复标的' }
    }
    added.push(resolved.entity)
  }
  const fetchedAt = new Date().toISOString()
  const slices = await Promise.all(added.map(entity => (
    fetchEntityMetricSlice(hub, entity, metric, query.start, query.end, fetchedAt)
  )))
  return mergeAddedEntitySlice(
    parent,
    added,
    slices.flatMap(item => item.data),
    slices.flatMap(item => item.sources),
    slices.flatMap(item => item.ohlc ?? []),
  )
}

async function changePeriod(
  hub: ResearchDataHub | null | undefined,
  parent: ResearchDataset,
  start: string,
  end: string,
): Promise<Omit<ResearchDataset, 'id' | 'parentDatasetId' | 'transform' | 'createdAt'> | { error: string }> {
  if (periodIsSubsetOfParent(parent, start, end)) {
    return filterDatasetByPeriod(parent, start, end)
  }
  if (!hub) return { error: '数据层不可用' }
  const metric = resolveResearchMetric(parent.metric)
  if (!metric) return { error: '不支持该指标' }
  const slice = await fetchEntitiesMetricSlice(hub, parent.entities, metric, start, end)
  const periods = isKlineMetricId(metric.id)
    ? uniqueSortedPeriods(slice.data)
    : periodsBetween(start, end)
  if (!periods.length || slice.data.every(point => point.value == null)) {
    return { error: '当前数据源未能提供该指标，请稍后再试' }
  }
  const query = canonicalQueryOf(parent)
  return {
    title: derivedDatasetTitle(parent.entities, parent.metric),
    metric: parent.metric,
    unit: parent.unit,
    entities: parent.entities.map(entity => ({ ...entity })),
    periods,
    data: slice.data,
    ...(slice.ohlc?.length ? { ohlc: slice.ohlc } : {}),
    sources: slice.sources,
    query: query
      ? { ...query, start, end, entities: parent.entities.map(entity => entity.ticker) }
      : undefined,
  }
}

function rejectIfMutated(
  parent: ResearchDataset,
  snapshot: ResearchDataset,
): { error: string } | null {
  if (!datasetsStructurallyEqual(parent, snapshot)) return { error: '原数据集被意外修改' }
  return null
}

export async function executeRefineDataset(
  hub: ResearchDataHub | null | undefined,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!isRecord(args)) return { error: '参数无效' }
  const datasetId = typeof args.datasetId === 'string' ? args.datasetId.trim() : ''
  if (!datasetId) return { error: 'datasetId 必填' }
  const operation = parseOperation(args.operation)
  if ('error' in operation) return operation
  const turn = requireTurnCanvasState()
  if ('error' in turn) return turn
  const parent = turn.records.find(item => item.id === datasetId)
  if (!parent) return { error: '数据集不存在或本轮无法调整' }
  const parentSnapshot = cloneResearchDataset(parent)

  if (operation.type === 'remove_entities') {
    const matched = matchEntitiesInDataset(parent.entities, operation.entities)
    if ('error' in matched) return matched
    const removeIds = new Set(matched.entities.map(entity => entity.id))
    const keepIds = new Set(
      parent.entities.filter(entity => !removeIds.has(entity.id)).map(entity => entity.id),
    )
    const body = filterDatasetByEntityIds(parent, keepIds)
    if ('error' in body) return body
    const mutated = rejectIfMutated(parent, parentSnapshot)
    if (mutated) return mutated
    return finishDerived(turn.sessionId, parent, body, {
      type: 'filter_entities',
      removedEntityIds: [...removeIds],
    })
  }

  if (operation.type === 'add_entities') {
    if (!hub) return { error: '数据层不可用' }
    const body = await addEntities(hub, parent, operation.entities)
    if ('error' in body) return body
    const mutated = rejectIfMutated(parent, parentSnapshot)
    if (mutated) return mutated
    const addedEntityIds = body.entities
      .filter(entity => !parent.entities.some(item => item.id === entity.id))
      .map(entity => entity.id)
    return finishDerived(turn.sessionId, parent, body, {
      type: 'add_entities',
      addedEntityIds,
    })
  }

  if (operation.type === 'aggregate_groups') {
    const resolved = resolveAggregateGroups(parent, operation.groups)
    if ('error' in resolved) return resolved
    const body = aggregateDatasetByGroups(parent, resolved.specs, operation.method)
    if ('error' in body) return body
    const mutated = rejectIfMutated(parent, parentSnapshot)
    if (mutated) return mutated
    return finishDerived(turn.sessionId, parent, body, {
      type: 'aggregate_groups',
      method: operation.method,
      groups: resolved.specs.map(spec => ({
        id: spec.id,
        name: spec.name,
        memberIds: [...spec.memberIds],
      })),
    })
  }

  const body = await changePeriod(hub, parent, operation.start, operation.end)
  if ('error' in body) return body
  const mutated = rejectIfMutated(parent, parentSnapshot)
  if (mutated) return mutated
  return finishDerived(turn.sessionId, parent, body, {
    type: 'filter_period',
    start: operation.start,
    end: operation.end,
  })
}
