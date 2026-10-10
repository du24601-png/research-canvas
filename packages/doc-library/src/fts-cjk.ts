import type Database from 'better-sqlite3'
import type { FtsSearchChunksOpts, FtsSearchRow } from './fts.js'
import { TRIGRAM_FTS_TABLE, readTrigramCoverage } from './fts-trigram.js'

/**
 * 含中日韩字符的关键词检索：
 * - ≥3 字的词走 trigram 表（bm25 排序，子串匹配，可命中句中「…年毛利率下降…」）；
 * - 1–2 字词（营收、毛利）作为 MATCH 结果上的逐字过滤；
 * - 全部是 1–2 字词时退化为 instr 逐字匹配：只扫描范围内最新的 INSTR_SCAN_BUDGET 个 chunk
 *   （按 chunks.rowid 倒序），在 SQL 中按出现次数打分排序后再 LIMIT；
 * - 回填进行中：游标以内的文档走 MATCH，其余文档走上面的限额逐字匹配，两路合并；
 * - 多个词之间保持 AND 语义（与 unicode61 路径一致）。
 */

const CJK_RE = /[぀-ヿ㐀-䶿一-鿿가-힯豈-﫿]/
/** 逐字匹配最多扫描的 chunk 数（范围内按 rowid 倒序，即最近写入优先） */
export const INSTR_SCAN_BUDGET = 5000
const EXCERPT_RADIUS = 60

export function hasCjk(text: string): boolean {
  return CJK_RE.test(text)
}

