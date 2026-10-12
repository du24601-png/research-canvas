import type Database from 'better-sqlite3'
import type { ParseStatus } from './types.js'

/** ready = 当前模型的向量已全部建好；indexing = 仍在补算；off = 无本地模型或文档未整理好 */
export type LibraryVectorStatus = 'ready' | 'indexing' | 'off'

interface DocParseState {
  id: string
  status: ParseStatus | null
}

function embeddedCounts(
  db: Database.Database,
  documentIds: string[],
  modelId: string,
): Map<string, { chunks: number; embedded: number }> {
  const out = new Map<string, { chunks: number; embedded: number }>()
  if (!documentIds.length) return out
  const placeholders = documentIds.map(() => '?').join(', ')
  const rows = db.prepare(`
    SELECT c.document_id AS id, COUNT(*) AS chunks, COUNT(ce.chunk_id) AS embedded
    FROM chunks c
    LEFT JOIN chunk_embeddings ce ON ce.chunk_id = c.id AND ce.model_id = ?
    WHERE c.document_id IN (${placeholders})
    GROUP BY c.document_id
  `).all(modelId, ...documentIds) as Array<{ id: string; chunks: number; embedded: number }>
  for (const row of rows) out.set(row.id, { chunks: row.chunks, embedded: row.embedded })
  return out
}

export function computeLibraryVectorStatus(
  db: Database.Database,
  docs: DocParseState[],
  opts: { modelId: string; modelInstalled: boolean },
): Map<string, LibraryVectorStatus> {
  const result = new Map<string, LibraryVectorStatus>()
  const readyIds = docs.filter(d => d.status === 'ready').map(d => d.id)
  const counts = opts.modelInstalled ? embeddedCounts(db, readyIds, opts.modelId) : new Map()
  for (const doc of docs) {
    const c = counts.get(doc.id)
    if (!c || c.chunks === 0) result.set(doc.id, 'off')
    else result.set(doc.id, c.embedded >= c.chunks ? 'ready' : 'indexing')
  }
  return result
}
