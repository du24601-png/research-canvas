/**
 * MetricTable 的纯计算：单元格文字、底色深浅、迷你走势线、首年→末年变化，全部由代码从 Dataset 读或算。
 * 布局：每个数据集一张小表（行 = 公司，列 = 年份，再加走势与首末变化两列），多个数据集纵向排列。
 * 缺值一律「—」，不补值；底色只在同一数据集内按数值高低做灰度深浅，缺值无底色。
 */
import { yoyDeltaUnit } from '@opptrix/shared/research-dataset-delta'
import { researchMetricLabel } from '../chat/research-canvas/sourcePresentation'
import { pointValue } from '../chat/research-canvas/views'
import type { Dataset } from '../chat/research-canvas/types'
import { formatNumber, isRatio, MISSING, signed } from './numberText'

const SHADE_MIN = 0.03
const SHADE_SPAN = 0.15
export const SPARK_WIDTH = 56
export const SPARK_HEIGHT = 16

export interface MetricCell {
  period: string
  value: number | null
  text: string
  /** 0–1 的灰度强度；缺值为 null */
  shade: number | null
}

export interface MetricRow {
  entityId: string
  name: string
  cells: MetricCell[]
  spark: string | null
  change: string
}

export interface MetricTableModel {
  datasetId: string
  caption: string
  periods: string[]
  changeHeader: string
  rows: MetricRow[]
}

/** 单元格文字：百分比带「%」，其余只写数字（单位在表头说明） */
export function cellText(dataset: Dataset, value: number | null): string {
  if (value == null) return MISSING
  return isRatio(dataset) ? `${formatNumber(value)}%` : formatNumber(value)
}

/** 首年→末年变化：百分比指标用「个百分点」，其余用变化率；任一端缺值或首年为零 →「—」 */
export function firstLastChange(dataset: Dataset, entityId: string): string {
  const first = dataset.periods[0]
  const last = dataset.periods[dataset.periods.length - 1]
  if (!first || !last || first === last) return MISSING
  const before = pointValue(dataset, entityId, first)
  const after = pointValue(dataset, entityId, last)
  if (before == null || after == null) return MISSING
  if (isRatio(dataset)) return `${signed(after - before)} ${yoyDeltaUnit(dataset.unit)}`
  if (before === 0) return MISSING
  return `${signed(((after - before) / Math.abs(before)) * 100)}%`
}

/** 迷你走势线的 SVG path；缺值处断开；有值少于两期返回 null */
export function sparkPath(values: ReadonlyArray<number | null>, width = SPARK_WIDTH, height = SPARK_HEIGHT): string | null {
  const filled = values.filter((v): v is number => v != null && Number.isFinite(v))
  if (filled.length < 2 || values.length < 2) return null
  const min = Math.min(...filled)
  const max = Math.max(...filled)
  const step = width / (values.length - 1)
  const y = (v: number) => (max === min ? height / 2 : height - ((v - min) / (max - min)) * height)
  let path = ''
  let pen = false
  values.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) { pen = false; return }
    path += `${pen ? 'L' : 'M'}${(i * step).toFixed(1)} ${y(v).toFixed(1)} `
    pen = true
  })
  return path.trim()
}

function shadeScale(dataset: Dataset): (value: number | null) => number | null {
  const values = dataset.data.map(p => p.value).filter((v): v is number => v != null && Number.isFinite(v))
  const min = Math.min(...values)
  const max = Math.max(...values)
  return value => {
    if (value == null || !values.length) return null
    return max === min ? 0.5 : (value - min) / (max - min)
  }
}

/** 灰度底色（墨色按强度取透明度），不用彩色 */
export function shadeAlpha(shade: number | null): number {
  return shade == null ? 0 : SHADE_MIN + SHADE_SPAN * shade
}

export function metricTableModel(dataset: Dataset): MetricTableModel {
  const scale = shadeScale(dataset)
  const first = dataset.periods[0] ?? ''
  const last = dataset.periods[dataset.periods.length - 1] ?? first
  return {
    datasetId: dataset.id,
    caption: `${researchMetricLabel(dataset.metric)}（${dataset.unit || '单位未记录'}）`,
    periods: [...dataset.periods],
    changeHeader: `${first}→${last}`,
    rows: dataset.entities.map(entity => {
      const values = dataset.periods.map(period => pointValue(dataset, entity.id, period))
      return {
        entityId: entity.id,
        name: entity.name,
        cells: dataset.periods.map((period, i) => ({ period, value: values[i] ?? null, text: cellText(dataset, values[i] ?? null), shade: scale(values[i] ?? null) })),
        spark: sparkPath(values),
        change: firstLastChange(dataset, entity.id),
      }
    }),
  }
}
