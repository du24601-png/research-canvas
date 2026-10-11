/**
 * 各评测配置的检索入口，统一返回 { hits, found, reason }。
 * - fts_trigram / hybrid_*：产品入口 service.searchHybridDetailed（search_library / search_document 同款；
 *   无向量模型时即纯关键词路径，含整句 3-gram 自然问句匹配；有模型时含纯向量命中的相关度下限）。
 * - vec_*：纯向量对照组，同样套用产品的按模型相关度下限（relevance-floor），以便统计 found:false。
 * - fts_unicode61：v7 前旧路径，产品已无法强制，按迁移前 searchFtsChunks 原样复刻 SQL 查 unicode61 表 fts_chunks。
 */
import { ftsQuery } from '../../../packages/doc-library/dist/index.js'
import { relevanceFloorFor, scoreToCosine } from '../../../packages/doc-library/dist/relevance-floor.js'

export const LIMIT = 20 // 产品上限（search_library / search_document 默认 8，最多 20）

const done = (hits, reason = 'no_match') => (hits.length ? { hits, found: true } : { hits, found: false, reason })

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

/** 纯向量检索；score 统一换算为余弦（与产品下限同口径） */
async function vectorHits(ctx, query, { scope, attachmentId, limit }) {
  const vec = await ctx.svc.getEmbeddingService().embedQuery(query)
  if (!vec) return []
  const documentIds = scope === 'library' ? ctx.allDocIds : [ctx.docIdByKey.get(attachmentId)]
  const hits = await ctx.vectorStore.search(vec, { documentIds, limit })
  return hits.map(h => ({
    chunk_id: h.chunk_id, document_id: h.document_id, page: ctx.pageByChunk.get(h.chunk_id),
    score: scoreToCosine(ctx.vectorStore, h.score),
  }))
}

async function vectorOnlyWithFloor(ctx, query, o) {
  const hits = await vectorHits(ctx, query, o)
  const floor = relevanceFloorFor(ctx.modelId)
  if (floor === undefined) return done(hits)
  const kept = hits.filter(h => h.score >= floor)
  return done(kept, hits.length ? 'below_relevance_floor' : 'no_match')
}

/** @returns {(query:string, opts:{scope:'document'|'library', attachmentId?:string}) => Promise<{hits:Array,found:boolean,reason?:string}>} */
export function makeRetriever(kind, ctx) {
  const base = o => ({
    sessionId: ctx.sessionId,
    scope: o.scope === 'library' ? 'library' : 'session',
    attachmentId: o.scope === 'library' ? undefined : o.attachmentId,
    limit: LIMIT,
  })
  switch (kind) {
    case 'fts_unicode61':
      return async (q, o) => done(legacyUnicode61(ctx.db, q, base(o)))
    case 'fts':
    case 'hybrid':
      return async (q, o) => ctx.svc.searchHybridDetailed(ctx.sessionId, q, base(o))
    case 'vec':
      return async (q, o) => vectorOnlyWithFloor(ctx, q, { scope: o.scope, attachmentId: o.attachmentId, limit: LIMIT })
    default:
      throw new Error(`unknown retriever ${kind}`)
  }
}

/** 诊断用（不计时）：向量 top1 余弦，用于无答案阈值分析 */
export async function vectorTop1(ctx, query, o) {
  if (!ctx.vectorReady) return null
  const hits = await vectorHits(ctx, query, { scope: o.scope, attachmentId: o.attachmentId, limit: 1 })
  return hits[0]?.score ?? null
}

