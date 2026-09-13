import type { ReactNode } from 'react'
import ChatSessionTitleTools from '../ChatSessionTitleTools'
import type { SessionTitleToolsData } from '../session/useSessionTitleActions'

export interface SessionTitleSlots {
  sessionTitleTools: ReactNode
  chatTitleSlot: ReactNode
}

function buildTitleTools(data: SessionTitleToolsData, variant: 'chrome' | 'header') {
  return (
    <ChatSessionTitleTools
      title={data.title}
      sessionId={data.sessionId}
      variant={variant}
      textClassName={variant === 'chrome' ? 'opptrix-desktop-title-text' : undefined}
      createdAt={data.createdAt}
      sessionUsageTotal={data.sessionUsageTotal}
      sessions={data.sessions}
      onSelectSession={data.onSelectSession}
      onOpenSearch={data.onOpenSearch}
      onOpenSettings={data.onOpenSettings}
      onNewChat={data.onNewChat}
      onRename={data.onRename}
      onArchive={data.onArchive}
      onDelete={data.onDelete}
      onExport={data.onExport}
      onOpenSessionDir={data.onOpenSessionDir}
      onEditRolePersona={data.onEditRolePersona}
    />
  )
}

/**
 * 会话标题双 slot 构建（L5 壳层职责）：chrome（桌面标题栏）与 header（聊天区顶栏）。
 * 数据与回调由 session/useSessionTitleActions（L2 无头 hook）提供，此处只做元素组装。
 */
export function buildSessionTitleSlots(data: SessionTitleToolsData): SessionTitleSlots {
  if (!data.visible) {
    return { sessionTitleTools: null, chatTitleSlot: null }
  }

  return {
    sessionTitleTools: buildTitleTools(data, 'chrome'),
    chatTitleSlot: buildTitleTools(data, 'header'),
  }
}
