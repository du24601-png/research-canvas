import type { ResearchCellRef } from '../sourceLookup'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 点击到的 Vega 数据行 → 单元格引用。行里自带 entityId + period，不再按下标反查；
 * 缺 entityId（如组合图的均值线）或 period 的行不可点开来源。
 */
export function cellFromDatum(datum: unknown): ResearchCellRef | null {
  if (!isRecord(datum)) return null
  const { entityId, period } = datum
  if (typeof entityId !== 'string' || !entityId) return null
  if (typeof period !== 'string' || !period) return null
  return { entityId, period }
}
