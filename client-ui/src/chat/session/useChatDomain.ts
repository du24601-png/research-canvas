import { useCallback, useEffect } from 'react'
import type { MutableRefObject } from 'react'
import type { AppRoute } from '../../hooks/useAppNavigation'
import type { ChatAttachmentMeta } from '../../types/chat'
import { useWorkspaceUi } from '../workspace/WorkspaceUiContext'
import { findFirstSessionArtifact } from '../workspace/sessionArtifact'
import { useSessionHealth } from './useSessionHealth'
import { useSessionList } from './useSessionList'
import { useEngineRefs } from './useEngineRefs'
import { useStreamFlags } from './useStreamFlags'
import { useSessionData } from './useSessionData'
import { useChatEngine } from './useChatEngine'
import { registerResearchAdjustDraftSink } from '../research-canvas/researchPreviewAdjust'

export interface ChatDomainPorts {
  /** viewRef 由 Shell 持有并注入（通知 / popstate 语义读取当前视图） */
  viewRef: MutableRefObject<AppRoute>
  /** 聊天错误单通道（Shell 持有 error state） */
  onError: (message: string) => void
  setContextHintBanner: (message: string) => void
}

/**
 * 引擎 + 数据域组合（Shell 级组合层）：
 * health → list → refs → flags → data → engine（组合顺序 TDZ 关键，见 useChatEngine）。
 * boot 效应与 visibility 效应在此组合 notify + data（两域同时可见，等价原 Shell 组合）。
 */
