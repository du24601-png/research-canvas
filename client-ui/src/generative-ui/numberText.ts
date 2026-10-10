/**
 * KpiRow / NumberSentence 的纯计算：所有数字都由这里从 Dataset 读或算，模型只给占位符。
 * 缺值一律显示「—」，不补值。百分比指标的变化用「个百分点」，其余指标用变化率（%）。
 * 例外：{largestChange} 挑的是绝对变化最大的一格（shared largestAbsDelta），非百分比指标显示为
 * 带原单位的「变化额」，并在文字里写明，避免和 {delta} 的变化率混淆。
 */
import { largestAbsDelta, yoyDeltaDataset, yoyDeltaUnit } from '@opptrix/shared/research-dataset-delta'
import { tokenizeNumberSentence, type NumberSentenceToken } from '@opptrix/shared/research-ui-spec-text'
import { entityNameForId, findSourceForCell } from '../chat/research-canvas/sourceLookup'
import { readableFetchTime, researchMetricLabel, sourceProviderLabel } from '../chat/research-canvas/sourcePresentation'
import { pointValue } from '../chat/research-canvas/views'
import type { Dataset } from '../chat/research-canvas/types'

export const MISSING = '—'
const KPI_LIMIT = 3

export function formatNumber(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return MISSING
  const abs = Math.abs(value)
  const text = abs >= 0.095 || value === 0 ? abs.toFixed(1) : abs.toFixed(2)
  // 负号统一用「−」，与变化值一致
  return value < 0 && Number(text) !== 0 ? `−${text}` : text
}

function signed(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  return `${sign}${formatNumber(Math.abs(value))}`
}

function isRatio(dataset: Dataset): boolean {
  return dataset.unit === '%'
}

function previousPeriod(dataset: Dataset, period: string): string | undefined {
  const i = dataset.periods.indexOf(period)
  return i > 0 ? dataset.periods[i - 1] : undefined
}

/** 较上一期变化（文字含单位）；缺任一期或上期为零（算不出变化率）→「—」 */
export function changeText(dataset: Dataset, entityId: string, period: string): string {
  const prev = previousPeriod(dataset, period)
  const current = pointValue(dataset, entityId, period)
  const before = prev ? pointValue(dataset, entityId, prev) : null
  if (current == null || before == null) return MISSING
  if (isRatio(dataset)) return `${signed(current - before)} ${yoyDeltaUnit(dataset.unit)}`
  if (before === 0) return MISSING
  return `${signed(((current - before) / Math.abs(before)) * 100)}%`
}

export function gapText(dataset: Dataset, a: string, b: string, period: string): string {
  const va = pointValue(dataset, a, period)
  const vb = pointValue(dataset, b, period)
  if (va == null || vb == null) return MISSING
  return `${signed(va - vb)} ${yoyDeltaUnit(dataset.unit)}`.trim()
}

export function valueText(dataset: Dataset, entityId: string, period: string): string {
  const value = pointValue(dataset, entityId, period)
  return value == null ? MISSING : `${formatNumber(value)}${dataset.unit === '%' ? '%' : ` ${dataset.unit}`.trimEnd()}`
}

/** 默认年份：最后一个至少有一个实体有数值的年份 */
export function defaultKpiPeriod(dataset: Dataset): string | undefined {
  const filled = dataset.periods.filter(period => dataset.data.some(p => p.period === period && p.value != null))
  return filled[filled.length - 1] ?? dataset.periods[dataset.periods.length - 1]
}

export interface KpiFigure {
  entityId: string
  label: string
  value: string
  unit: string
  delta: string | null
}

export function kpiFigures(dataset: Dataset, period?: string): KpiFigure[] {
  const at = period ?? defaultKpiPeriod(dataset)
  if (!at) return []
  const prev = previousPeriod(dataset, at)
  const metric = researchMetricLabel(dataset.metric)
  return dataset.entities.slice(0, KPI_LIMIT).map(entity => {
    const value = pointValue(dataset, entity.id, at)
    return {
      entityId: entity.id,
      label: `${entity.name} · ${metric} ${at}`,
      value: formatNumber(value),
      unit: value == null ? '' : dataset.unit,
      delta: prev ? `较 ${prev} 年 ${changeText(dataset, entity.id, at)}` : null,
    }
  })
}

