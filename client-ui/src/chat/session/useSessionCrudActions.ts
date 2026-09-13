import { useCallback } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { archiveSession, createSession, deleteSession, forkSession, truncateSession } from '../../api/client'
import type { SidebarListTab } from '../SessionSidebar'
import type { ChatDisplayMessage, SessionContextRef, SessionLlmParams, SessionMeta } from '../../types/chat'
import { clearSessionPromptQueue } from '../sessionPromptQueue'
import type { OpptrixDialogAlertOptions } from '../../components/opptrix/OpptrixDialogAlert'
import type { SubmitImpl, EngineErrorPort } from './engineTypes'

export interface SessionCrudPorts {
  confirm: (options: OpptrixDialogAlertOptions) => Promise<boolean>
  restoreChatColumn: () => void
  closeDrawer: () => void
  navigate: (route: 'chat') => void
  view: string
  activeId: string | null
  activeIdRef: MutableRefObject<string | null>
  messages: ChatDisplayMessage[]
  setSidebarListTab: (tab: SidebarListTab) => void
  onError: EngineErrorPort
  setActiveId: Dispatch<SetStateAction<string | null>>
  setActiveSessionMeta: Dispatch<SetStateAction<SessionMeta | null>>
  setMessages: Dispatch<SetStateAction<ChatDisplayMessage[]>>
  setContextRef: Dispatch<SetStateAction<SessionContextRef | null>>
  setSessionModelState: Dispatch<SetStateAction<string | undefined>>
  setSessionLlmParamsState: Dispatch<SetStateAction<SessionLlmParams | undefined>>
  setWelcomeEpoch: Dispatch<SetStateAction<number>>
  pushComposerDraft: (text: string) => void
  loadSession: (id: string) => Promise<void>
  resetContextUsageForSession: (sessionId: string | null) => void
  refreshSessions: () => Promise<SessionMeta[]>
  setSessions: Dispatch<SetStateAction<SessionMeta[]>>
  setDefaultModel: Dispatch<SetStateAction<string | undefined>>
  refreshArchived: () => Promise<unknown>
  abortSessionStream: (sessionId: string) => Promise<void>
  clearSessionWakeState: (sessionId: string) => void
  clearSessionBackgroundJobs: (sessionId: string) => void
  clearSessionCollaborationTasks: (sessionId: string) => void
  syncPromptQueueUi: (sessionId: string | null) => void
  drainIntentRef: MutableRefObject<Map<string, { kind: 'auto' | 'none' | 'runItem'; itemId?: string }>>
  streamingSessionIdsRef: MutableRefObject<Set<string>>
  submitImplRef: MutableRefObject<SubmitImpl>
}

