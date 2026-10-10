/**
 * 各评测配置的检索入口。全部走 doc-library dist 中产品同款函数，只有 fts_unicode61 例外：
 * v7 迁移后产品对含中文的查询会改走 trigram，旧路径无法通过开关强制，
 * 这里按迁移前（HEAD 之前）的 searchFtsChunks 原样复刻 SQL，直接查仍在写入的 unicode61 表 fts_chunks。
 */
import { ftsQuery } from '../../../packages/doc-library/dist/index.js'

export const LIMIT = 20 // 产品上限（search_library / search_document 默认 8，最多 20）

function legacyUnicode61(db, query, { sessionId, scope, attachmentId, limit }) {
  const q = ftsQuery(query)
  if (!q) return []
  const lib = scope === 'library'
  const clauses = lib ? ['fts_chunks MATCH ?', "pa.status = 'ready'"] : ['sd.session_id = ?', 'fts_chunks MATCH ?']
  const params = lib ? [q] : [sessionId, q]
  if (!lib && attachmentId) { clauses.push('sd.attachment_id = ?'); params.push(attachmentId) }
  const joins = lib
    ? 'JOIN documents d ON d.id = c.document_id JOIN parse_artifacts pa ON pa.document_id = c.document_id'
    : 'JOIN session_documents sd ON sd.document_id = c.document_id'
  try {
    return db.prepare(`
      SELECT c.id AS chunk_id, c.document_id, c.page, rank
      FROM fts_chunks JOIN chunks c ON c.id = fts_chunks.chunk_id ${joins}
      WHERE ${clauses.join(' AND ')} ORDER BY rank LIMIT ?
    `).all(...params, limit)
  } catch {
    return []
  }
}

async function vectorOnly(ctx, query, opts) {
  const emb = ctx.svc.getEmbeddingService()
  const vec = await emb.embedQuery(query)
  if (!vec) return []
  const documentIds = opts.scope === 'library' ? ctx.allDocIds : [ctx.docIdByKey.get(opts.attachmentId)]
  const hits = await ctx.vectorStore.search(vec, { documentIds, limit: opts.limit })
  const pageOf = ctx.pageByChunk
  return hits.map(h => ({ chunk_id: h.chunk_id, document_id: h.document_id, page: pageOf.get(h.chunk_id), rank: -h.score, score: h.score }))
}

/** @returns {(query:string, opts:{scope:'document'|'library', attachmentId?:string}) => Promise<Array>} */
export function makeRetriever(kind, ctx) {
  const base = o => ({
    sessionId: ctx.sessionId,
    scope: o.scope === 'library' ? 'library' : 'session',
    attachmentId: o.scope === 'library' ? undefined : o.attachmentId,
    limit: LIMIT,
  })
  switch (kind) {
    case 'fts_unicode61':
      return async (q, o) => legacyUnicode61(ctx.db, q, base(o))
    case 'fts':
      return async (q, o) => ctx.svc.searchFts(ctx.sessionId, q, base(o))
    case 'vec':
      return async (q, o) => vectorOnly(ctx, q, { ...base(o), scope: o.scope, attachmentId: o.attachmentId })
    case 'hybrid':
      return async (q, o) => ctx.svc.searchHybrid(ctx.sessionId, q, base(o))
    default:
      throw new Error(`unknown retriever ${kind}`)
  }
}

/** 诊断用（不计时）：向量 top1 余弦分，用于无答案阈值分析 */
export async function vectorTop1(ctx, query, o) {
  if (!ctx.vectorReady) return null
  const hits = await vectorOnly(ctx, query, { scope: o.scope, attachmentId: o.attachmentId, limit: 1 })
  return hits[0]?.score ?? null
}
