import type { ChatToolStep } from '../../types/chatProgress'
import type { Dataset } from '../research-canvas/types'
import { parseToolStepJson } from '../research-canvas/proposalFromToolStep'
import { researchMetricLabel } from '../research-canvas/sourcePresentation'

/** 取数摘要：只从工具步骤与已落盘数据集读取，不推算任何数字 */
export interface TraceSummary {
  /**
   * 公司 / 指标与年份，等宽小标签。
   * 口径（年报 / 合并 / 加权等）目前数据集与步骤结果都没有记录，因此不出标签，不按年份格式推断。
   */
  tags: string[]
  /** 缺失说明（琥珀色），没有缺失时为 null */
  missing: string | null
}

export type DatasetLookup = (datasetId: string) => Dataset | undefined

interface DatasetDigest {
  names: string[]
  metricId: string
  start: string
  end: string
  missingItems: string[]
  missingCount: number
}

const DATA_TOOLS = new Set(['query_data', 'refine_dataset'])
const NAME_TAG_LIMIT = 3
const MISSING_NAMED_LIMIT = 2

function readString(record: Record<string, unknown> | null, key: string): string {
  const value = record?.[key]
  return typeof value === 'string' ? value.trim() : ''
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map(item => item.trim())
}

function seriesNames(result: Record<string, unknown> | null): string[] {
  const series = result?.series
  if (!Array.isArray(series)) return []
  const names: string[] = []
  for (const row of series) {
    if (typeof row !== 'object' || row === null) continue
    const name = (row as Record<string, unknown>).name
    if (typeof name === 'string' && name.trim()) names.push(name.trim())
  }
  return names
}

function coverageGap(result: Record<string, unknown> | null): number {
  const coverage = result?.coverage
  if (typeof coverage !== 'object' || coverage === null) return 0
  const { filled, total } = coverage as Record<string, unknown>
  if (typeof filled !== 'number' || typeof total !== 'number') return 0
  return Math.max(0, total - filled)
}

/** 数据集里没有取到值的「公司 年份」 */
export function listMissingPoints(dataset: Dataset): string[] {
  if (dataset.metric === 'kline') return []
  const present = new Set(dataset.data.filter(point => point.value != null)
    .map(point => `${point.entityId}\t${point.period}`))
  const items: string[] = []
  for (const entity of dataset.entities) {
    for (const period of dataset.periods) {
      if (!present.has(`${entity.id}\t${period}`)) items.push(`${entity.name} ${period}`)
    }
  }
  return items
}

function digestFromDataset(dataset: Dataset): DatasetDigest {
  const missingItems = listMissingPoints(dataset)
  return {
    names: dataset.entities.map(entity => entity.name),
    metricId: dataset.metric,
    start: dataset.periods[0] ?? '',
    end: dataset.periods[dataset.periods.length - 1] ?? '',
    missingItems,
    missingCount: missingItems.length,
  }
}

function digestFromStep(step: ChatToolStep, lookup?: DatasetLookup): DatasetDigest | null {
  if (step.status !== 'done' || !DATA_TOOLS.has(step.tool)) return null
  const result = parseToolStepJson(step.resultDetail)
  if (!result || result.ok !== true) return null
  const datasetId = readString(result, 'datasetId')
  if (!datasetId) return null
  const dataset = lookup?.(datasetId)
  if (dataset) return digestFromDataset(dataset)
  const args = parseToolStepJson(step.argsDetail)
  const names = seriesNames(result)
  return {
    names: names.length ? names : readStringList(args?.entities),
    metricId: readString(result, 'metric') || readString(args, 'metric'),
    start: readString(args, 'start'),
    end: readString(args, 'end'),
    missingItems: [],
    missingCount: coverageGap(result),
  }
}

/** 已知指标给中文名；未知且非中文的内部编号不展示 */
export function readableMetricLabel(metricId: string): string {
  const label = researchMetricLabel(metricId)
  if (label !== '指标') return label
  return /[一-鿿]/u.test(metricId) ? metricId : ''
}

export function formatYearRange(start: string, end: string): string {
  if (!start && !end) return ''
  if (!start || !end || start === end) return start || end
  return `${start}–${end}`
}

function pushUnique(out: string[], value: string): void {
  if (value && !out.includes(value)) out.push(value)
}

function companyTags(names: string[]): string[] {
  if (names.length <= NAME_TAG_LIMIT + 1) return names
  return [...names.slice(0, NAME_TAG_LIMIT), `等 ${names.length} 家`]
}

export function formatMissingLabel(items: string[], count: number): string | null {
  if (count <= 0) return null
  if (items.length === count && count <= MISSING_NAMED_LIMIT) return `${items.join('、')} 无数据`
  return `缺 ${count} 项数据`
}

function mergeMissing(digests: DatasetDigest[]): string | null {
  const items: string[] = []
  let unnamed = 0
  for (const digest of digests) {
    if (digest.missingItems.length) digest.missingItems.forEach(item => pushUnique(items, item))
    else unnamed += digest.missingCount
  }
  return formatMissingLabel(items, items.length + unnamed)
}

export function buildTraceSummary(steps: ChatToolStep[], lookup?: DatasetLookup): TraceSummary {
  const digests = steps.map(step => digestFromStep(step, lookup))
    .filter((digest): digest is DatasetDigest => digest !== null)
  const names: string[] = []
  const metricTags: string[] = []
  for (const digest of digests) {
    digest.names.forEach(name => pushUnique(names, name))
    const metric = readableMetricLabel(digest.metricId)
    pushUnique(metricTags, [metric, formatYearRange(digest.start, digest.end)].filter(Boolean).join(' '))
  }
  return { tags: [...companyTags(names), ...metricTags], missing: mergeMissing(digests) }
}
