import type { ChatAttachmentMeta, ChatDisplayMessage } from '../../types/chat'

/** 会话产物：网页 / 画布 / 脑图（与消息产物条、右侧预览一致） */
export function isSessionArtifactAttachment(item: ChatAttachmentMeta): boolean {
  return item.kind === 'web' || item.kind === 'canvas' || item.kind === 'mindmap'
}

/** 按消息时间顺序取第一个可预览产物 */
export function findFirstSessionArtifact(
  messages: ChatDisplayMessage[],
): ChatAttachmentMeta | null {
  for (const msg of messages) {
    const atts = msg.attachments
    if (!atts?.length) continue
    for (const att of atts) {
      if (!isSessionArtifactAttachment(att)) continue
      if (att.optimistic || att.id.startsWith('local-')) continue
      return att
    }
  }
  return null
}

/** 等一帧绘制后再回调；无 rAF 时同步执行。 */
export function afterNextPaint(callback: () => void): void {
  if (typeof requestAnimationFrame !== 'function') {
    callback()
    return
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(callback)
  })
}
