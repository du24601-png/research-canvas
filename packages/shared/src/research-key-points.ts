/**
 * KeyPoints（要点）：由代码从 Dataset 计算确定性信号，按固定优先级挑 2–3 条，措辞是代码里的固定中文模板。
 * 模型不写要点文字、不给数字。模板复用 NumberSentence 的占位符（{value:…} / {gap:…} / {largestChange} /
 * {entity:…}），前端用同一套代码把占位符换成带来源浮层的引用 chip。
 *
 * 信号（优先级从高到低）：
 * 1. extreme：某实体最新一期数值是区间内最高 / 最低（至少三期有值，严格大于 / 小于其余各期）
 * 2. streak：某实体截至最新一期连续 N 年上升 / 下降（N ≥ 2，相邻两期都有值才算）
 * 3. gap：前两个实体的差距在首末共同有值年份间扩大 / 收窄 / 反向
 * 4. largest_change：同比变化里绝对值最大的一格（yoyDeltaDataset + largestAbsDelta）
 * 5. missing：有数据没取到（单独保留一个名额：有缺数时最多 2 条信号 + 1 条缺数说明）
 *
 * 挑选：先每个数据集取其最高优先级的一条，再按优先级补齐；同一数据集同一实体的 extreme / streak 只留一条。
 * 判断一律用「显示出来的数」（与前端 formatNumber 同样的舍入），显示相同就不算升降 / 扩大，避免文字与 chip 打架。
 * 「连续 N 年」「有 N 处」里的 N 是代码按年份 / 格子数出来的计数，不是模型写的数，所以直接写在文字里。
 */
import { largestAbsDelta, yoyDeltaDataset } from './research-dataset-delta.js'
import type { ResearchDataset } from './research-dataset.js'
import { isKlineMetricId, resolveResearchMetric } from './research-metrics.js'

export type KeyPointKind = 'extreme' | 'streak' | 'gap' | 'largest_change' | 'missing'

export interface KeyPointRef {
  entityId: string
  period: string
}

export interface KeyPoint {
  kind: KeyPointKind
  datasetId: string
  entityIds: string[]
  periods: string[]
  /** 句子里引用的数值格子（与模板占位符一一对应，供测试与浮层核对） */
  refs: KeyPointRef[]
  /** 缺数说明汇总了多个数据集时，列出全部涉及的数据集 */
  datasetIds?: string[]
  /** 固定中文模板 + NumberSentence 占位符；数字由前端代码从 Dataset 填 */
  template: string
}

type KeyPointDataset = Pick<ResearchDataset, 'id' | 'metric' | 'unit' | 'entities' | 'periods' | 'data'> & Partial<ResearchDataset>

export const KEY_POINT_LIMIT = 3
const PRIORITY: readonly KeyPointKind[] = ['extreme', 'streak', 'gap', 'largest_change']
const YEAR_PERIOD = /^(?:19|20)\d{2}$/

function metricName(dataset: KeyPointDataset): string {
  return resolveResearchMetric(dataset.metric)?.name ?? '该指标'
}

function valueAt(dataset: KeyPointDataset, entityId: string, period: string): number | null {
  const hit = dataset.data.find(point => point.entityId === entityId && point.period === period)
  return typeof hit?.value === 'number' && Number.isFinite(hit.value) ? hit.value : null
}

/** 与前端 formatNumber 相同的舍入：|v| ≥ 0.095 或为零保留一位，否则两位 */
export function displayedNumber(value: number): number {
  const abs = Math.abs(value)
  const digits = abs >= 0.095 || value === 0 ? 1 : 2
  const rounded = Number(abs.toFixed(digits))
  return value < 0 ? -rounded : rounded
}

function shownAt(dataset: KeyPointDataset, entityId: string, period: string): number | null {
  const value = valueAt(dataset, entityId, period)
  return value == null ? null : displayedNumber(value)
}

function adjacentYears(prev: string, next: string): boolean {
  return Number(next) - Number(prev) === 1
}

function filledPeriods(dataset: KeyPointDataset, entityId: string): string[] {
  return dataset.periods.filter(period => valueAt(dataset, entityId, period) != null)
}

