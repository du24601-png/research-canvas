import type Database from 'better-sqlite3'
import { searchFtsChunks } from './fts.js'
import { rrfFuse } from './rrf.js'
import { resolveEmbeddingModelSpec } from './embedding-models.js'
import { relevanceFloorFor, scoreToCosine } from './relevance-floor.js'
import type { EmbeddingService } from './embedding.js'
import type { VectorStore, VectorSearchHit } from './vector-store.js'
import type { DocSearchScope, DocumentSourceType, FtsSearchHit } from './types.js'

/** LanceDB 建表时的占位行 id（零向量；正常会被删除，防御性过滤） */
const VECTOR_PLACEHOLDER_ID = '__init__'

/** library 文档 id 分页大小 — 向量预筛按页聚合，避免一次加载全库 id */
export const LIBRARY_DOCUMENT_ID_PAGE_SIZE = 256

export interface HybridSearchChunksOpts {
  sessionId: string
  scope?: DocSearchScope
  sourceType?: DocumentSourceType
  documentId?: string
  attachmentId?: string
  limit?: number
  embedding: EmbeddingService
  vectorStore: VectorStore
  /** 覆盖相关度下限所用的模型 id（缺省取当前选中的嵌入模型）；测试用 */
  modelId?: string
  /** 覆盖向量相似度下限（余弦）；测试用 */
  vectorFloor?: number
}

/** 未命中原因：no_match = 关键词/向量都没有结果；below_relevance_floor = 仅有的向量结果相关度太低被丢弃 */
export type HybridNotFoundReason = 'no_match' | 'below_relevance_floor'

export interface HybridSearchResult {
  hits: FtsSearchHit[]
  found: boolean
  reason?: HybridNotFoundReason
}

function finish(hits: FtsSearchHit[], reason: HybridNotFoundReason = 'no_match'): HybridSearchResult {
  return hits.length ? { hits, found: true } : { hits, found: false, reason }
}

export async function searchHybridChunks(
  db: Database.Database,
  query: string,
  opts: HybridSearchChunksOpts,
): Promise<FtsSearchHit[]> {
  return (await searchHybridDetailed(db, query, opts)).hits
}

/** 与 searchHybridChunks 同逻辑，额外返回 found / reason（仅新增字段） */
export async function searchHybridDetailed(
  db: Database.Database,
  query: string,
  opts: HybridSearchChunksOpts,
): Promise<HybridSearchResult> {
  const limit = Math.min(Math.max(opts.limit ?? 8, 1), 20)
  const scope = opts.scope ?? 'session'
  const ftsHits = searchFtsChunks(db, query, {
    sessionId: opts.sessionId,
    scope,
    sourceType: opts.sourceType,
    documentId: opts.documentId,
    attachmentId: opts.attachmentId,
    limit,
  })

  // 资讯不进 Lance：source_type=news 时仅关键词 FTS
  if (opts.sourceType === 'news') return finish(ftsHits)

  const embeddingReady = opts.embedding.isReady()
    || await opts.embedding.tryEnableDefaultBackend()
  if (!embeddingReady) return finish(ftsHits)

  const vectorOk = await opts.vectorStore.isAvailable()
  if (!vectorOk) return finish(ftsHits)

  const queryVec = await opts.embedding.embedQuery(query)
  if (!queryVec) return finish(ftsHits)

  let documentIds: string[] | undefined
  if (opts.documentId) {
    documentIds = [opts.documentId]
  } else if (scope === 'session') {
    documentIds = listSessionDocumentIds(db, opts.sessionId, opts.attachmentId)
    if (!documentIds.length) return finish(ftsHits)
  }

  const rawVectorHits = (scope === 'library' && !opts.documentId
    ? await searchLibraryVectorsPaged(db, queryVec, opts.vectorStore, limit, opts.sourceType)
    : await opts.vectorStore.search(queryVec, {
      documentIds,
      limit,
    })).filter(h => h.chunk_id !== VECTOR_PLACEHOLDER_ID && h.document_id !== VECTOR_PLACEHOLDER_ID)

  if (!rawVectorHits.length) return finish(ftsHits)

  const vectorHits = dropLowRelevanceVectorOnly(rawVectorHits, ftsHits, opts)
  if (!vectorHits.length) return finish(ftsHits, 'below_relevance_floor')

  const fusedIds = rrfFuse(
    [
      ftsHits.map(h => ({ chunk_id: h.chunk_id })),
      vectorHits.map(h => ({ chunk_id: h.chunk_id })),
    ],
    { limit },
  )

  const byId = new Map<string, FtsSearchHit>()
  for (const h of ftsHits) byId.set(h.chunk_id, h)

  // 向量命中但 FTS 未覆盖时，从 SQLite 补全元数据
  const missing = fusedIds.filter(id => !byId.has(id))
  if (missing.length) {
    const hydrated = scope === 'library'
      ? hydrateLibraryChunks(db, missing, opts.sourceType)
      : hydrateSessionChunks(db, opts.sessionId, missing)
    for (const row of hydrated) {
      byId.set(row.chunk_id, row)
    }
  }

  const out: FtsSearchHit[] = []
  fusedIds.forEach((id, idx) => {
    const hit = byId.get(id)
    if (!hit) return
    out.push({ ...hit, rank: -(idx + 1) })
  })
  return finish(out.length ? out : ftsHits)
}

