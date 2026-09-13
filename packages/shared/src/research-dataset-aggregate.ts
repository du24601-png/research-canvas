import { isKlineMetricId, resolveResearchMetric } from './research-metrics.js'
import type { ResearchDataPoint, ResearchDataset, ResearchEntity, ResearchSource } from './research-dataset.js'

export interface AggregateGroupSpec {
  id: string
  name: string
  memberIds: string[]
}

const GROUP_ID_RE = /^group-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TITLE_MAX = 80

function arithmeticMean(values: readonly number[]): number {
  const sum = values.reduce((total, value) => total + value, 0)
  return sum / values.length
}

function aggregateTitle(groups: readonly AggregateGroupSpec[], metric: string): string {
  const metricName = resolveResearchMetric(metric)?.name ?? metric
  const names = groups.map(group => group.name).join(' vs ')
  return `${names}${metricName}`.slice(0, TITLE_MAX)
}

function groupEntity(spec: AggregateGroupSpec): ResearchEntity {
  return {
    id: spec.id,
    name: spec.name,
    ticker: spec.id,
    market: 'CN',
    type: 'group',
    memberIds: [...spec.memberIds],
  }
}

function meanForPeriod(
  parent: ResearchDataset,
  memberIds: readonly string[],
  period: string,
): number | null {
  const values = memberIds
    .map(memberId => parent.data.find(point => point.entityId === memberId && point.period === period))
    .map(point => point?.value ?? null)
    .filter((value): value is number => value != null)
  if (!values.length) return null
  return arithmeticMean(values)
}

export function isAggregateGroupEntityId(value: string): boolean {
  return GROUP_ID_RE.test(value)
}

export function aggregateDatasetByGroups(
  parent: ResearchDataset,
  groups: readonly AggregateGroupSpec[],
  method: 'arithmetic_mean',
): Omit<ResearchDataset, 'id' | 'parentDatasetId' | 'transform' | 'createdAt'> | { error: string } {
  if (method !== 'arithmetic_mean') return { error: '暂不支持该聚合方式' }
  if (isKlineMetricId(parent.metric)) return { error: 'K 线不支持分组聚合' }
  if (!groups.length) return { error: '至少指定一个分组' }
  if (groups.length > 10) return { error: '分组过多' }

  const parentIds = new Set(parent.entities.map(entity => entity.id))
  const usedMembers = new Set<string>()
  for (const group of groups) {
    if (!GROUP_ID_RE.test(group.id)) return { error: '分组标识无效' }
    if (!group.name.trim()) return { error: '分组名称不能为空' }
    if (!group.memberIds.length) return { error: `「${group.name}」未指定成员公司` }
    for (const memberId of group.memberIds) {
      if (!parentIds.has(memberId)) return { error: '分组包含不在原数据集中的公司' }
      if (usedMembers.has(memberId)) return { error: '同一公司不能出现在多个分组' }
      usedMembers.add(memberId)
    }
  }

  const entities = groups.map(groupEntity)
  const data: ResearchDataPoint[] = []
  for (const group of groups) {
    for (const period of parent.periods) {
      data.push({
        entityId: group.id,
        period,
        value: meanForPeriod(parent, group.memberIds, period),
      })
    }
  }
  if (!data.some(point => point.value != null)) return { error: '聚合后没有可用数值' }

  const memberIdSet = new Set(usedMembers)
  const sources: ResearchSource[] = parent.sources
    .filter(source => memberIdSet.has(source.entityId))
    .map(source => ({ ...source }))

  const query = parent.query
    ? { ...parent.query, entities: entities.map(entity => entity.id) }
    : undefined

  return {
    title: aggregateTitle(groups, parent.metric),
    metric: parent.metric,
    unit: parent.unit,
    entities,
    periods: [...parent.periods],
    data,
    sources,
    query,
  }
}
