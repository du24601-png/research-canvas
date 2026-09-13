import type { ReactNode } from 'react'
import ChatSessionTitleTools from '../ChatSessionTitleTools'
import type { SessionTitleToolsData } from '../session/useSessionTitleActions'

export interface SessionTitleSlots {
  sessionTitleTools: ReactNode
  chatTitleSlot: ReactNode
}

/**
 * 会话标题双 slot 构建（L5 壳层职责）：chrome（桌面标题栏）与 header（聊天区顶栏）。
 * 数据与回调由 session/useSessionTitleActions（L2 无头 hook）提供，此处只做元素组装；
 * 元素 props 与原 hook 内构建逐字一致，行为零变更。
 */
export function buildSessionTitleSlots(data: SessionTitleToolsData): SessionTitleSlots {
  if (!data.visible) {
    return { sessionTitleTools: null, chatTitleSlot: null }
  }

  const sessionTitleTools = (
    <ChatSessionTitleTools
      title={data.title}
      sessionId={data.sessionId}
      variant="chrome"
      textClassName="opptrix-desktop-title-text"
      createdAt={data.createdAt}
      sessionUsageTotal={data.sessionUsageTotal}
      onRename={data.onRename}
      onArchive={data.onArchive}
      onDelete={data.onDelete}
      onExport={data.onExport}
      onOpenSessionDir={data.onOpenSessionDir}
      onEditRolePersona={data.onEditRolePersona}
    />
  )

  const chatTitleSlot = (
    <ChatSessionTitleTools
      title={data.title}
      sessionId={data.sessionId}
      variant="header"
      createdAt={data.createdAt}
      sessionUsageTotal={data.sessionUsageTotal}
      onRename={data.onRename}
      onArchive={data.onArchive}
      onDelete={data.onDelete}
      onExport={data.onExport}
      onOpenSessionDir={data.onOpenSessionDir}
      onEditRolePersona={data.onEditRolePersona}
    />
  )

  return { sessionTitleTools, chatTitleSlot }
}
