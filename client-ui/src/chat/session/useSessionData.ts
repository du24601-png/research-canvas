import { useCallback, useRef, useState } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import {
  clearSessionContext, createSession, getSession, getSessionContextUsage, setSessionContext, setSessionModel, setSessionLlmParams, setSessionArtifactsEnabled,
} from '../../api/client'
import type {
  ChatContextUsage, ChatDisplayMessage, MessageSelection, SessionContextRef, SessionLlmParams, SessionMeta, SessionSelectionContextRef,
} from '../../types/chat'
import { previewSelectionText } from '../../utils/formatContextRefPreview'
import type { ChatEngineRefs, EngineErrorPort } from './engineTypes'

export interface SessionDataPorts {
  refs: ChatEngineRefs
  streamingSessionIdsRef: MutableRefObject<Set<string>>
  sessions: SessionMeta[]
  refreshSessions: () => Promise<SessionMeta[]>
  setSessions: Dispatch<SetStateAction<SessionMeta[]>>
  defaultModel: string | undefined
  setDefaultModel: Dispatch<SetStateAction<string | undefined>>
  onError: EngineErrorPort
  setContextHintBanner: (message: string) => void
}

/**
 * 活动会话数据域（原 ChatAppShell 会话状态与数据回调段逐字迁移）。
 * activeIdRef / activeSessionMetaRef / sessionModelRef 的 render 期赋值语义保留。
 */
