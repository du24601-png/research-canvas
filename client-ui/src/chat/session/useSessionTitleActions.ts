import { useCallback } from 'react'
import type { SettingsSection } from '../../pages/settings/SettingsSidebar'
import type { SessionMeta } from '../../types/chat'
import { DEFAULT_SESSION_DISPLAY_TITLE } from '../sessionSidebarPresentation'
import { listWorkspaceGrants, renameSession } from '../../api/client'
import { sessionToMarkdown } from '../sessionExportMarkdown'
import { saveTextFileWithDialog } from '../../platform/saveTextFile'
import { copyTextToClipboard } from '../../platform/clipboard'
import { isElectron } from '../../platform/detect'
import type { EngineErrorPort } from './engineTypes'

export interface SessionTitleActionsPorts {
  view: string
  isStandaloneView: boolean
  activeId: string | null
  activeSessionMeta: SessionMeta | null
  activeSession: SessionMeta | null
  messages: Parameters<typeof sessionToMarkdown>[1]
  onError: EngineErrorPort
  openRolePersonaDrawer: () => void
  handleArchive: (id: string, folderId: string) => Promise<void>
  handleDelete: (id: string) => Promise<void>
  setSessions: import('react').Dispatch<import('react').SetStateAction<SessionMeta[]>>
  setActiveSessionMeta: import('react').Dispatch<import('react').SetStateAction<SessionMeta | null>>
  sessions: SessionMeta[]
  onSelectSession: (id: string) => void
  onOpenSearch: () => void
  onOpenSettings: (section?: SettingsSection) => void
  onNewChat: () => void
}

/** 标题槽纯数据束（L2 无头约定）：可见性 + 展示字段 + 回调；JSX 元素由 workspace/sessionTitleSlots 组装 */
export interface SessionTitleToolsData {
  /** chat 主视图且非独立视图时渲染双标题槽 */
  visible: boolean
  title: string
  sessionId: string | null
  createdAt: string | null | undefined
  sessionUsageTotal: number | null
  onRename: (title: string) => Promise<void>
  onArchive: (folderId: string) => Promise<void>
  onDelete: () => void
  onExport: () => Promise<void>
  onOpenSessionDir: () => Promise<void>
  onEditRolePersona: (() => void) | undefined
  sessions: SessionMeta[]
  onSelectSession: (id: string) => void
  onOpenSearch: () => void
  onOpenSettings: (section?: SettingsSection) => void
  onNewChat: () => void
}

/** 标题工具动作集（原 ChatAppShell 对应段逐字迁移）；本文件零 JSX（L2 纯度） */
export function useSessionTitleActions(ports: SessionTitleActionsPorts) {
  const {
    view,
    isStandaloneView,
    activeId,
    activeSessionMeta,
    activeSession,
    messages,
    onError,
    openRolePersonaDrawer,
    handleArchive,
    handleDelete,
    setSessions,
    setActiveSessionMeta,
    sessions,
    onSelectSession,
    onOpenSearch,
    onOpenSettings,
    onNewChat,
  } = ports

  const handleRenameSession = useCallback(async (title: string) => {
    if (!activeId) return
    try {
      const { session } = await renameSession(activeId, title)
      setActiveSessionMeta(prev => prev && prev.id === activeId
        ? { ...prev, title: session.title, updatedAt: session.updatedAt }
        : prev)
      setSessions(prev => prev.map(sess =>
        sess.id === activeId ? { ...sess, title: session.title, updatedAt: session.updatedAt } : sess,
      ))
    } catch (e) {
      onError(e instanceof Error ? e.message : '重命名失败')
    }
  }, [activeId, onError, setActiveSessionMeta, setSessions])

  const handleArchiveActiveSession = useCallback(async (folderId: string) => {
    if (!activeId) return
    await handleArchive(activeId, folderId)
  }, [activeId, handleArchive])

  const handleDeleteActiveSession = useCallback(async () => {
    if (!activeId) return
    await handleDelete(activeId)
  }, [activeId, handleDelete])

  const handleExportSession = useCallback(async () => {
    if (!activeId || !activeSessionMeta) return
    try {
      const md = sessionToMarkdown(activeSessionMeta, messages)
      const result = await saveTextFileWithDialog(md, activeSessionMeta.title)
      if (!result) return
    } catch (e) {
      onError(e instanceof Error ? e.message : '导出失败')
    }
  }, [activeId, activeSessionMeta, messages, onError])

  const handleOpenSessionDir = useCallback(async () => {
    if (!activeId) return
    try {
      const { grants } = await listWorkspaceGrants(activeId)
      const absPath = grants.find(g => g.is_default)?.abs_path?.trim()
      if (!absPath) {
        onError('暂时无法打开会话目录，请稍后重试')
        return
      }
      if (isElectron() && window.electronAPI?.openLocalDirectory) {
        await window.electronAPI.openLocalDirectory(absPath)
        return
      }
      const copied = await copyTextToClipboard(absPath)
      onError(copied ? '已复制会话目录路径' : '暂时无法打开会话目录，请稍后重试')
    } catch {
      onError('暂时无法打开会话目录，请稍后重试')
    }
  }, [activeId, onError])

  const handleDeleteActiveSessionWrapped = useCallback(() => {
    void handleDeleteActiveSession()
  }, [handleDeleteActiveSession])

  const titleTools: SessionTitleToolsData = {
    visible: view === 'chat' && !isStandaloneView,
    title: activeSession?.title ?? DEFAULT_SESSION_DISPLAY_TITLE,
    sessionId: activeId,
    createdAt: activeSession?.createdAt,
    sessionUsageTotal: activeSession?.usageTotals?.totalTokens ?? null,
    onRename: handleRenameSession,
    onArchive: handleArchiveActiveSession,
    onDelete: handleDeleteActiveSessionWrapped,
    onExport: handleExportSession,
    onOpenSessionDir: handleOpenSessionDir,
    onEditRolePersona: activeId ? openRolePersonaDrawer : undefined,
    sessions,
    onSelectSession,
    onOpenSearch,
    onOpenSettings,
    onNewChat,
  }

  return { titleTools }
}