export function useChatDomain(ports: ChatDomainPorts) {
  const { viewRef, onError, setContextHintBanner } = ports
  const ui = useWorkspaceUi()
  const {
    isMobile, splitEnabled,
    previewTarget: preview, setPreviewTarget: setPreview, previewAutoOpenDismissed, openPreviewTarget,
    resetPreviewAutoOpenState,
    closePreview: handleClosePreview,
    mobileRightSheet, openMobileSheet, closeMobileRightSheet,
    closeDrawer,
  } = ui

  const health = useSessionHealth()
  const {
    availableModels, defaultModel, llmLabel, backendOk, setDefaultModel, refreshHealth,
  } = health
  const { sessions, setSessions, sessionsRef, refreshSessions } = useSessionList()
  const refs = useEngineRefs()
  const flags = useStreamFlags()
  const {
    streamingSessionIds, wakeWaitingSessionIds,
    streamingSessionIdsRef, wakeWaitingSessionIdsRef,
    markSessionStreaming, markSessionWakeWaiting,
  } = flags

  const data = useSessionData({
    refs,
    streamingSessionIdsRef,
    sessions,
    refreshSessions,
    setSessions,
    defaultModel,
    setDefaultModel,
    onError,
    setContextHintBanner,
  })
  const {
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
    setSessionModelState,
    sessionLlmParams,
    setSessionLlmParamsState,
    resolvedSessionModel,
    contextUsage,
    setContextUsage,
    welcomeEpoch,
    setWelcomeEpoch,
    chatScrollEpoch,
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
  } = data

  const loading = activeId ? streamingSessionIds.includes(activeId) : false
  const wakeWaiting = activeId ? wakeWaitingSessionIds.includes(activeId) : false

  useEffect(() => registerResearchAdjustDraftSink(pushComposerDraft), [pushComposerDraft])

  // 预览桥（原 Shell 预览回调与效应逐字迁移）
  const toggleMobilePreviewSheet = useCallback(() => {
    closeDrawer()
    if (mobileRightSheet === 'preview') {
      setPreview(null)
      closeMobileRightSheet()
      return
    }
    openMobileSheet('preview')
  }, [closeDrawer, mobileRightSheet, setPreview, closeMobileRightSheet, openMobileSheet])

  const handleToggleSessionFilesPreview = useCallback(() => {
    if (isMobile) {
      if (!activeId) return
      toggleMobilePreviewSheet()
      return
    }
    if (ui.paneMode === 'preview') {
      handleClosePreview()
      return
    }
    openPreviewTarget(preview)
  }, [isMobile, activeId, toggleMobilePreviewSheet, ui.paneMode, handleClosePreview, openPreviewTarget, preview])

  const handleOpenMobileFilesPanel = useCallback(() => {
    if (!activeId) return
    toggleMobilePreviewSheet()
  }, [activeId, toggleMobilePreviewSheet])

  const handleSelectPreviewAttachment = useCallback((att: ChatAttachmentMeta) => {
    if (!activeId) return
    setPreview({ sessionId: activeId, attachment: att })
  }, [activeId, setPreview])

  /** 切换对话时丢弃旧会话的预览附件，保留 preview 模式以便显示新会话列表/空态 */
  useEffect(() => {
    resetPreviewAutoOpenState()
    setPreview((prev) => {
      if (!prev) return null
      if (!activeId || prev.sessionId !== activeId) return null
      return prev
    })
  }, [activeId, resetPreviewAutoOpenState, setPreview])

  /** 桌面分栏：进入/停留本会话且有产物时，默认打开第一个产物预览（用户关闭后本 visit 不再自动开） */
  useEffect(() => {
    if (!splitEnabled || !activeId) return
    if (previewAutoOpenDismissed) return
    if (preview) return
    const first = findFirstSessionArtifact(messages)
    if (!first) return
    openPreviewTarget({ sessionId: activeId, attachment: first })
  }, [splitEnabled, activeId, messages, preview, previewAutoOpenDismissed, openPreviewTarget])

  const engine = useChatEngine(refs, flags, {
    viewRef,
    onError,
    activeId,
    activeIdRef,
    activeSessionMetaRef,
    sessionsRef,
    setActiveId,
    setActiveSessionMeta,
    setMessages,
    messages,
    setContextRef,
    setSessionModelState,
    setSessionLlmParamsState,
    setContextUsage,
    resetContextUsageForSession,
    refreshSessions,
    setSessions,
    setDefaultModel,
    setContextHintBanner,
  })

  // visibility 效应：离焦追踪 + 回前台同步当前会话（原 Shell 组合 notify + data 的效应逐字迁移）
  const { markStreamingSessionsAwayIfNeeded } = engine
  useEffect(() => {
    const onVisibilityOrFocusChange = () => {
      void markStreamingSessionsAwayIfNeeded()
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void syncActiveSessionFromServer()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityOrFocusChange)
    window.addEventListener('blur', onVisibilityOrFocusChange)
    window.addEventListener('focus', onVisibilityOrFocusChange)
    const timer = window.setInterval(() => {
      void markStreamingSessionsAwayIfNeeded()
    }, 2000)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityOrFocusChange)
      window.removeEventListener('blur', onVisibilityOrFocusChange)
      window.removeEventListener('focus', onVisibilityOrFocusChange)
      window.clearInterval(timer)
    }
  }, [markStreamingSessionsAwayIfNeeded, syncActiveSessionFromServer])

  // boot 效应：首启拉健康 + 会话列表并进入首个会话；健康定时轮询（原 Shell 效应逐字迁移）
  useEffect(() => {
    let cancelled = false

    refreshHealth().catch(() => {})

    refreshSessions()
      .then(async list => {
        if (cancelled) return
        if (list.length > 0) {
          await loadSession(list[0].id)
        }
      })
      .catch(e => {
        if (!cancelled) onError(e instanceof Error ? e.message : '加载对话失败')
      })

    const timer = setInterval(() => { refreshHealth().catch(() => {}) }, 15000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [loadSession, onError, refreshHealth, refreshSessions])

  return {
    refs,
    flags,
    // health
    availableModels, llmLabel, backendOk, refreshHealth, setDefaultModel,
    // list
    sessions, setSessions, sessionsRef, refreshSessions,
    // data
    activeId, setActiveId, activeIdRef, activeSessionMeta, setActiveSessionMeta, activeSessionMetaRef,
    messages, setMessages, contextRef, setContextRef, composerDraft, pushComposerDraft,
    setSessionModelState, setSessionLlmParamsState,
    resolvedSessionModel, sessionLlmParams, contextUsage, setContextUsage,
    welcomeEpoch, setWelcomeEpoch, chatScrollEpoch, activeSession,
    refreshContextUsage, resetContextUsageForSession, handleModelPanelOpenChange,
    loadSession, ensureSession, handleClearContextRef, handleQuoteSelection,
    handleModelChange, handleLlmParamsChange, handleToggleArtifacts,
    // view 派生
    loading, wakeWaiting,
    // 预览桥
    handleToggleSessionFilesPreview, handleOpenMobileFilesPanel, handleSelectPreviewAttachment,
    // engine
    engine,
  }
}
