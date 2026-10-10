/**
 * UI Spec 里「带数字的文字」组件（KpiRow / NumberSentence）的严格校验与模板切分。
 * 模板只允许占位符引用 Dataset 里的格子，数字由前端代码从 Dataset 取或算；
 * 去掉占位符和数据集里的年份后仍有任何数字（半角 / 全角 / 其它数字字符 / 中文数字）→ 整份拒绝。
 */

/** 校验需要的 Dataset 元信息：实体 id 与期间（不含数值） */
export interface ResearchUiTextDatasetRef {
  entityIds?: readonly string[]
  periods?: readonly string[]
}

export type NumberSentenceToken =
  | { kind: 'text'; text: string }
  | { kind: 'value'; entityId: string; period: string }
  | { kind: 'delta'; entityId: string; period: string }
  | { kind: 'gap'; entityId: string; otherEntityId: string; period: string }
  | { kind: 'largestChange' }
  | { kind: 'entity'; entityId: string }

/** 可读文字上限：每个占位符按 1 字计（实体 id 很长，不该挤占句子本身） */
export const NUMBER_SENTENCE_MAX = 120
/** 模板原文（含占位符）的硬上限 */
const TEMPLATE_RAW_MAX = 400

const ID = '[^{}@\\s]+'
const YEAR = '(?:19|20)\\d{2}'
const PLACEHOLDER = new RegExp(
  `\\{(?:(value|delta):(${ID})@(${YEAR})|gap:(${ID})@(${ID})@(${YEAR})|(largestChange)|entity:(${ID}))\\}`,
  'g',
)
/**
 * 年份只认「有年份语境」的四位数：后面紧跟 年 / 度 / 区间连接符，或前面是「年份 + 连接符」（如 2023–2025）。
 * 「营收达 2000」「2025港元」这类没有年份语境的四位数一律当数值。
 */
const YEAR_IN_CONTEXT = /(?<!\d)(\d{4})(?=\s*(?:年|度|–|—|-|至|到|~))|(?<=\d{4}\s*(?:–|—|-|至|到|~)\s*)(\d{4})(?!\d)/g
/** 任何数字字符（含全角、上标、圈码、〇）与百分号 */
const DIGIT_LIKE = /[\p{N}%％‰]/u
/** 含中文数字字但不表示数量的常用词，先剔除再查 */
const CJK_NON_QUANTITY = [
  '另一方面', '一方面', '进一步', '百分点', '半导体', '上半年', '下半年',
  '一致', '统一', '第一', '唯一', '同一', '一起', '一直', '一定', '一般', '一样', '一贯', '几乎',
]
/** 中文数字字（含「半」「几」）与「翻番」等数量说法 */
const CJK_QUANTITY = /[零〇一二三四五六七八九十两百千万亿半几]|翻番/

function stripYears(text: string, periods: readonly string[]): { rest: string; unknownYear?: string } {
  let unknownYear: string | undefined
  const rest = text.replace(YEAR_IN_CONTEXT, (whole: string) => {
    if (periods.includes(whole)) return ' '
    unknownYear ??= whole
    return whole
  })
  return unknownYear ? { rest, unknownYear } : { rest }
}

/** 去掉占位符与数据集年份后剩下的数字泄漏；无泄漏返回 null */
export function findDigitLeak(text: string, periods: readonly string[]): string | null {
  const { rest, unknownYear } = stripYears(text.replace(PLACEHOLDER, ' '), periods)
  if (unknownYear) return `年份 ${unknownYear} 不在数据集里`
  if (DIGIT_LIKE.test(rest)) return '不能直接写数字'
  const words = CJK_NON_QUANTITY.reduce((acc, word) => acc.split(word).join(' '), rest)
  if (CJK_QUANTITY.test(words)) return '不能用中文数字写数量'
  return null
}

function tokenFromMatch(m: RegExpMatchArray): NumberSentenceToken {
  const [, kind, entityId, period, gapA, gapB, gapPeriod, largest, entity] = m
  if ((kind === 'value' || kind === 'delta') && entityId && period) return { kind, entityId, period }
  if (gapA && gapB && gapPeriod) return { kind: 'gap', entityId: gapA, otherEntityId: gapB, period: gapPeriod }
  if (largest) return { kind: 'largestChange' }
  return { kind: 'entity', entityId: entity ?? '' }
}

function visibleLength(template: string): number {
  return template.replace(PLACEHOLDER, '#').length
}

/** 把模板切成文本段与占位符；只做切分，不校验 */
export function tokenizeNumberSentence(template: string): NumberSentenceToken[] {
  const tokens: NumberSentenceToken[] = []
  let last = 0
  for (const m of template.matchAll(PLACEHOLDER)) {
    const at = m.index ?? 0
    if (at > last) tokens.push({ kind: 'text', text: template.slice(last, at) })
    tokens.push(tokenFromMatch(m))
    last = at + m[0].length
  }
  if (last < template.length) tokens.push({ kind: 'text', text: template.slice(last) })
  return tokens
}

function checkToken(token: NumberSentenceToken, ref: ResearchUiTextDatasetRef, at: string, errors: string[]): void {
  if (token.kind === 'text' || token.kind === 'largestChange') return
  const entities = token.kind === 'gap' ? [token.entityId, token.otherEntityId] : [token.entityId]
  for (const id of entities) {
    if (!ref.entityIds?.includes(id)) errors.push(`${at} 引用了数据集里没有的实体 ${id}`)
  }
  if (token.kind === 'entity') return
  const periods = ref.periods ?? []
  if (!periods.includes(token.period)) errors.push(`${at} 引用了数据集里没有的年份 ${token.period}`)
  if (token.kind === 'delta' && periods[0] === token.period) errors.push(`${at} 的 delta 不能用第一个年份（没有上一年可比）`)
  if (token.kind === 'gap' && token.entityId === token.otherEntityId) errors.push(`${at} 的 gap 须是两个不同实体`)
}

/** NumberSentence.template 的整份校验，返回去首尾空白后的模板 */
export function checkNumberSentenceTemplate(raw: unknown, ref: ResearchUiTextDatasetRef | undefined, at: string, errors: string[]): string {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > TEMPLATE_RAW_MAX || visibleLength(raw) > NUMBER_SENTENCE_MAX) {
    errors.push(`${at}.template 须为 1–${NUMBER_SENTENCE_MAX} 字（占位符按 1 字计）`)
    return ''
  }
  const template = raw.trim()
  const leak = findDigitLeak(template, ref?.periods ?? [])
  if (leak) errors.push(`${at}.template ${leak}（数字只能用占位符）`)
  const tokens = tokenizeNumberSentence(template)
  if (tokens.some(token => token.kind === 'text' && /[{}]/.test(token.text))) errors.push(`${at}.template 含未知占位符`)
  if (!tokens.some(token => token.kind !== 'text' && token.kind !== 'entity')) errors.push(`${at}.template 至少要有一个数值占位符`)
  if (ref) tokens.forEach(token => checkToken(token, ref, `${at}.template`, errors))
  return template
}

/** KpiRow.period：可选，须为数据集里存在的四位年份 */
export function checkKpiPeriod(raw: unknown, ref: ResearchUiTextDatasetRef | undefined, at: string, errors: string[]): string | undefined {
  if (raw === undefined) return undefined
  if (typeof raw !== 'string' || !/^\d{4}$/.test(raw)) {
    errors.push(`${at}.period 须为四位年份`)
    return undefined
  }
  if (ref && !ref.periods?.includes(raw)) errors.push(`${at}.period ${raw} 不在数据集年份里`)
  return raw
}
