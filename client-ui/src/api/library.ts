import { resolveFileMime } from '../chat/mediaCapabilities'
import { attachmentUploadTimeoutMs } from '../chat/attachmentUpload'
import { API_BASE, fetchWithTimeout, jsonFetch } from './client'

export type LibraryDocStatus = 'pending' | 'ready' | 'failed'
/** ready = 可按意思检索；indexing = 还在准备；off = 本机没有语义检索模型或文档未整理好 */
export type LibraryVectorStatus = 'ready' | 'indexing' | 'off'

export interface LibraryDocument {
  id: string
  name: string
  kind: string
  page_count: number | null
  status: LibraryDocStatus
  /** 旧版接口没有此字段 */
  vector_status?: LibraryVectorStatus
  added_at: string
}

export async function uploadLibraryDocument(file: File): Promise<LibraryDocument> {
  const body = file.slice(0, file.size, 'application/octet-stream')
  return jsonFetch<LibraryDocument>('/library/documents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Attachment-Mime': resolveFileMime(file),
      'X-Attachment-Name': encodeURIComponent(file.name),
    },
    body,
  }, attachmentUploadTimeoutMs(file.size))
}

export async function deleteLibraryDocument(id: string): Promise<void> {
  await jsonFetch<{ ok: boolean }>(`/library/documents/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function listLibraryDocuments(limit = 50, offset = 0) {
  return jsonFetch<{ total: number; limit: number; offset: number; documents: LibraryDocument[] }>(
    `/library/documents?limit=${limit}&offset=${offset}`,
  )
}

/** 资料库文档原文件（只读，按 document_id） */
export function libraryDocumentFileUrl(documentId: string): string {
  return `${API_BASE}/library/documents/${encodeURIComponent(documentId)}/file`
}

/** 原文件的类型（HEAD，不下载正文）；文档不存在时返回 null */
export async function fetchLibraryDocumentMime(documentId: string): Promise<string | null> {
  const resp = await fetchWithTimeout(libraryDocumentFileUrl(documentId), { method: 'HEAD' })
  if (!resp.ok) return null
  return resp.headers.get('Content-Type')?.split(';')[0]?.trim() || 'application/octet-stream'
}
