/**
 * 在全新评测数据根（RESEARCH_CANVAS_DATA_DIR）下用产品单例 DocLibraryService 入库 6 份 PDF：
 * 同款 ParseRouter 解析 → markParseReady（切块 + unicode61/trigram FTS）→ scheduleEmbed（当前选中模型）。
 */
import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import {
  getDocLibraryService,
  getVectorStore,
  docLibraryRoot,
  lanceDbDir,
} from '../../../packages/doc-library/dist/index.js'
import { buildParseRouter } from './pdf-runner.mjs'

export const SESSION_ID = 'eval-rag'

const sleep = ms => new Promise(r => setTimeout(r, ms))

async function waitParsed(svc, documentId, timeoutMs = 30 * 60_000) {
  const t0 = Date.now()
  for (;;) {
    const s = svc.getParseStatus(documentId)
    if (s && s.status !== 'pending') return s
    if (Date.now() - t0 > timeoutMs) throw new Error(`parse timeout ${documentId}`)
    await sleep(100)
  }
}

export async function dirBytes(dir) {
  let total = 0
  let entries
  try { entries = await readdir(dir, { withFileTypes: true }) } catch { return 0 }
  for (const e of entries) {
    const p = path.join(dir, e.name)
    total += e.isDirectory() ? await dirBytes(p) : (await stat(p)).size
  }
  return total
}

/** @param {{corpusDir:string, docs:Array<{key:string,file:string}>, wantVectors:boolean}} opts */
export async function ingestCorpus({ corpusDir, docs, wantVectors }) {
  const svc = getDocLibraryService()
  svc.setParseRunner(buildParseRouter())
  const perDoc = []
  const tAll = Date.now()
  for (const d of docs) {
    const data = await readFile(path.join(corpusDir, d.file))
    const t0 = Date.now()
    const res = svc.ingestFromAttachment({
      sessionId: SESSION_ID, attachmentId: d.key, name: d.file, mime: 'application/pdf',
      kind: 'pdf', data, source: 'attachment',
    })
    const parsed = await waitParsed(svc, res.documentId)
    const tParsed = Date.now()
    if (wantVectors) await svc.scheduleEmbed(res.documentId)
    const repo = svc.getRepository()
    const chunks = repo.getChunks(res.documentId)
    const pending = repo.getChunksNeedingEmbed(res.documentId).length
    perDoc.push({
      key: d.key, documentId: res.documentId, status: parsed.status, error: parsed.error ?? null,
      pageCount: parsed.pageCount, charCount: parsed.charCount, chunks: chunks.length,
      embedded: chunks.length - pending, parseMs: tParsed - t0, embedMs: Date.now() - tParsed,
    })
    console.error(`[ingest] ${d.key}: ${parsed.status} ${chunks.length} chunks, parse ${tParsed - t0}ms, embed ${Date.now() - tParsed}ms, embedded ${chunks.length - pending}`)
  }
  const ingestMs = Date.now() - tAll
  const db = svc.getRepository().db ?? null
  return { svc, perDoc, ingestMs, db }
}

export async function indexSizes(db) {
  try { db?.pragma('wal_checkpoint(TRUNCATE)') } catch { /* ignore */ }
  const root = docLibraryRoot()
  const files = await readdir(root).catch(() => [])
  let sqlite = 0
  for (const f of files) if (f.startsWith('doc-library.db')) sqlite += (await stat(path.join(root, f))).size
  return {
    sqliteBytes: sqlite,
    markdownBytes: await dirBytes(path.join(root, 'markdown')),
    blobBytes: await dirBytes(path.join(root, 'blobs')),
    lanceBytes: await dirBytes(path.dirname(lanceDbDir())),
  }
}

export { getVectorStore }
