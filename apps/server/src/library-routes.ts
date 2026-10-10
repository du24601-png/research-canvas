import fs from 'node:fs'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { getDocLibraryService } from '@opptrix/doc-library'

const DOCUMENT_ID_RE = /^[A-Za-z0-9_-]{1,128}$/
/** 可能在同源下执行脚本的类型一律按下载流返回 */
const ACTIVE_MIME_RE = /^(text\/html|application\/xhtml\+xml|image\/svg\+xml|(text|application)\/xml|(text|application)\/(x-)?(javascript|ecmascript))$/i
const MIME_RE = /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i

function safeMime(mime: string): string {
  const m = mime.trim()
  return MIME_RE.test(m) && !ACTIVE_MIME_RE.test(m) ? m : 'application/octet-stream'
}

/** 原文件：路径只取自资料库记录，从不拼接请求参数 */
function sendLibraryFile(reply: FastifyReply, documentId: string) {
  const doc = DOCUMENT_ID_RE.test(documentId)
    ? getDocLibraryService().getRepository().getDocument(documentId)
    : null
  if (!doc) return reply.code(404).send({ error: 'document not found' })
  let size: number
  try {
    const st = fs.statSync(doc.blob_path)
    if (!st.isFile()) return reply.code(404).send({ error: 'document not found' })
    size = st.size
  } catch {
    return reply.code(404).send({ error: 'document not found' })
  }
  reply.header('Content-Type', safeMime(doc.mime))
  reply.header('Content-Length', String(size))
  reply.header('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(doc.name)}`)
  reply.header('X-Content-Type-Options', 'nosniff')
  reply.header('Content-Security-Policy', 'sandbox')
  return reply.send(fs.createReadStream(doc.blob_path))
}

const MAX_LIMIT = 100
const DEFAULT_LIMIT = 50

function parseIntParam(raw: unknown, fallback: number, min: number, max: number): number | null {
  if (raw === undefined || raw === '') return fallback
  if (typeof raw !== 'string' || !/^\d{1,9}$/.test(raw)) return null
  const n = Number(raw)
  return n >= min && n <= max ? n : null
}

/** 只读：跨会话资料库文档列表（「我的资料」）。 */
export function registerLibraryRoutes(app: FastifyInstance): void {
  app.get<{ Querystring: { limit?: string; offset?: string } }>(
    '/api/library/documents',
    async (req, reply) => {
      const limit = parseIntParam(req.query.limit, DEFAULT_LIMIT, 1, MAX_LIMIT)
      const offset = parseIntParam(req.query.offset, 0, 0, 1_000_000)
      if (limit === null || offset === null) {
        return reply.code(400).send({ error: 'invalid pagination' })
      }
      const { total, items } = getDocLibraryService().getRepository().listLibraryDocuments(limit, offset)
      return {
        total,
        limit,
        offset,
        documents: items.map(d => ({
          id: d.id,
          name: d.name,
          kind: d.kind,
          page_count: d.page_count,
          status: d.status ?? 'pending',
          added_at: d.created_at,
        })),
      }
    },
  )

  app.get<{ Params: { id: string } }>(
    '/api/library/documents/:id/file',
    async (req, reply) => sendLibraryFile(reply, req.params.id),
  )
}
