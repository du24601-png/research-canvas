/**
 * 同比变化（yoy_delta）派生：每个实体相邻两期相减，生成新 Dataset。
 * 数字只由代码算出：模型说「看变化最大的年份」，由这里求差、由 largestAbsDelta 找最大。
 * 任一期缺值 → 该格为 null（不补值）；K 线不支持。
 */
import { isKlineMetricId } from './research-metrics.js'
import type { ResearchDataPoint, ResearchDataset } from './research-dataset.js'

type DerivedBody = Omit<ResearchDataset, 'id' | 'parentDatasetId' | 'transform' | 'createdAt'>

const PRECISION = 1e4

function roundDelta(value: number): number {
  return Math.round(value * PRECISION) / PRECISION
}

/** 百分比指标的差值单位是「个百分点」，金额类沿用原单位 */
export function yoyDeltaUnit(parentUnit: string): string {
  return parentUnit === '%' ? '个百分点' : parentUnit
}

function valueAt(parent: ResearchDataset, entityId: string, period: string): number | null {
  const hit = parent.data.find(point => point.entityId === entityId && point.period === period)
  return typeof hit?.value === 'number' ? hit.value : null
}

export function yoyDeltaDataset(parent: ResearchDataset): DerivedBody | { error: string } {
  if (isKlineMetricId(parent.metric)) return { error: 'K 线数据不支持同比变化' }
  if (parent.periods.length < 2) return { error: '至少需要两个年度才能计算变化' }
  const periods = parent.periods.slice(1)
  const data: ResearchDataPoint[] = []
  for (const entity of parent.entities) {
    parent.periods.forEach((period, i) => {
      if (i === 0) return
      const current = valueAt(parent, entity.id, period)
      const previous = valueAt(parent, entity.id, parent.periods[i - 1] ?? '')
      const value = current == null || previous == null ? null : roundDelta(current - previous)
      data.push({ entityId: entity.id, period, value })
    })
  }
  if (data.every(point => point.value == null)) return { error: '相邻年度都缺数据，无法计算变化' }
  return {
    title: `${parent.title} 同比变化`.slice(0, 80),
    metric: parent.metric,
    unit: yoyDeltaUnit(parent.unit),
    entities: parent.entities.map(entity => ({ ...entity })),
    periods,
    data,
    sources: parent.sources.map(source => ({ ...source })),
    ...(parent.query ? { query: { ...parent.query, entities: [...parent.query.entities] } } : {}),
  }
}

/** 绝对值最大的一格变化；并列取先出现者；全空返回 null */
export function largestAbsDelta(dataset: ResearchDataset): ResearchDataPoint | null {
  let best: ResearchDataPoint | null = null
  for (const point of dataset.data) {
    if (point.value == null) continue
    if (!best || Math.abs(point.value) > Math.abs(best.value ?? 0)) best = point
  }
  return best
}
