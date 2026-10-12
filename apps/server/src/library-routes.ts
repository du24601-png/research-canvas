import { randomBytes } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { documentKindFromMime, getDocLibraryService, type DocumentKind } from '@opptrix/doc-library'

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

/** 与会话附件上传同一上限，避免资料库被实例默认 body 限制截断 */
const LIBRARY_UPLOAD_BODY_LIMIT = 4 * 1024 * 1024 * 1024
/** 不是真实对话；只用来满足入库签名，检索不依赖这条链接 */
const SHELF_SESSION_ID = 'library-shelf'
const SHELF_KINDS = new Set<DocumentKind>(['pdf', 'text', 'docx', 'doc', 'pptx', 'ppt'])

const MAX_LIMIT = 100
const DEFAULT_LIMIT = 50

function shelfFilename(raw: unknown): string {
  const text = typeof raw === 'string' ? raw : '未命名文件'
  let decoded = text
  try {
    decoded = decodeURIComponent(text)
  } catch {
    decoded = text
  }
  const base = path.basename(decoded.trim() || '未命名文件')
  return base.replace(/[^\w.\-()\u4e00-\u9fff]/g, '_').slice(0, 180) || '未命名文件'
}

function shelfMime(raw: unknown): string {
  if (typeof raw !== 'string') return 'application/octet-stream'
  const mime = raw.split(';')[0]?.trim().toLowerCase() ?? ''
  return MIME_RE.test(mime) ? mime : 'application/octet-stream'
}

function readUploadBuffer(body: unknown): Buffer | null {
  if (Buffer.isBuffer(body)) return body.length > 0 ? body : null
  if (typeof body === 'string' && body.length > 0) return Buffer.from(body)
  return null
}

function ingestShelf(name: string, mime: string, kind: DocumentKind, data: Buffer) {
  const ingested = getDocLibraryService().ingestFromAttachment({
    sessionId: SHELF_SESSION_ID,
    attachmentId: `shelf-${randomBytes(8).toString('hex')}`,
    name,
    mime,
    kind,
    data,
    source: 'import',
  })
  const doc = getDocLibraryService().getRepository().getDocument(ingested.documentId)
  return {
    id: ingested.documentId,
    name: doc?.name ?? name,
    kind: doc?.kind ?? kind,
    page_count: typeof ingested.pageCount === 'number' ? ingested.pageCount : null,
    status: ingested.parseStatus,
    added_at: doc?.created_at ?? new Date().toISOString(),
  }
}

function parseIntParam(raw: unknown, fallback: number, min: number, max: number): number | null {
  if (raw === undefined || raw === '') return fallback
  if (typeof raw !== 'string' || !/^\d{1,9}$/.test(raw)) return null
  const n = Number(raw)
  return n >= min && n <= max ? n : null
}

function registerShelfUpload(app: FastifyInstance): void {
  app.post(
    '/api/library/documents',
    { bodyLimit: LIBRARY_UPLOAD_BODY_LIMIT },
    async (req, reply) => {
      const name = shelfFilename(req.headers['x-attachment-name'])
      const mime = shelfMime(req.headers['x-attachment-mime'])
      const kind = documentKindFromMime(mime, name)
      if (!SHELF_KINDS.has(kind)) {
        return reply.code(400).send({ error: '请上传 PDF、Word、PPT 或文本' })
      }
      const data = readUploadBuffer(req.body)
      if (!data) return reply.code(400).send({ error: '请上传有效文件' })
      try {
        return ingestShelf(name, mime, kind, data)
      } catch {
        return reply.code(500).send({ error: '暂时无法加入资料，请稍后重试' })
      }
    },
  )
}

function registerShelfDelete(app: FastifyInstance): void {
  app.delete<{ Params: { id: string } }>(
    '/api/library/documents/:id',
    async (req, reply) => {
      if (!DOCUMENT_ID_RE.test(req.params.id)) {
        return reply.code(400).send({ error: 'invalid id' })
      }
      const doc = getDocLibraryService().getRepository().getDocument(req.params.id)
      if (!doc || doc.source_type !== 'report') {
        return reply.code(404).send({ error: 'document not found' })
      }
      if (!getDocLibraryService().deleteDocument(req.params.id)) {
        return reply.code(404).send({ error: 'document not found' })
      }
      return { ok: true }
    },
  )
}

/** 资料库：列表、拖入、移除。资讯不在此列，也不能从这里删除。 */
export function registerLibraryRoutes(app: FastifyInstance): void {
  app.get<{ Querystring: { limit?: string; offset?: string } }>(
    '/api/library/documents',
    async (req, reply) => {
      const limit = parseIntParam(req.query.limit, DEFAULT_LIMIT, 1, MAX_LIMIT)
      const offset = parseIntParam(req.query.offset, 0, 0, 1_000_000)
      if (limit === null || offset === null) {
        return reply.code(400).send({ error: 'invalid pagination' })
      }
      const svc = getDocLibraryService()
      const { total, items } = svc.getRepository().listLibraryDocuments(limit, offset)
      const vectors = svc.libraryVectorStatus(items)
      if ([...vectors.values()].includes('indexing')) svc.requestVectorBackfill()
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
          vector_status: vectors.get(d.id) ?? 'off',
          added_at: d.created_at,
        })),
      }
    },
  )

  app.get<{ Params: { id: string } }>(
    '/api/library/documents/:id/file',
    async (req, reply) => sendLibraryFile(reply, req.params.id),
  )

  registerShelfUpload(app)
  registerShelfDelete(app)
}
