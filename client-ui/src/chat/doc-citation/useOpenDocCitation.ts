import { useCallback, useContext } from 'react'
import { fetchSessionAttachmentMeta, listSessionAttachments } from '../../api/client'
import { fetchLibraryDocumentMime, libraryDocumentFileUrl } from '../../api/library'
import type { ChatAttachmentMeta } from '../../types/chat'
import { WorkspaceUiContext } from '../workspace/WorkspaceUiContext'
import type { DocCitationTarget } from './docCitationLink'
import { requestDocPage } from './docPageRequest'
import { libraryPreviewKind, makeLibraryAttachmentMeta } from './libraryPreview'

/** 引用指向的本会话附件；资料库文档按 extract.documentId 匹配 */
export async function resolveCitationAttachment(
  sessionId: string,
  target: DocCitationTarget,
): Promise<ChatAttachmentMeta | null> {
  try {
    if (target.kind === 'attachment') {
      return await fetchSessionAttachmentMeta(sessionId, target.id)
    }
    const list = await listSessionAttachments(sessionId)
    return list.find(a => a.extract?.documentId === target.id) ?? null
  } catch {
    return null
  }
}

/** 不在本会话的资料库文档：PDF / 图片走预览面板，其余类型在新标签页打开原文件 */
async function resolveLibraryPreview(
  target: DocCitationTarget,
  name: string,
): Promise<ChatAttachmentMeta | 'opened' | null> {
  if (target.kind !== 'document') return null
  const mime = await fetchLibraryDocumentMime(target.id).catch(() => null)
  if (!mime) return null
  const kind = libraryPreviewKind(mime)
  if (kind) return makeLibraryAttachmentMeta(target.id, name, mime, kind)
  window.open(libraryDocumentFileUrl(target.id), '_blank', 'noopener')
  return 'opened'
}

/**
 * 打开引用：先登记跳页请求，再打开预览面板（对话优先与旧双栏布局共用同一预览）。
 * 不在工作区内或没有会话时返回 null（chip 只展示）。
 */
export function useOpenDocCitation(
  sessionId: string | null | undefined,
): ((target: DocCitationTarget, name?: string) => Promise<boolean>) | null {
  const ui = useContext(WorkspaceUiContext)
  const openFilePreview = ui?.openFilePreview
  const open = useCallback(async (target: DocCitationTarget, name = '资料'): Promise<boolean> => {
    if (!sessionId || !openFilePreview) return false
    const attachment = await resolveCitationAttachment(sessionId, target)
      ?? await resolveLibraryPreview(target, name)
    if (!attachment) return false
    if (attachment === 'opened') return true
    requestDocPage(sessionId, attachment.id, target.page)
    openFilePreview(sessionId, attachment)
    return true
  }, [sessionId, openFilePreview])
  return sessionId && openFilePreview ? open : null
}
