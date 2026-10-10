/**
 * 按页切 chunk（检索 / 向量化单元）。
 * - 目标约 CHUNK_TARGET_CHARS 字（中文约 500 字，适配 512 token 的小模型）
 * - 相邻 chunk 约 15% 重叠；绝不跨页
 * - 优先在段落 / 句末（。！？；\n）断开
 * - Markdown 表格块 ≤ 2× 目标时整块保留；更长的表按行切，每段重复表头
 * - 存储文本不加任何前缀（上下文前缀在向量化 / 检索时再拼）
 * offset = chunk 起点在「各页正文依次相接」中的字符位置。
 */
import type { ParseChunkInput } from '../types.js'

/** 每个 chunk 目标字数 */
export const CHUNK_TARGET_CHARS = 500

/** 相邻 chunk 重叠比例 */
export const CHUNK_OVERLAP_RATIO = 0.15

/** 表格整块保留上限 = 目标 × 此倍数 */
export const TABLE_BLOCK_MAX_FACTOR = 2

export type ChunkOptions = {
  targetChars?: number
  overlapRatio?: number
}

type Unit = { text: string; start: number; kind: 'prose' | 'table' }
type Block = { text: string; start: number; table: boolean }

const SENTENCE_END = new Set(['。', '！', '？', '；', '!', '?', ';', '\n'])
const TRAILING_CLOSERS = new Set(['”', '’', '」', '』', '）', ')', '"', '\'', '\n'])

function isTableLine(line: string): boolean {
  return line.trimStart().startsWith('|')
}

/** 把页文本按行拆成连续的「表格块 / 正文块」，保留原始字符位置 */
function splitBlocks(text: string): Block[] {
  const blocks: Block[] = []
  let pos = 0
  for (const line of text.split(/(?<=\n)/)) {
    const table = isTableLine(line)
    const last = blocks[blocks.length - 1]
    if (last && last.table === table) last.text += line
    else blocks.push({ text: line, start: pos, table })
    pos += line.length
  }
  return blocks
}

function isBoundaryAt(text: string, i: number): boolean {
  const ch = text[i] ?? ''
  if (SENTENCE_END.has(ch)) return true
  // 英文句号后跟空白
  return ch === '.' && /\s/.test(text[i + 1] ?? '')
}

/** 正文块 → 句子单元；超长句硬切 */
function proseUnits(block: Block, target: number): Unit[] {
  const units: Unit[] = []
  const t = block.text
  let from = 0
  const push = (to: number) => {
    for (let s = from; s < to; s += target) {
      units.push({ text: t.slice(s, Math.min(to, s + target)), start: block.start + s, kind: 'prose' })
    }
    from = to
  }
  for (let i = 0; i < t.length; i++) {
    if (!isBoundaryAt(t, i)) continue
    let end = i + 1
    while (end < t.length && TRAILING_CLOSERS.has(t[end] ?? '')) end += 1
    push(end)
    i = end - 1
  }
  if (from < t.length) push(t.length)
  return units.filter(u => u.text.trim())
}

/** 仅当第二行是 `| --- |` 分隔行时才认定有表头（表头 + 分隔行共 2 行），否则不重复 */
function headerLineCount(lines: string[]): number {
  const second = lines[1] ?? ''
  return /^\s*\|?\s*:?-{3,}/.test(second) ? 2 : 0
}

/** 表格块 → 单元；≤ 上限整块，否则按行切（有分隔行时每段重复表头） */
function tableUnits(block: Block, target: number): Unit[] {
  if (block.text.trim().length <= target * TABLE_BLOCK_MAX_FACTOR) {
    return [{ text: block.text, start: block.start, kind: 'table' }]
  }
  const lines = block.text.split(/(?<=\n)/)
  const headCount = headerLineCount(lines)
  const header = lines.slice(0, headCount).join('')
  const units: Unit[] = []
  let rows = ''
  let pos = block.start + header.length
  let rowsStart = pos
  for (const line of lines.slice(headCount)) {
    if (rows && header.length + rows.length + line.length > target) {
      units.push({ text: header + rows, start: rowsStart, kind: 'table' })
      rows = ''
      rowsStart = pos
    }
    rows += line
    pos += line.length
  }
  if (rows) units.push({ text: header + rows, start: rowsStart, kind: 'table' })
  if (units[0]) units[0].start = block.start
  return units
}

