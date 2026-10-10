import { API_BASE, fetchWithTimeout, jsonFetch } from './client'

export type LibraryDocStatus = 'pending' | 'ready' | 'failed'

export interface LibraryDocument {
  id: string
  name: string
  kind: string
  page_count: number | null
  status: LibraryDocStatus
  added_at: string
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