/** 最新一期是区间最高 / 最低 */
export function extremeSignal(dataset: KeyPointDataset, entityId: string): KeyPoint | null {
  const filled = filledPeriods(dataset, entityId)
  if (filled.length < 3) return null
  const first = filled[0] ?? ''
  const latest = filled[filled.length - 1] ?? ''
  const current = shownAt(dataset, entityId, latest) ?? 0
  const others = filled.slice(0, -1).map(period => shownAt(dataset, entityId, period) ?? 0)
  const high = others.every(value => current > value)
  const low = others.every(value => current < value)
  if (!high && !low) return null
  const word = high ? '最高' : '最低'
  return {
    kind: 'extreme',
    datasetId: dataset.id,
    entityIds: [entityId],
    periods: [first, latest],
    refs: [{ entityId, period: latest }],
    template: `{entity:${entityId}} ${metricName(dataset)} ${latest} 年为 {value:${entityId}@${latest}}，是 ${first}–${latest} 年的${word}值。`,
  }
}

/** 截至最新一期连续 N 年上升 / 下降（N ≥ 2）；年份不相邻或显示值相同即中断 */
export function streakSignal(dataset: KeyPointDataset, entityId: string): KeyPoint | null {
  const latestFilled = filledPeriods(dataset, entityId).pop()
  if (!latestFilled) return null
  let i = dataset.periods.indexOf(latestFilled)
  let direction = 0
  let count = 0
  while (i > 0) {
    const period = dataset.periods[i] ?? ''
    const prev = dataset.periods[i - 1] ?? ''
    const now = shownAt(dataset, entityId, period)
    const before = shownAt(dataset, entityId, prev)
    if (!adjacentYears(prev, period) || now == null || before == null || now === before) break
    const sign = now > before ? 1 : -1
    if (direction !== 0 && sign !== direction) break
    direction = sign
    count += 1
    i -= 1
  }
  if (count < 2) return null
  const start = dataset.periods[i] ?? ''
  const word = direction > 0 ? '上升' : '下降'
  return {
    kind: 'streak',
    datasetId: dataset.id,
    entityIds: [entityId],
    periods: [start, latestFilled],
    refs: [{ entityId, period: latestFilled }],
    template: `{entity:${entityId}} ${metricName(dataset)}在 ${start}–${latestFilled} 年连续 ${count} 年${word}，${latestFilled} 年为 {value:${entityId}@${latestFilled}}。`,
  }
}

function gapWording(a: string, b: string, from: string, to: string, g0: number, g1: number, metric: string): string | null {
  const fromChip = `{gap:${a}@${b}@${from}}`
  const toChip = `{gap:${a}@${b}@${to}}`
  if (g0 !== 0 && g1 !== 0 && Math.sign(g0) !== Math.sign(g1)) {
    return `{entity:${a}} 与 {entity:${b}} 的${metric}差距由 ${from} 年的 ${fromChip} 变为 ${to} 年的 ${toChip}，高低位置互换。`
  }
  if (Math.abs(g1) === Math.abs(g0)) return null
  const word = Math.abs(g1) > Math.abs(g0) ? '扩大' : '收窄'
  return `{entity:${a}} 与 {entity:${b}} 的${metric}差距由 ${from} 年的 ${fromChip} ${word}到 ${to} 年的 ${toChip}。`
}

/** 前两个实体的差距在首末共同有值年份间的走向 */
export function gapSignal(dataset: KeyPointDataset): KeyPoint | null {
  const [ea, eb] = dataset.entities
  if (!ea || !eb) return null
  const common = dataset.periods.filter(p => valueAt(dataset, ea.id, p) != null && valueAt(dataset, eb.id, p) != null)
  if (common.length < 2) return null
  const from = common[0] ?? ''
  const to = common[common.length - 1] ?? ''
  // 与 gap chip 一样：原值相减后再按显示舍入
  const gapAt = (p: string) => displayedNumber((valueAt(dataset, ea.id, p) ?? 0) - (valueAt(dataset, eb.id, p) ?? 0))
  const template = gapWording(ea.id, eb.id, from, to, gapAt(from), gapAt(to), metricName(dataset))
  if (!template) return null
  return {
    kind: 'gap',
    datasetId: dataset.id,
    entityIds: [ea.id, eb.id],
    periods: [from, to],
    refs: [ea.id, eb.id].flatMap(entityId => [{ entityId, period: from }, { entityId, period: to }]),
    template,
  }
}