export function useSessionData(ports: SessionDataPorts) {
  const {
    refs,
    streamingSessionIdsRef,
    sessions,
    refreshSessions,
    setSessions,
    defaultModel,
    setDefaultModel,
    onError,
    setContextHintBanner,
  } = ports
  const { streamResetTimersRef, sessionModelRef } = refs

  const [activeId, setActiveId] = useState<string | null>(null)
  const activeIdRef = useRef<string | null>(null)
  const [activeSessionMeta, setActiveSessionMeta] = useState<SessionMeta | null>(null)
  const activeSessionMetaRef = useRef(activeSessionMeta)
  const [messages, setMessages] = useState<ChatDisplayMessage[]>([])
  const [contextRef, setContextRef] = useState<SessionContextRef | null>(null)
  const [composerDraft, setComposerDraft] = useState({ revision: 0, text: '' })
  const pushComposerDraft = useCallback((text: string) => {
    setComposerDraft(prev => ({ revision: prev.revision + 1, text }))
  }, [])
  const [sessionModel, setSessionModelState] = useState<string | undefined>()
  const [sessionLlmParams, setSessionLlmParamsState] = useState<SessionLlmParams | undefined>()
  const resolvedSessionModel = sessionModel ?? defaultModel
  const [contextUsage, setContextUsage] = useState<ChatContextUsage | null>(null)
  const [welcomeEpoch, setWelcomeEpoch] = useState(0)
  const [chatScrollEpoch, setChatScrollEpoch] = useState(0)

  const refreshContextUsage = useCallback(async (
    sessionId: string,
    opts?: { force?: boolean },
  ) => {
    try {
      const { contextUsage: next } = await getSessionContextUsage(sessionId, opts)
      if (activeIdRef.current === sessionId) {
        setContextUsage(next)
      }
    } catch {
      if (activeIdRef.current === sessionId) {
        setContextUsage(null)
      }
    }
  }, [activeIdRef])

  /** 从服务端同步当前会话（消息/引用/用量）；移动端前后台切换时避免依赖本地缓存 */
  const syncActiveSessionFromServer = useCallback(async () => {
    const sid = activeIdRef.current
    if (!sid) return
    if (streamingSessionIdsRef.current.has(sid)) {
      void refreshContextUsage(sid, { force: true })
      return
    }
    try {
      const fresh = await getSession(sid)
      if (activeIdRef.current !== sid) return
      setActiveSessionMeta(fresh.session)
      setMessages(fresh.messages)
      setContextRef(fresh.contextRef ?? null)
      setSessionModelState(fresh.session.model)
      setSessionLlmParamsState(fresh.session.llmParams)
      await refreshContextUsage(sid, { force: true })
    } catch {
      await refreshContextUsage(sid, { force: true })
    }
  }, [activeIdRef, refreshContextUsage, setActiveSessionMeta, setContextRef, setMessages, setSessionLlmParamsState, setSessionModelState, streamingSessionIdsRef])

  /** 切到新空会话 / 清空活动会话：先清 React 残留，再拉本窗用量 */
  const resetContextUsageForSession = useCallback((sessionId: string | null) => {
    setContextUsage(null)
    if (!sessionId) return
    void refreshContextUsage(sessionId, { force: true })
  }, [refreshContextUsage])

  const handleModelPanelOpenChange = useCallback((open: boolean) => {
    if (!open || !activeIdRef.current) return
    void refreshContextUsage(activeIdRef.current, { force: true })
  }, [activeIdRef, refreshContextUsage])

  const loadSession = useCallback(async (id: string) => {
    const prevId = activeIdRef.current
    if (prevId && prevId !== id) {
      const pending = streamResetTimersRef.current.get(prevId)
      if (pending != null) {
        window.clearTimeout(pending)
        streamResetTimersRef.current.delete(prevId)
      }
    }
    pushComposerDraft('')
    const data = await getSession(id)
    activeIdRef.current = id
    setActiveId(id)
    setActiveSessionMeta(data.session)
    setMessages(data.messages)
    setContextRef(data.contextRef ?? null)
    setSessionModelState(data.session.model)
    setSessionLlmParamsState(data.session.llmParams)
    setContextUsage(data.contextUsage ?? null)
    onError('')
    setChatScrollEpoch(epoch => epoch + 1)
    void refreshContextUsage(id, { force: true })
  }, [activeIdRef, onError, pushComposerDraft, refreshContextUsage, setChatScrollEpoch, setContextRef, setActiveId, setActiveSessionMeta, setContextUsage, setMessages, setSessionLlmParamsState, setSessionModelState, streamResetTimersRef])

  const ensureSession = useCallback(async (): Promise<string> => {
    if (activeIdRef.current) return activeIdRef.current
    const { session } = await createSession()
    activeIdRef.current = session.id
    setActiveId(session.id)
    setActiveSessionMeta(session)
    setSessionModelState(session.model)
    setSessionLlmParamsState(session.llmParams)
    if (session.model?.trim()) setDefaultModel(session.model.trim())
    await refreshSessions()
    resetContextUsageForSession(session.id)
    return session.id
  }, [activeIdRef, refreshSessions, resetContextUsageForSession, setActiveId, setActiveSessionMeta, setDefaultModel, setSessionLlmParamsState, setSessionModelState])

  const handleToggleArtifacts = useCallback(async (enabled: boolean) => {
    let id = activeIdRef.current
    if (!id) {
      try {
        id = await ensureSession()
      } catch (e) {
        onError(e instanceof Error ? e.message : '无法开始对话')
        return
      }
    }
    setActiveSessionMeta(prev => prev && prev.id === id ? { ...prev, artifactsEnabled: enabled } : prev)
    setSessions(prev => prev.map(sess => sess.id === id ? { ...sess, artifactsEnabled: enabled } : sess))
    try {
      const res = await setSessionArtifactsEnabled(id, enabled)
      if (activeIdRef.current !== id) return
      setActiveSessionMeta(prev => prev && prev.id === id
        ? { ...prev, artifactsEnabled: Boolean(res.session.artifactsEnabled) }
        : prev)
      setSessions(prev => prev.map(sess =>
        sess.id === id ? { ...sess, artifactsEnabled: Boolean(res.session.artifactsEnabled) } : sess,
      ))
    } catch (e) {
      setActiveSessionMeta(prev => prev && prev.id === id ? { ...prev, artifactsEnabled: !enabled } : prev)
      setSessions(prev => prev.map(sess => sess.id === id ? { ...sess, artifactsEnabled: !enabled } : sess))
      onError(e instanceof Error ? e.message : '无法切换报告与脑图')
    }
  }, [activeIdRef, ensureSession, onError, setActiveSessionMeta, setSessions])

  const handleClearContextRef = useCallback(async () => {
    if (!activeId) return
    try {
      await clearSessionContext(activeId)
      setContextRef(null)
      await refreshContextUsage(activeId)
    } catch (e) {
      onError(e instanceof Error ? e.message : '移除引用失败')
    }
  }, [activeId, onError, refreshContextUsage, setContextRef])

  const handleQuoteSelection = useCallback(async (selection: MessageSelection) => {
    if (!activeId) return
    try {
      const at = messages[selection.messageIndex]?.at ?? new Date().toISOString()
      const nextRef: SessionSelectionContextRef = {
        kind: 'selection',
        selectedText: selection.text,
        sourceMessageIndex: selection.messageIndex,
        sourceRole: selection.messageRole,
        anchorAt: at,
        preview: previewSelectionText(selection.text),
        turns: [{
          role: selection.messageRole,
          content: selection.text,
          at,
        }],
      }
      const data = await setSessionContext(activeId, nextRef)
      setContextRef(data.contextRef ?? nextRef)
      onError('')
      await refreshContextUsage(activeId)
    } catch (e) {
      onError(e instanceof Error ? e.message : '设置引用失败')
    }
  }, [activeId, messages, onError, refreshContextUsage, setContextRef])

  const handleModelChange = useCallback(async (ref: string) => {
    setSessionModelState(ref)
    if (!activeId) {
      setDefaultModel(ref)
      return
    }
    try {
      const res = await setSessionModel(activeId, ref)
      setDefaultModel(ref)
      setSessions(prev => prev.map(sess =>
        sess.id === activeId ? { ...sess, model: ref } : sess,
      ))
      if (res.contextHint?.trim()) {
        setContextHintBanner(res.contextHint.trim())
      }
      await refreshContextUsage(activeId)
    } catch (e) {
      onError(e instanceof Error ? e.message : '切换模型失败')
    }
  }, [activeId, onError, refreshContextUsage, setContextHintBanner, setDefaultModel, setSessionModelState, setSessions])

  const handleLlmParamsChange = useCallback(async (patch: {
    temperature?: number
    maxTokens?: number
    reasoningEffort?: 'low' | 'medium' | 'high' | null
  }) => {
    setSessionLlmParamsState(prev => {
      const next = { ...(prev ?? {}) }
      if (patch.temperature !== undefined) next.temperature = patch.temperature
      if (patch.maxTokens !== undefined) next.maxTokens = patch.maxTokens
      if (patch.reasoningEffort === null) delete next.reasoningEffort
      else if (patch.reasoningEffort !== undefined) next.reasoningEffort = patch.reasoningEffort
      return next
    })
    if (!activeId) return
    try {
      const res = await setSessionLlmParams(activeId, patch)
      setSessionLlmParamsState(res.session.llmParams)
      setSessions(prev => prev.map(sess =>
        sess.id === activeId ? { ...sess, llmParams: res.session.llmParams } : sess,
      ))
      setActiveSessionMeta(prev => prev && prev.id === activeId
        ? { ...prev, llmParams: res.session.llmParams }
        : prev)
    } catch (e) {
      onError(e instanceof Error ? e.message : '保存模型参数失败')
    }
  }, [activeId, onError, setActiveSessionMeta, setSessionLlmParamsState, setSessions])

  activeIdRef.current = activeId
  activeSessionMetaRef.current = activeSessionMeta
  sessionModelRef.current = resolvedSessionModel

  const activeSession = activeSessionMeta ?? sessions.find(x => x.id === activeId) ?? null

  return {
    activeId,
    setActiveId,
    activeIdRef,
    activeSessionMeta,
    setActiveSessionMeta,
    activeSessionMetaRef,
    messages,
    setMessages,
    contextRef,
    setContextRef,
    composerDraft,
    pushComposerDraft,
    sessionModel,
    setSessionModelState,
    sessionLlmParams,
    setSessionLlmParamsState,
    resolvedSessionModel,
    contextUsage,
    setContextUsage,
    welcomeEpoch,
    setWelcomeEpoch,
    chatScrollEpoch,
    setChatScrollEpoch,
    activeSession,
    refreshContextUsage,
    syncActiveSessionFromServer,
    resetContextUsageForSession,
    handleModelPanelOpenChange,
    loadSession,
    ensureSession,
    handleClearContextRef,
    handleQuoteSelection,
    handleModelChange,
    handleLlmParamsChange,
    handleToggleArtifacts,
  }
}