/** 丢弃相似度低于模型下限、且关键词也没命中的纯向量结果 */
function dropLowRelevanceVectorOnly(
  vectorHits: VectorSearchHit[],
  ftsHits: FtsSearchHit[],
  opts: HybridSearchChunksOpts,
): VectorSearchHit[] {
  const floor = opts.vectorFloor ?? relevanceFloorFor(opts.modelId ?? resolveEmbeddingModelSpec().id)
  if (floor === undefined) return vectorHits
  // 仅精确关键词命中免检；整句 gram 近似命中（match='natural'）不豁免
  const ftsIds = new Set(ftsHits.filter(h => h.match !== 'natural').map(h => h.chunk_id))
  return vectorHits.filter(
    h => ftsIds.has(h.chunk_id) || scoreToCosine(opts.vectorStore, h.score) >= floor,
  )
}

function listSessionDocumentIds(
  db: Database.Database,
  sessionId: string,
  attachmentId?: string,
): string[] {
  if (attachmentId) {
    const rows = db.prepare(`
      SELECT document_id FROM session_documents
      WHERE session_id = ? AND attachment_id = ?
    `).all(sessionId, attachmentId) as Array<{ document_id: string }>
    return rows.map(r => r.document_id)
  }
  const rows = db.prepare(`
    SELECT document_id FROM session_documents WHERE session_id = ?
  `).all(sessionId) as Array<{ document_id: string }>
  return rows.map(r => r.document_id)
}

/** library 范围：ready 文档；可选按 source_type 预筛；向量路径排除 news */
export function listLibraryDocumentIds(
  db: Database.Database,
  sourceType?: DocumentSourceType,
): string[] {
  const out: string[] = []
  for (const page of iterateLibraryDocumentIdPages(db, sourceType)) {
    out.push(...page)
  }
  return out
}

/**
 * 分页列举 library ready 文档 id（排除 news，除非显式 sourceType）。
 * 供向量预筛按页聚合，避免无界数组。
 */
export function* iterateLibraryDocumentIdPages(
  db: Database.Database,
  sourceType?: DocumentSourceType,
  pageSize = LIBRARY_DOCUMENT_ID_PAGE_SIZE,
): Generator<string[]> {
  if (sourceType === 'news') return

  const limit = Math.min(Math.max(pageSize, 1), 2000)
  let afterId: string | undefined

  for (;;) {
    const page = listLibraryDocumentIdPage(db, { sourceType, limit, afterId })
    if (!page.length) return
    yield page
    afterId = page[page.length - 1]
    if (page.length < limit) return
  }
}