/** 同比变化里绝对值最大的一格；至少两格可比才有意义 */
export function largestChangeSignal(dataset: KeyPointDataset): KeyPoint | null {
  const body = yoyDeltaDataset({ title: '', sources: [], ...dataset })
  if ('error' in body) return null
  if (body.data.filter(point => point.value != null).length < 2) return null
  const best = largestAbsDelta({ ...body, id: `${dataset.id}-yoy-local` })
  if (!best || best.value == null || displayedNumber(best.value) === 0) return null
  const prev = dataset.periods[dataset.periods.indexOf(best.period) - 1] ?? ''
  return {
    kind: 'largest_change',
    datasetId: dataset.id,
    entityIds: [best.entityId],
    periods: [prev, best.period],
    refs: [{ entityId: best.entityId, period: prev }, { entityId: best.entityId, period: best.period }],
    template: `${metricName(dataset)}单年变化最大的一处：{largestChange}。`,
  }
}

function missingCells(dataset: KeyPointDataset): KeyPointRef[] {
  return dataset.entities.flatMap(entity => dataset.periods
    .filter(period => valueAt(dataset, entity.id, period) == null)
    .map(period => ({ entityId: entity.id, period })))
}

/** 缺数说明：汇总所有数据集，逐个指标写明几处没取到；只数位置，不补值 */
export function missingSignal(datasets: readonly KeyPointDataset[]): KeyPoint | null {
  const hits = datasets.map(dataset => ({ dataset, cells: missingCells(dataset) })).filter(hit => hit.cells.length)
  const first = hits[0]
  if (!first) return null
  const cells = hits.flatMap(hit => hit.cells)
  const periods = hits.flatMap(hit => hit.dataset.periods)
  const counts = hits.map(hit => `${metricName(hit.dataset)}有 ${hit.cells.length} 处`).join('、')
  return {
    kind: 'missing',
    datasetId: first.dataset.id,
    datasetIds: hits.map(hit => hit.dataset.id),
    entityIds: [...new Set(cells.map(cell => cell.entityId))],
    periods: [...new Set(periods)].filter(period => cells.some(cell => cell.period === period)).sort(),
    refs: [],
    template: `${counts}数据没有取到，图表和表格里显示为 —，不补值，也不按零处理。`,
  }
}

function hasYearPeriods(dataset: KeyPointDataset): boolean {
  return !isKlineMetricId(dataset.metric) && dataset.periods.length > 0 && dataset.periods.every(p => YEAR_PERIOD.test(p))
}

/** 单个数据集的全部候选信号，已按优先级排好 */
export function datasetSignals(dataset: KeyPointDataset): KeyPoint[] {
  if (!hasYearPeriods(dataset)) return []
  const perEntity = dataset.entities.flatMap(entity => [extremeSignal(dataset, entity.id), streakSignal(dataset, entity.id)])
  const all = [...perEntity, gapSignal(dataset), largestChangeSignal(dataset)]
    .filter((point): point is KeyPoint => point != null)
  return all.sort((a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind))
}

function dedupeKey(point: KeyPoint): string {
  const group = point.kind === 'extreme' || point.kind === 'streak' ? 'level' : point.kind
  return `${point.datasetId}|${point.entityIds.join(',')}|${group}`
}

function byPriority(a: KeyPoint, b: KeyPoint): number {
  return PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind)
}

/** 2–3 条要点：确定性挑选，同样的输入永远得到同样的输出 */
export function computeKeyPoints(datasets: readonly KeyPointDataset[]): KeyPoint[] {
  const perDataset = datasets.map(datasetSignals)
  const firsts = perDataset.flatMap(list => list.slice(0, 1)).sort(byPriority)
  const rest = perDataset.flatMap(list => list.slice(1)).sort(byPriority)
  const missing = missingSignal(datasets.filter(hasYearPeriods))
  const limit = missing ? KEY_POINT_LIMIT - 1 : KEY_POINT_LIMIT
  const picked: KeyPoint[] = []
  const seen = new Set<string>()
  for (const point of [...firsts, ...rest]) {
    if (picked.length >= limit) break
    if (seen.has(dedupeKey(point))) continue
    seen.add(dedupeKey(point))
    picked.push(point)
  }
  return missing ? [...picked, missing] : picked
}