/** 会话 CRUD 动作（原 ChatAppShell handleNew/Select/Delete/SelectExpert/Archive/fork/editResend 段逐字迁移） */
export function useSessionCrudActions(ports: SessionCrudPorts) {
  const {
    confirm,
    restoreChatColumn,
    closeDrawer,
    navigate,
    view,
    activeId,
    activeIdRef,
    messages,
    setSidebarListTab,
    onError,
    setActiveId,
    setActiveSessionMeta,
    setMessages,
    setContextRef,
    setSessionModelState,
    setSessionLlmParamsState,
    setWelcomeEpoch,
    pushComposerDraft,
    loadSession,
    resetContextUsageForSession,
    refreshSessions,
    setSessions,
    setDefaultModel,
    refreshArchived,
    abortSessionStream,
    clearSessionWakeState,
    clearSessionBackgroundJobs,
    clearSessionCollaborationTasks,
    syncPromptQueueUi,
    drainIntentRef,
    streamingSessionIdsRef,
    submitImplRef,
  } = ports
  const handleNew = useCallback(async () => {
    restoreChatColumn()
    try {
      const { session } = await createSession()
      const list = await refreshSessions()
      setSessions(list)
      activeIdRef.current = session.id
      setActiveId(session.id)
      setActiveSessionMeta(session)
      setMessages([])
      setContextRef(null)
      setSessionModelState(session.model)
      setSessionLlmParamsState(session.llmParams)
      if (session.model?.trim()) setDefaultModel(session.model.trim())
      pushComposerDraft('')
      onError('')
      setWelcomeEpoch(epoch => epoch + 1)
      resetContextUsageForSession(session.id)
      closeDrawer()
      if (view !== 'chat') navigate('chat')
    } catch (e) {
      onError(e instanceof Error ? e.message : '创建对话失败')
    }
  }, [closeDrawer, navigate, onError, pushComposerDraft, refreshSessions, resetContextUsageForSession, restoreChatColumn, setContextRef, setActiveId, setActiveSessionMeta, setDefaultModel, setMessages, setSessionLlmParamsState, setSessionModelState, setSessions, setWelcomeEpoch, view])
  const handleSelect = useCallback(async (id: string) => {
    restoreChatColumn()
    if (id === activeId) {
      if (view !== 'chat') navigate('chat')
      return
    }
    try {
      await loadSession(id)
      if (view !== 'chat') navigate('chat')
    } catch (e) {
      onError(e instanceof Error ? e.message : '加载对话失败')
    }
  }, [activeId, loadSession, navigate, onError, restoreChatColumn, view])
  const handleDelete = useCallback(async (id: string) => {
    const ok = await confirm({
      title: '确定删除此对话？',
      message: '删除后无法恢复，进行中的协作任务也会一并结束。',
      confirmLabel: '删除',
      confirmTone: 'danger',
    })
    if (!ok) return
    try {
      if (streamingSessionIdsRef.current.has(id)) {
        await abortSessionStream(id)
      }
      clearSessionWakeState(id)
      clearSessionBackgroundJobs(id)
      clearSessionCollaborationTasks(id)
      clearSessionPromptQueue(id)
      drainIntentRef.current.delete(id)
      syncPromptQueueUi(activeIdRef.current === id ? null : activeIdRef.current)
      await deleteSession(id)
      const list = await refreshSessions()
      if (activeId === id) {
        if (list.length > 0) {
          await loadSession(list[0].id)
        } else {
          // 回退差异保真（风险 15）：此处回退不清 model/params
          activeIdRef.current = null
          setActiveId(null)
          setActiveSessionMeta(null)
          setMessages([])
          setContextRef(null)
          resetContextUsageForSession(null)
        }
      }
    } catch (e) {
      onError(e instanceof Error ? e.message : '删除失败')
    }
  }, [abortSessionStream, activeId, activeIdRef, clearSessionBackgroundJobs, clearSessionCollaborationTasks, clearSessionWakeState, confirm, drainIntentRef, loadSession, onError, refreshSessions, resetContextUsageForSession, setActiveId, setActiveSessionMeta, setContextRef, setMessages, streamingSessionIdsRef, syncPromptQueueUi])
  // 回退差异保真（风险 15）：归档回退会清 model/params（与 handleDelete 回退不同）
  const handleArchive = useCallback(async (id: string, folderId: string) => {
    try {
      await archiveSession(id, folderId)
      clearSessionPromptQueue(id)
      drainIntentRef.current.delete(id)
      const list = await refreshSessions()
      setSessions(list)
      void refreshArchived()
      if (activeId === id) {
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
      onError(e instanceof Error ? e.message : '归档失败')
    }
  }, [activeId, drainIntentRef, loadSession, onError, refreshArchived, refreshSessions, resetContextUsageForSession, setActiveId, setActiveSessionMeta, setContextRef, setMessages, setSessionLlmParamsState, setSessionModelState, setSessions])
  const handleArchiveActiveSession = useCallback(async (folderId: string) => {
    if (!activeId) return
    await handleArchive(activeId, folderId)
  }, [activeId, handleArchive])
  const handleDeleteActiveSession = useCallback(async () => {
    if (!activeId) return
    await handleDelete(activeId)
  }, [activeId, handleDelete])
  const handleForkFromMessage = useCallback(async (messageIndex: number) => {
    if (!activeId) return
    try {
      const data = await forkSession(activeId, messageIndex)
      const list = await refreshSessions()
      setSessions(list)
      activeIdRef.current = data.session.id
      setActiveId(data.session.id)
      setMessages(data.messages)
      setContextRef(data.contextRef ?? null)
      setSessionModelState(data.session.model)
      setSessionLlmParamsState(data.session.llmParams)
      pushComposerDraft('')
      onError('')
      resetContextUsageForSession(data.session.id)
      closeDrawer()
      if (view !== 'chat') navigate('chat')
    } catch (e) {
      onError(e instanceof Error ? e.message : '分叉对话失败')
    }
  }, [activeId, closeDrawer, navigate, onError, pushComposerDraft, refreshSessions, resetContextUsageForSession, setContextRef, setActiveId, setMessages, setSessionLlmParamsState, setSessionModelState, setSessions, view])

  // 流式中拦截保留（原 :2480-2483 语义）
  const handleEditResend = useCallback(async (messageIndex: number, text: string) => {
    const sid = activeIdRef.current
    if (!sid) return

    if (streamingSessionIdsRef.current.has(sid)) {
      onError('正在生成回复，请稍后再编辑')
      return
    }

    const target = messages[messageIndex]
    if (!target || target.role !== 'user') return

    const nextText = text.trim()
    const attachmentIds = (target.attachments ?? []).map(a => a.id)
    const hasAttachments = attachmentIds.length > 0
    if (!nextText && !hasAttachments) return

    const hasFollowing = messageIndex < messages.length - 1
    const textUnchanged = nextText === target.content.trim()
    if (textUnchanged && !hasFollowing) return

    if (hasFollowing) {
      const ok = await confirm({
        title: '重新发送这条消息？',
        message: '重新发送后，这条之后的回复都会被清除，且无法恢复。确定继续？',
        confirmLabel: '重新发送',
        cancelLabel: '取消',
        confirmTone: 'danger',
      })
      if (!ok) return
    }

    try {
      onError('')
      const data = await truncateSession(sid, messageIndex)
      if (activeIdRef.current === sid) {
        setMessages(data.messages)
        setContextRef(data.contextRef ?? null)
        setActiveSessionMeta(data.session)
        setSessionModelState(data.session.model)
        setSessionLlmParamsState(data.session.llmParams)
      }
      void submitImplRef.current(
        nextText || undefined,
        hasAttachments ? attachmentIds : undefined,
        hasAttachments ? target.attachments : undefined,
      )
    } catch (e) {
      onError(e instanceof Error ? e.message : '重新发送失败，请稍后重试')
    }
  }, [activeIdRef, confirm, messages, onError, setActiveSessionMeta, setContextRef, setMessages, setSessionLlmParamsState, setSessionModelState, streamingSessionIdsRef, submitImplRef])

  return {
    handleNew,
    handleSelect,
    handleDelete,
    handleArchive,
    handleArchiveActiveSession,
    handleDeleteActiveSession,
    handleForkFromMessage,
    handleEditResend,
  }
}
