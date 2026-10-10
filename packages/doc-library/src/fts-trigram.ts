import type Database from 'better-sqlite3'
import type { ChunkRow } from './types.js'

/**
 * trigram 全文索引（fts_chunks_tri）：写入、删除与启动回填。
 * 与 unicode61 的 fts_chunks 并存；中文 ≥3 字词走本表，旧表保留兼容。
 */

export const TRIGRAM_FTS_TABLE = 'fts_chunks_tri'

/** 每批回填的文档数（按 documents.id 游标） */
const BACKFILL_DOC_BATCH = 20
/** 单个时间片内最多占用的毫秒数（同步执行，避免长时间阻塞事件循环） */
const BACKFILL_SLICE_MS = 30
/** 时间片之间的间隔 */
const BACKFILL_TICK_MS = 25

const scheduledDbs = new WeakSet<Database.Database>()

function nowIso(): string {
  return new Date().toISOString()
}

/** fts_chunks_tri 是否存在（sqlite_master 查询，开销很小，不做缓存以免表被重建后失真） */
export function trigramTableExists(db: Database.Database): boolean {
  return Boolean(db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
  ).get(TRIGRAM_FTS_TABLE))
}

export function deleteTrigramForDocument(db: Database.Database, documentId: string): void {
  if (!trigramTableExists(db)) return
  db.prepare(`DELETE FROM ${TRIGRAM_FTS_TABLE} WHERE document_id = ?`).run(documentId)
}

/** 替换某文档的 trigram 行；调用方负责事务 */
export function replaceTrigramForDocument(
  db: Database.Database,
  documentId: string,
  chunks: ChunkRow[],
): void {
  if (!trigramTableExists(db)) return
  deleteTrigramForDocument(db, documentId)
  const insert = db.prepare(`
    INSERT INTO ${TRIGRAM_FTS_TABLE}(chunk_id, document_id, text) VALUES(?, ?, ?)
  `)
  for (const row of chunks) insert.run(row.id, row.document_id, row.text)
}

export interface TrigramBackfillState {
  cursor: string
  doneAt: string | null
  lastError: string | null
  updatedAt: string
}

export function readTrigramBackfillState(db: Database.Database): TrigramBackfillState | null {
  try {
    const row = db.prepare(`
      SELECT cursor, done_at AS doneAt, last_error AS lastError, updated_at AS updatedAt
      FROM fts_tri_backfill WHERE id = 1
    `).get() as TrigramBackfillState | undefined
    return row ?? null
  } catch {
    return null
  }
}

/** 回填完成后才信任整张 trigram 表 */
export function isTrigramBackfillDone(db: Database.Database): boolean {
  if (!trigramTableExists(db)) return false
  const state = readTrigramBackfillState(db)
  return Boolean(state?.doneAt)
}

/**
 * trigram 覆盖范围：all=true 时全部文档可用 MATCH；
 * 否则仅 documents.id <= cursor 的文档已回填（与回填 ORDER BY id 同一排序规则），其余需逐字兜底。
 * available=false 表示表或进度缺失，只能全部走兜底。
 */
export interface TrigramCoverage {
  available: boolean
  all: boolean
  cursor: string
}

export function readTrigramCoverage(db: Database.Database): TrigramCoverage {
  const state = trigramTableExists(db) ? readTrigramBackfillState(db) : null
  if (!state) return { available: false, all: false, cursor: '' }
  return { available: true, all: Boolean(state.doneAt), cursor: state.cursor }
}

function backfillDocuments(db: Database.Database, ids: string[]): void {
  const del = db.prepare(`DELETE FROM ${TRIGRAM_FTS_TABLE} WHERE document_id = ?`)
  const ins = db.prepare(`
    INSERT INTO ${TRIGRAM_FTS_TABLE}(chunk_id, document_id, text)
    SELECT id, document_id, text FROM chunks WHERE document_id = ? ORDER BY seq
  `)
  for (const id of ids) {
    del.run(id)
    ins.run(id)
  }
}

/**
 * 回填一批文档（幂等：先按文档删后插）。游标在事务内读取。返回本批处理的文档数与是否已完成。
 */
export function runTrigramBackfillBatch(
  db: Database.Database,
  docBatch = BACKFILL_DOC_BATCH,
): { documents: number; done: boolean } {
  if (!trigramTableExists(db)) return { documents: 0, done: false }
  const tx = db.transaction((): { documents: number; done: boolean } => {
    const state = readTrigramBackfillState(db)
    if (!state) return { documents: 0, done: false }
    if (state.doneAt) return { documents: 0, done: true }
    const ids = (db.prepare(
      'SELECT id FROM documents WHERE id > ? ORDER BY id LIMIT ?',
    ).all(state.cursor, docBatch) as Array<{ id: string }>).map(r => r.id)
    backfillDocuments(db, ids)
    const done = ids.length < docBatch
    const next = ids.length ? ids[ids.length - 1] : state.cursor
    db.prepare(`
      UPDATE fts_tri_backfill SET cursor = ?, done_at = ?, last_error = NULL, updated_at = ?
      WHERE id = 1
    `).run(next, done ? nowIso() : null, nowIso())
    return { documents: ids.length, done }
  })
  return tx()
}

function recordBackfillError(db: Database.Database, err: unknown): void {
  const msg = err instanceof Error ? err.message : String(err)
  try {
    db.prepare('UPDATE fts_tri_backfill SET last_error = ?, updated_at = ? WHERE id = 1')
      .run(msg.slice(0, 500), nowIso())
  } catch {
    /* 连接已关闭等：放弃记录 */
  }
}

/**
 * 在时间预算内连续回填；返回是否已完成。出错写入 last_error 并返回 false。
 */
export function backfillTrigramFts(
  db: Database.Database,
  opts: { budgetMs?: number; docBatch?: number } = {},
): boolean {
  const deadline = Date.now() + (opts.budgetMs ?? BACKFILL_SLICE_MS)
  try {
    for (;;) {
      const r = runTrigramBackfillBatch(db, opts.docBatch)
      if (r.done) return true
      if (r.documents === 0 || Date.now() >= deadline) return false
    }
  } catch (err) {
    recordBackfillError(db, err)
    throw err
  }
}

/**
 * 启动回填：首个时间片同步执行（小库直接完成），剩余按时间片后台续跑。
 * 定时器 unref，不阻止进程退出；连接关闭或出错即停（下次启动从游标续跑）。
 */
export function scheduleTrigramBackfill(db: Database.Database): void {
  if (scheduledDbs.has(db)) return
  const state = readTrigramBackfillState(db)
  if (!state || state.doneAt) return
  scheduledDbs.add(db)

  const tick = (): void => {
    if (!db.open) return
    let done = false
    try {
      done = backfillTrigramFts(db)
    } catch {
      scheduledDbs.delete(db)
      return
    }
    if (done) {
      scheduledDbs.delete(db)
      return
    }
    const t = setTimeout(tick, BACKFILL_TICK_MS)
    t.unref()
  }
  tick()
}