/** 引用浮层：公司、期间、指标口径与来源（只有 Dataset 里记录了的才显示） */
export interface Citation {
  entity: string
  period: string
  lines: string[]
}

function citationLines(dataset: Dataset, entityIds: readonly string[], period: string): string[] {
  const unit = dataset.unit || '单位未记录'
  const lines = [`指标：${researchMetricLabel(dataset.metric)}（${unit}）`]
  const source = entityIds.map(id => findSourceForCell(dataset, id, period)).find(Boolean)
  lines.push(`来源：${source ? sourceProviderLabel(source.provider) : '来源未标注'}`)
  if (source?.fieldLabel) lines.push(`口径：${source.fieldLabel}`)
  if (source?.fetchedAt) lines.push(readableFetchTime(source.fetchedAt))
  return lines
}

export function citationFor(dataset: Dataset, entityIds: readonly string[], period: string, periodText?: string): Citation {
  return {
    entity: entityIds.map(id => entityNameForId(dataset, id)).join(' 对 '),
    period: periodText ?? `${period} 年`,
    lines: citationLines(dataset, entityIds, period),
  }
}

export type SentencePart =
  | { kind: 'text'; text: string }
  | { kind: 'chip'; text: string; index: number; citation: Citation }

type ChipBody = { text: string; citation: Citation; prefix?: string }

function largestChangeChip(dataset: Dataset): ChipBody {
  const body = yoyDeltaDataset(dataset)
  const best = 'error' in body ? null : largestAbsDelta({ ...body, id: `${dataset.id}-yoy-local` })
  if (!best || best.value == null) return { text: MISSING, citation: citationFor(dataset, [], '', '变化最大的一处') }
  const prev = previousPeriod(dataset, best.period) ?? ''
  return {
    prefix: `${entityNameForId(dataset, best.entityId)} ${best.period} 年较上年${isRatio(dataset) ? '' : '变化额'} `,
    text: `${signed(best.value)} ${yoyDeltaUnit(dataset.unit)}`.trim(),
    citation: citationFor(dataset, [best.entityId], best.period, `${prev}–${best.period} 年`),
  }
}

function chipFor(dataset: Dataset, token: Exclude<NumberSentenceToken, { kind: 'text' | 'entity' }>): ChipBody {
  if (token.kind === 'largestChange') return largestChangeChip(dataset)
  if (token.kind === 'value') return { text: valueText(dataset, token.entityId, token.period), citation: citationFor(dataset, [token.entityId], token.period) }
  if (token.kind === 'delta') {
    const prev = previousPeriod(dataset, token.period) ?? ''
    return { text: changeText(dataset, token.entityId, token.period), citation: citationFor(dataset, [token.entityId], token.period, `${prev}–${token.period} 年`) }
  }
  return {
    text: gapText(dataset, token.entityId, token.otherEntityId, token.period),
    citation: citationFor(dataset, [token.entityId, token.otherEntityId], token.period),
  }
}

/** 模板 → 文本段 + 引用 chip；数字只来自 chipFor */
export function sentenceParts(dataset: Dataset, template: string): SentencePart[] {
  const parts: SentencePart[] = []
  let index = 0
  for (const token of tokenizeNumberSentence(template)) {
    if (token.kind === 'text') parts.push(token)
    else if (token.kind === 'entity') parts.push({ kind: 'text', text: entityNameForId(dataset, token.entityId) })
    else {
      const chip = chipFor(dataset, token)
      if (chip.prefix) parts.push({ kind: 'text', text: chip.prefix })
      index += 1
      parts.push({ kind: 'chip', text: chip.text, index, citation: chip.citation })
    }
  }
  return parts
}
