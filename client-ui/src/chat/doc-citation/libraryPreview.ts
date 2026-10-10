/**
 * 资料库文档（未链到本会话）在现有预览面板里打开：
 * 合成一个只用于预览的附件描述，FilePreviewPanel 据前缀改走资料库原文件地址。
 */
import { libraryDocumentFileUrl } from '../../api/library'
import type { ChatAttachmentMeta, MediaKind } from '../../types/chat'

const LIBRARY_ATTACHMENT_PREFIX = 'library-doc:'

export function libraryPreviewKind(mime: string): MediaKind | null {
  if (mime === 'application/pdf') return 'pdf'
  if (/^image\/(png|jpe?g|gif|webp|bmp)$/.test(mime)) return 'image'
  return null
}

export function makeLibraryAttachmentMeta(
  documentId: string,
  name: string,
  mime: string,
  kind: MediaKind,
): ChatAttachmentMeta {
  return {
    id: `${LIBRARY_ATTACHMENT_PREFIX}${documentId}`,
    kind,
    mime,
    name,
    size: 0,
    createdAt: new Date(0).toISOString(),
  }
}

/** 合成附件 → 资料库原文件地址；普通会话附件返回 null */
export function libraryFileUrlForAttachment(attachment: ChatAttachmentMeta | null | undefined): string | null {
  if (!attachment?.id.startsWith(LIBRARY_ATTACHMENT_PREFIX)) return null
  return libraryDocumentFileUrl(attachment.id.slice(LIBRARY_ATTACHMENT_PREFIX.length))
}