export function splitQueryTerms(raw: string): string[] {
  return raw
    .trim()
    .split(/[\s,，、;；]+/)
    .map(t => t.replace(/["'*]/g, '').trim())
    .filter(t => t.length >= 1)
}

function charLength(text: string): number {
  return Array.from(text).length
}

/** trigram MATCH 表达式：每个词作为短语加引号，内部引号双写 */
export function trigramMatchExpr(terms: string[]): string {
  return terms.map(t => `"${t.replace(/"/g, '""')}"`).join(' ')
}

export interface CjkQueryPlan {
  matchTerms: string[]
  instrTerms: string[]
}

export function planCjkQuery(terms: string[], trigramReady: boolean): CjkQueryPlan {
  const matchTerms: string[] = []
  const instrTerms: string[] = []
  for (const t of terms) {
    if (trigramReady && charLength(t) >= 3) matchTerms.push(t)
    else instrTerms.push(t)
  }
  return { matchTerms, instrTerms }
}

interface ScopeSql {
  joins: string
  clauses: string[]
  params: Array<string | number>
  attachmentExpr: string
}

function scopeSql(opts: FtsSearchChunksOpts): ScopeSql {
  if ((opts.scope ?? 'session') === 'library') {
    const s: ScopeSql = {
      joins: 'JOIN documents d ON d.id = c.document_id JOIN parse_artifacts pa ON pa.document_id = c.document_id',
      clauses: ["pa.status = 'ready'"],
      params: [],
      attachmentExpr: 'NULL',
    }
    if (opts.documentId) { s.clauses.push('c.document_id = ?'); s.params.push(opts.documentId) }
    if (opts.sourceType) {
      s.clauses.push("COALESCE(d.source_type, 'report') = ?")
      s.params.push(opts.sourceType)
    }
    return s
  }
  const s: ScopeSql = {
    joins: 'JOIN session_documents sd ON sd.document_id = c.document_id',
    clauses: ['sd.session_id = ?'],
    params: [opts.sessionId],
    attachmentExpr: 'sd.attachment_id',
  }
  if (opts.documentId) { s.clauses.push('c.document_id = ?'); s.params.push(opts.documentId) }
  if (opts.attachmentId) { s.clauses.push('sd.attachment_id = ?'); s.params.push(opts.attachmentId) }
  return s
}

function instrClauses(col: string, n: number): string[] {
  return Array.from({ length: n }, () => `instr(lower(${col}), lower(?)) > 0`)
}

/** 额外 SQL 条件（如回填游标范围） */
interface ExtraClause {
  clause: string
  params: Array<string | number>
}

function searchTrigram(
  db: Database.Database,
  plan: CjkQueryPlan,
  limit: number,
  opts: FtsSearchChunksOpts,
  extra: ExtraClause | null,
): FtsSearchRow[] {
  const s = scopeSql(opts)
  // MATCH 驱动查询；短词 instr 只作用于 MATCH 命中的行
  const clauses = [
    `${TRIGRAM_FTS_TABLE} MATCH ?`,
    ...s.clauses,
    ...(extra ? [extra.clause] : []),
    ...instrClauses('c.text', plan.instrTerms.length),
  ]
  const params = [
    trigramMatchExpr(plan.matchTerms), ...s.params, ...(extra?.params ?? []), ...plan.instrTerms, limit,
  ]
  return db.prepare(`
    SELECT
      c.id AS chunk_id,
      c.document_id,
      ${s.attachmentExpr} AS attachment_id,
      c.page,
      snippet(${TRIGRAM_FTS_TABLE}, 2, '', '', '…', 48) AS excerpt,
      ${TRIGRAM_FTS_TABLE}.rank AS rank
    FROM ${TRIGRAM_FTS_TABLE}
    JOIN chunks c ON c.id = ${TRIGRAM_FTS_TABLE}.chunk_id
    ${s.joins}
    WHERE ${clauses.join(' AND ')}
    ORDER BY rank
    LIMIT ?
  `).all(...params) as FtsSearchRow[]
}

/** 以首个命中词为中心截取摘录 */
export function excerptAround(text: string, terms: string[]): string {
  const lower = text.toLowerCase()
  const positions = terms.map(t => lower.indexOf(t.toLowerCase())).filter(i => i >= 0)
  const at = positions.length ? Math.min(...positions) : 0
  const start = Math.max(0, at - EXCERPT_RADIUS)
  const end = Math.min(text.length, at + EXCERPT_RADIUS * 2)
  const body = text.slice(start, end).replace(/\s+/g, ' ').trim()
  return `${start > 0 ? '…' : ''}${body}${end < text.length ? '…' : ''}`
}

/** 各词出现次数之和（SQL 内计算，便于先排序再 LIMIT） */
function occurrenceScoreSql(n: number): string {
  const one = "((length(lower(t.text)) - length(replace(lower(t.text), lower(?), ''))) / max(length(?), 1))"
  return Array.from({ length: n }, () => one).join(' + ')
}

interface InstrRow {
  chunk_id: string
  document_id: string
  attachment_id: string | null
  page: number
  text: string
  hits: number
}

/** 限额逐字匹配：内层只取范围内最新 budget 个 chunk，外层过滤、打分、排序、LIMIT */
function searchInstrBudgeted(
  db: Database.Database,
  terms: string[],
  limit: number,
  opts: FtsSearchChunksOpts,
  budget: number,
  extra: ExtraClause | null,
): FtsSearchRow[] {
  const s = scopeSql(opts)
  const inner = [...s.clauses, ...(extra ? [extra.clause] : [])]
  const rows = db.prepare(`
    SELECT t.chunk_id, t.document_id, t.attachment_id, t.page, t.text,
      (${occurrenceScoreSql(terms.length)}) AS hits
    FROM (
      SELECT c.id AS chunk_id, c.document_id, ${s.attachmentExpr} AS attachment_id, c.page, c.text
      FROM chunks c
      ${s.joins}
      WHERE ${inner.join(' AND ')}
      ORDER BY c.rowid DESC
      LIMIT ?
    ) t
    WHERE ${instrClauses('t.text', terms.length).join(' AND ')}
    ORDER BY hits DESC, t.chunk_id
    LIMIT ?
  `).all(
    ...terms.flatMap(t => [t, t]), ...s.params, ...(extra?.params ?? []), budget, ...terms, limit,
  ) as InstrRow[]
  return rows.map(r => ({
    chunk_id: r.chunk_id,
    document_id: r.document_id,
    attachment_id: r.attachment_id,
    page: r.page,
    excerpt: excerptAround(r.text, terms),
    // 与 bm25 同向：越小越相关
    rank: -r.hits,
  }))
}

/** 合并两路结果：先 trigram（bm25）后逐字匹配，按 chunk 去重 */
function mergeHits(primary: FtsSearchRow[], secondary: FtsSearchRow[], limit: number): FtsSearchRow[] {
  const seen = new Set<string>()
  const out: FtsSearchRow[] = []
  for (const h of [...primary, ...secondary]) {
    if (seen.has(h.chunk_id)) continue
    seen.add(h.chunk_id)
    out.push(h)
  }
  return out.slice(0, limit)
}

/** 含 CJK 的查询入口；出错返回空数组（与 unicode61 路径一致） */
export function searchCjkChunks(
  db: Database.Database,
  terms: string[],
  limit: number,
  opts: FtsSearchChunksOpts,
  budget = INSTR_SCAN_BUDGET,
): FtsSearchRow[] {
  try {
    const cov = readTrigramCoverage(db)
    const plan = planCjkQuery(terms, cov.available)
    if (!plan.matchTerms.length) return searchInstrBudgeted(db, terms, limit, opts, budget, null)
    if (cov.all) return searchTrigram(db, plan, limit, opts, null)
    const covered = searchTrigram(db, plan, limit, opts, { clause: 'c.document_id <= ?', params: [cov.cursor] })
    const rest = searchInstrBudgeted(db, terms, limit, opts, budget, {
      clause: 'c.document_id > ?',
      params: [cov.cursor],
    })
    return mergeHits(covered, rest, limit)
  } catch {
    return []
  }
}