function pageUnits(text: string, target: number): Unit[] {
  return splitBlocks(text).flatMap(b => (b.table ? tableUnits(b, target) : proseUnits(b, target)))
}

/** 取上一 chunk 尾部作为重叠：优先整句，否则从句首对齐截尾 */
function overlapTail(units: Unit[], overlap: number): Unit[] {
  if (overlap <= 0) return []
  const out: Unit[] = []
  let len = 0
  for (let i = units.length - 1; i >= 0; i--) {
    const u = units[i]
    if (!u || u.kind !== 'prose') break
    if (len + u.text.length > overlap) {
      if (out.length) break
      const cut = u.text.length - overlap
      let s = cut
      for (let j = cut; j < u.text.length - 1; j++) {
        if (isBoundaryAt(u.text, j)) { s = j + 1; break }
      }
      return [{ text: u.text.slice(s), start: u.start + s, kind: 'prose' }]
    }
    out.unshift(u)
    len += u.text.length
  }
  return out
}

function unitsLength(units: Unit[]): number {
  return units.reduce((n, u) => n + u.text.length, 0)
}

/** 贪心装箱：单元 → chunk 组（每组为一个 chunk 的单元序列） */
function packUnits(units: Unit[], target: number, overlap: number): Unit[][] {
  const groups: Unit[][] = []
  let cur: Unit[] = []
  let fresh = 0
  const flush = () => {
    if (fresh > 0) groups.push(cur)
    cur = []
    fresh = 0
  }
  for (const u of units) {
    if (u.text.length > target) {
      flush()
      groups.push([u])
      continue
    }
    if (fresh > 0 && unitsLength(cur) + u.text.length > target) {
      const tail = overlapTail(cur, overlap)
      flush()
      if (u.kind === 'prose' && unitsLength(tail) + u.text.length <= target) cur = tail
    }
    cur.push(u)
    fresh += 1
  }
  flush()
  return groups
}

function groupToChunk(group: Unit[], page: number, base: number): ParseChunkInput | null {
  const first = group[0]
  if (!first) return null
  const raw = group.map(u => u.text).join('')
  const lead = raw.length - raw.trimStart().length
  const text = raw.trim()
  if (!text) return null
  return { page, offset: base + first.start + Math.min(lead, first.text.length), text }
}

/** 按页文本切 chunk（不跨页；句末断开；表格整块或带表头分段） */
export function buildPageChunks(
  pages: Array<{ page: number; text: string }>,
  options: ChunkOptions = {},
): ParseChunkInput[] {
  const target = Math.max(50, Math.floor(options.targetChars ?? CHUNK_TARGET_CHARS))
  const overlap = Math.floor(target * (options.overlapRatio ?? CHUNK_OVERLAP_RATIO))
  const chunks: ParseChunkInput[] = []
  let base = 0
  for (const page of pages) {
    const text = page.text.trim()
    if (!text) continue
    for (const group of packUnits(pageUnits(text, target), target, overlap)) {
      const chunk = groupToChunk(group, page.page, base)
      if (chunk) chunks.push(chunk)
    }
    base += text.length
  }
  return chunks
}

/**
 * 从已存的整理结果 Markdown（含 `<!-- page:N -->`）重新切 chunk。
 * 纯函数：不写库；已有文档不会自动重切，调用方决定何时替换 chunks 并重建索引。
 */
export function rechunkMarkdown(markdown: string, options: ChunkOptions = {}): ParseChunkInput[] {
  const re = /<!--\s*page:(\d+)\s*-->/g
  const marks = [...markdown.matchAll(re)]
  if (!marks.length) return buildPageChunks([{ page: 1, text: markdown }], options)
  const pages = marks.map((m, i) => {
    const start = (m.index ?? 0) + m[0].length
    const end = marks[i + 1]?.index ?? markdown.length
    return { page: Number(m[1]), text: markdown.slice(start, end) }
  })
  return buildPageChunks(pages, options)
}
