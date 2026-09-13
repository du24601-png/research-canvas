import { useCallback, useState } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import {
  clearSessionArchiveFolder,
  createSessionArchiveFolder,
  deleteSession,
  deleteSessionArchiveFolder,
  listArchivedSessions,
  listSessionArchiveFolders,
  renameSessionArchiveFolder,
} from '../../api/client'
import type { ArchiveFolderGroup } from '../SessionSidebarArchivePanel'
import type {
  ChatDisplayMessage,
  SessionContextRef,
  SessionLlmParams,
  SessionMeta,
} from '../../types/chat'

export interface SessionArchivePorts {
  onError: (message: string) => void
  activeId: string | null
  refreshSessions: () => Promise<SessionMeta[]>
  loadSession: (id: string) => Promise<void>
  resetContextUsageForSession: (sessionId: string | null) => void
  activeIdRef: MutableRefObject<string | null>
  setActiveId: Dispatch<SetStateAction<string | null>>
  setActiveSessionMeta: Dispatch<SetStateAction<SessionMeta | null>>
  setMessages: Dispatch<SetStateAction<ChatDisplayMessage[]>>
  setContextRef: Dispatch<SetStateAction<SessionContextRef | null>>
  setSessionModelState: Dispatch<SetStateAction<string | undefined>>
  setSessionLlmParamsState: Dispatch<SetStateAction<SessionLlmParams | undefined>>
}

/**
 * 归档分组 + 归档文件夹 / 归档会话操作（原 refreshArchived 与文件夹 CRUD 段逐字迁移）。
 * 回退差异保真（风险 15）：本 hook 的清空回退分支会清 model/params；
 * handleDelete 的回退分支不清（该差异由 useSessionCrudActions 侧保留）。
 */
export function useSessionArchive(ports: SessionArchivePorts) {
  const {
    onError,
    activeId,
    refreshSessions,
    loadSession,
    resetContextUsageForSession,
    activeIdRef,
    setActiveId,
    setActiveSessionMeta,
    setMessages,
    setContextRef,
    setSessionModelState,
    setSessionLlmParamsState,
  } = ports
  const [archivedGroups, setArchivedGroups] = useState<ArchiveFolderGroup[]>([])

  const refreshArchived = useCallback(async () => {
    try {
      const { groups } = await listArchivedSessions()
      if (groups.length) {
        setArchivedGroups(groups)
        return groups
      }
      // 兜底：归档分组为空时用文件夹列表合成空组，避免误报「还没有归档文件夹」
      const { folders } = await listSessionArchiveFolders()
      const synthesized: ArchiveFolderGroup[] = folders.map(folder => ({
        folder,
        sessions: [],
      }))
      setArchivedGroups(synthesized)
      return synthesized
    } catch (e) {
      onError(e instanceof Error ? e.message : '暂时无法加载归档')
      return []
    }
  }, [onError])

  const handleCreateArchiveFolder = useCallback(async (title: string) => {
    try {
      await createSessionArchiveFolder(title)
      await refreshArchived()
    } catch (e) {
      onError(e instanceof Error ? e.message : '创建文件夹失败')
    }
  }, [onError, refreshArchived])

  const handleRenameArchiveFolder = useCallback(async (id: string, title: string) => {
    try {
      await renameSessionArchiveFolder(id, title)
      await refreshArchived()
    } catch (e) {
      onError(e instanceof Error ? e.message : '重命名失败')
    }
  }, [onError, refreshArchived])

  const handleDeleteArchiveFolder = useCallback(async (id: string) => {
    try {
      await deleteSessionArchiveFolder(id)
      await refreshArchived()
    } catch (e) {
      onError(e instanceof Error ? e.message : '删除文件夹失败')
    }
  }, [onError, refreshArchived])

  const handleClearArchiveFolder = useCallback(async (id: string) => {
    try {
      const clearedIds = new Set(
        archivedGroups.find(g => g.folder.id === id)?.sessions.map(s => s.id) ?? [],
      )
      await clearSessionArchiveFolder(id)
      await refreshArchived()
      if (activeId && clearedIds.has(activeId)) {
        const list = await refreshSessions()
        if (list.length > 0) {
          await loadSession(list[0].id)
        } else {
          activeIdRef.current = null
          setActiveId(null)
          setActiveSessionMeta(null)
          setMessages([])
          setContextRef(null)
          setSessionModelState(undefined)
          setSessionLlmParamsState(undefined)
          resetContextUsageForSession(null)
        }
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : '清空文件夹失败')
    }
  }, [activeId, activeIdRef, archivedGroups, loadSession, onError, refreshArchived, refreshSessions, resetContextUsageForSession, setActiveId, setActiveSessionMeta, setContextRef, setMessages, setSessionLlmParamsState, setSessionModelState])

  const handleDeleteArchivedSession = useCallback(async (id: string) => {
    try {
      await deleteSession(id)
      await refreshArchived()
      if (activeId === id) {
        const list = await refreshSessions()
        if (list.length > 0) {
          await loadSession(list[0].id)
        } else {
          activeIdRef.current = null
          setActiveId(null)
          setActiveSessionMeta(null)
          setMessages([])
          setContextRef(null)
          setSessionModelState(undefined)
          setSessionLlmParamsState(undefined)
          resetContextUsageForSession(null)
        }
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : '删除失败')
    }
  }, [activeId, activeIdRef, loadSession, onError, refreshArchived, refreshSessions, resetContextUsageForSession, setActiveId, setActiveSessionMeta, setContextRef, setMessages, setSessionLlmParamsState, setSessionModelState])

  return {
    archivedGroups,
    refreshArchived,
    handleCreateArchiveFolder,
    handleRenameArchiveFolder,
    handleDeleteArchiveFolder,
    handleClearArchiveFolder,
    handleDeleteArchivedSession,
  }
}
