/**
 * 自然语言中文问句 → 3 字 gram 的 OR 查询。
 *
 * 问题：一整句中文没有空格，trigram 表把它当成一个短语去精确匹配，几乎必然 0 命中。
 * 做法：长词（> NATURAL_MIN_CHARS 字，即整句）去掉疑问/虚词，按标点与被去掉的词切段，
 * 每段取重叠 3 字 gram，去重、限量后以 OR 查询 trigram 表（bm25 排序）。
 */

/** 超过该字数的 CJK 词按「整句」处理；短词与 agent 关键词保持原有精确短语 */
export const NATURAL_MIN_CHARS = 6
/** gram 数上限，避免 MATCH 表达式过长 */
export const NATURAL_MAX_GRAMS = 24

/** 疑问词 / 虚词：句中任何位置都去掉（多字词在前，先匹配长的） */
export const NATURAL_STOP_WORDS: readonly string[] = [
  '为什么', '请问', '怎么', '什么', '如何', '是否', '哪些', '哪个', '多少', '一下',
  '吗', '呢', '吧', '的', '了',
]

/**
 * 仅在片段两端去掉的词：它们会出现在财务术语内部（在建工程、所有者权益、母公司），
 * 句中不能删，否则把术语切碎。
 */
export const NATURAL_EDGE_STOP_WORDS: readonly string[] = [
  '公司', '我们', '和', '与', '及', '在', '对', '把', '被', '有', '是', '我', '你', '等',
]

/** 命中门槛：至少匹配 2 个 gram，且不少于 gram 总数的 30% */
export const NATURAL_MIN_MATCHED = 2
export const NATURAL_MIN_RATIO = 0.3

export function naturalMinMatched(gramCount: number): number {
  return Math.min(gramCount, Math.max(NATURAL_MIN_MATCHED, Math.ceil(gramCount * NATURAL_MIN_RATIO)))
}

/** 仅保留字母数字与 CJK，其余（标点、符号）视为分隔 */
const SEGMENT_SPLIT_RE = /[^\p{L}\p{N}]+/u

export function isNaturalTerm(term: string): boolean {
  return Array.from(term).length > NATURAL_MIN_CHARS
}

/** 每端最多剥一个边缘虚词（「公司在建工程」只剥「公司」，保住「在建工程」） */
function stripEdges(seg: string): string {
  let cur = seg
  const head = NATURAL_EDGE_STOP_WORDS.find(w => cur.startsWith(w))
  if (head) cur = cur.slice(head.length)
  const tail = NATURAL_EDGE_STOP_WORDS.find(w => cur.endsWith(w))
  if (tail) cur = cur.slice(0, cur.length - tail.length)
  return cur
}

/** 切成片段：先去句中疑问词并按标点切开，再剥掉片段两端的边缘虚词 */
function naturalSegments(text: string): string[] {
  let out = text
  for (const w of NATURAL_STOP_WORDS) out = out.split(w).join(' ')
  return out.split(SEGMENT_SPLIT_RE).map(stripEdges).filter(Boolean)
}

/** 统计 chunk 文本里包含多少个 gram */
export function countMatchedGrams(text: string, grams: string[]): number {
  const lower = text.toLowerCase()
  return grams.filter(g => lower.includes(g.toLowerCase())).length
}

/** 从若干长词生成去重、限量的 3 字 gram（保持出现顺序） */
export function buildNaturalGrams(terms: string[], maxGrams = NATURAL_MAX_GRAMS): string[] {
  const seen = new Set<string>()
  const grams: string[] = []
  for (const term of terms) {
    for (const seg of naturalSegments(term)) {
      const chars = Array.from(seg)
      for (let i = 0; i + 3 <= chars.length; i++) {
        const g = chars.slice(i, i + 3).join('')
        if (seen.has(g)) continue
        seen.add(g)
        grams.push(g)
        if (grams.length >= maxGrams) return grams
      }
    }
  }
  return grams
}

/** OR 连接的 trigram MATCH 表达式；每个 gram 作为短语加引号 */
export function naturalMatchExpr(grams: string[]): string {
  return grams.map(g => `"${g.replace(/"/g, '""')}"`).join(' OR ')
}
