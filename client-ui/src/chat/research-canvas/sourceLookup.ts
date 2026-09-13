import type { Dataset, ResearchSource } from './types'
import { pointValue } from './views'

export interface ResearchCellRef {
  entityId: string
  period: string
}

export function entityNameForId(dataset: Dataset, entityId: string): string {
  return dataset.entities.find(entity => entity.id === entityId)?.name ?? entityId
}

function isKlineDataset(dataset: Dataset): boolean {
  return dataset.metric === 'kline'
}

function klineSourceForCell(
  scoped: readonly ResearchSource[],
  period: string,
): ResearchSource | undefined {
  const exact = scoped.find(source => source.period === period)
  if (exact) return exact
  const range = scoped.find(source => source.period?.includes('–') && source.period.includes(period))
  if (range) return range
  return scoped.find(source => !source.period) ?? scoped[0]
}

/** 精确匹配 entityId + period；日 K 允许实体级或区间来源。 */
export function findSourceForCell(
  dataset: Dataset,
  entityId: string,
  period?: string,
): ResearchSource | undefined {
  const scoped = dataset.sources.filter(source => source.provider.trim().toLowerCase() !== 'mixed')
  const entityScoped = scoped.filter(source => source.entityId === entityId)
  if (entityScoped.length === 0) return undefined
  if (!period) return entityScoped.length === 1 ? entityScoped[0] : undefined
  const exact = entityScoped.find(source => source.period === period)
  if (exact) return exact
  if (isKlineDataset(dataset)) return klineSourceForCell(entityScoped, period)
  return undefined
}

export function cellNumericValue(dataset: Dataset, entityId: string, period: string): number | null {
  return pointValue(dataset, entityId, period)
}

export function formatCellValue(dataset: Dataset, value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${value.toFixed(1)}${dataset.unit}`
}