function listLibraryDocumentIdPage(
  db: Database.Database,
  opts: {
    sourceType?: DocumentSourceType
    limit: number
    afterId?: string
  },
): string[] {
  const { sourceType, limit, afterId } = opts
  if (sourceType === 'news') return []

  if (sourceType) {
    const rows = afterId
      ? db.prepare(`
          SELECT d.id AS document_id
          FROM documents d
          JOIN parse_artifacts pa ON pa.document_id = d.id
          WHERE pa.status = 'ready'
            AND COALESCE(d.source_type, 'report') = ?
            AND d.id > ?
          ORDER BY d.id ASC
          LIMIT ?
        `).all(sourceType, afterId, limit) as Array<{ document_id: string }>
      : db.prepare(`
          SELECT d.id AS document_id
          FROM documents d
          JOIN parse_artifacts pa ON pa.document_id = d.id
          WHERE pa.status = 'ready'
            AND COALESCE(d.source_type, 'report') = ?
          ORDER BY d.id ASC
          LIMIT ?
        `).all(sourceType, limit) as Array<{ document_id: string }>
    return rows.map(r => r.document_id)
  }

  const rows = afterId
    ? db.prepare(`
        SELECT d.id AS document_id
        FROM documents d
        JOIN parse_artifacts pa ON pa.document_id = d.id
        WHERE pa.status = 'ready'
          AND COALESCE(d.source_type, 'report') != 'news'
          AND d.id > ?
        ORDER BY d.id ASC
        LIMIT ?
      `).all(afterId, limit) as Array<{ document_id: string }>
    : db.prepare(`
        SELECT d.id AS document_id
        FROM documents d
        JOIN parse_artifacts pa ON pa.document_id = d.id
        WHERE pa.status = 'ready'
          AND COALESCE(d.source_type, 'report') != 'news'
        ORDER BY d.id ASC
        LIMIT ?
      `).all(limit) as Array<{ document_id: string }>
  return rows.map(r => r.document_id)
}

/**
 * 按页取 library documentIds，分别向量检索后合并全局 top-K。
 * 每页 top-K ∪ 再取 top-K ≡ 全量候选上的 top-K（精确相似度成立）。
 */
async function searchLibraryVectorsPaged(
  db: Database.Database,
  queryVec: number[],
  vectorStore: VectorStore,
  limit: number,
  sourceType?: DocumentSourceType,
): Promise<VectorSearchHit[]> {
  const merged = new Map<string, VectorSearchHit>()
  let anyPage = false

  for (const page of iterateLibraryDocumentIdPages(db, sourceType)) {
    anyPage = true
    const hits = await vectorStore.search(queryVec, { documentIds: page, limit })
    for (const h of hits) {
      const prev = merged.get(h.chunk_id)
      if (!prev || h.score > prev.score) merged.set(h.chunk_id, h)
    }
  }

  if (!anyPage) return []

  return [...merged.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

function hydrateSessionChunks(
  db: Database.Database,
  sessionId: string,
  chunkIds: string[],
): FtsSearchHit[] {
  if (!chunkIds.length) return []
  const placeholders = chunkIds.map(() => '?').join(', ')
  const rows = db.prepare(`
    SELECT
      c.id AS chunk_id,
      c.document_id,
      sd.attachment_id,
      c.page,
      substr(c.text, 1, 160) AS excerpt
    FROM chunks c
    JOIN session_documents sd ON sd.document_id = c.document_id
    WHERE sd.session_id = ?
      AND c.id IN (${placeholders})
  `).all(sessionId, ...chunkIds) as Array<{
    chunk_id: string
    document_id: string
    attachment_id: string | null
    page: number
    excerpt: string
  }>

  return rows.map(r => ({
    chunk_id: r.chunk_id,
    document_id: r.document_id,
    attachment_id: r.attachment_id,
    page: r.page,
    excerpt: r.excerpt,
    rank: 0,
  }))
}

function hydrateLibraryChunks(
  db: Database.Database,
  chunkIds: string[],
  sourceType?: DocumentSourceType,
): FtsSearchHit[] {
  if (!chunkIds.length) return []
  const placeholders = chunkIds.map(() => '?').join(', ')
  const clauses = [
    `c.id IN (${placeholders})`,
    "pa.status = 'ready'",
  ]
  const params: Array<string | number> = [...chunkIds]
  if (sourceType) {
    clauses.push("COALESCE(d.source_type, 'report') = ?")
    params.push(sourceType)
  }

  const rows = db.prepare(`
    SELECT
      c.id AS chunk_id,
      c.document_id,
      NULL AS attachment_id,
      c.page,
      substr(c.text, 1, 160) AS excerpt
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    JOIN parse_artifacts pa ON pa.document_id = c.document_id
    WHERE ${clauses.join(' AND ')}
  `).all(...params) as Array<{
    chunk_id: string
    document_id: string
    attachment_id: string | null
    page: number
    excerpt: string
  }>

  return rows.map(r => ({
    chunk_id: r.chunk_id,
    document_id: r.document_id,
    attachment_id: r.attachment_id,
    page: r.page,
    excerpt: r.excerpt,
    rank: 0,
  }))
}
