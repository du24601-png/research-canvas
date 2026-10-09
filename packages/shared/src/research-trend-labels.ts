/**
 * M2-E2：由代码给出的趋势标签（不含任何数值）。模型说「上升 / 下降 / 哪年最高」时
 * 应当照抄这里，而不是凭印象。只看有值的年份；有值少于两年 → 「数据不足」。
 */
import type { ResearchDataset } from './research-dataset.js'

export type TrendDirection = '上升' | '下降' | '基本持平' | '波动' | '数据不足'

export interface EntityTrendLabel {
  name: string
  direction: TrendDirection
  highestPeriod?: string
  lowestPeriod?: string
  missingPeriods?: string[]
}

/** 首尾变动小于全程振幅的 10% 视为基本持平；中途反向超过振幅一半视为波动 */
const FLAT_SHARE = 0.1
const SWING_SHARE = 0.5

function direction(values: number[]): TrendDirection {
  if (values.length < 2) return '数据不足'
  const first = values[0] ?? 0
  const last = values[values.length - 1] ?? 0
  const range = Math.max(...values) - Math.min(...values)
  if (range === 0) return '基本持平'
  const net = last - first
  let against = 0
  for (let i = 1; i < values.length; i += 1) {
    const step = (values[i] ?? 0) - (values[i - 1] ?? 0)
    if (Math.sign(step) !== 0 && Math.sign(step) !== Math.sign(net)) against += Math.abs(step)
  }
  if (Math.abs(net) < range * FLAT_SHARE) return against > 0 ? '波动' : '基本持平'
  if (against > range * SWING_SHARE) return '波动'
  return net > 0 ? '上升' : '下降'
}

export function entityTrendLabels(dataset: ResearchDataset): EntityTrendLabel[] {
  return dataset.entities.map((entity) => {
    const points = dataset.periods.map(period => ({
      period,
      value: dataset.data.find(p => p.entityId === entity.id && p.period === period)?.value ?? null,
    }))
    const present = points.filter((p): p is { period: string; value: number } => typeof p.value === 'number')
    const missing = points.filter(p => p.value == null).map(p => p.period)
    const label: EntityTrendLabel = { name: entity.name, direction: direction(present.map(p => p.value)) }
    if (present.length >= 2) {
      label.highestPeriod = present.reduce((a, b) => (b.value > a.value ? b : a)).period
      label.lowestPeriod = present.reduce((a, b) => (b.value < a.value ? b : a)).period
    }
    if (missing.length) label.missingPeriods = missing
    return label
  })
}
