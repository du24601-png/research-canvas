import {
  createSession, getSession, steerSessionChat, streamSessionChat,
} from '../../api/client'
import type { ChatAttachmentMeta, ChatDisplayMessage } from '../../types/chat'
import { isChatTurnCompleteEvent } from '../../platform/chatNotifications'
import { afterNextPaint } from '../workspace/sessionArtifact'
import { enqueueQueuedPrompt } from '../sessionPromptQueue'
import { createThinkingStreamSnapshot, syncStreamSnapshotToUi } from '../sessionStreamRuntime'
import { getActiveWidgetId } from '../research-canvas/activeWidgetSelection'
import { readPersistedCanvasState } from '../research-canvas/layoutStorage'
import { consumePendingAdjustProposal } from '../research-canvas/researchPreviewAdjust'
import { buildResearchCanvasAgentSnapshot } from '../research-canvas/sessionDatasetSnapshot'
import type { ChatEngineRefs, ChatSubmitPorts, StreamFlags } from './engineTypes'

/** 提交后端
 * 原 ChatAppShell submitImpl 段逐字迁移：render 期重赋值 submitImplRef（语义保留，禁改 useEffect）。
 * streamGen 竞护链（isStreamStale / done 后 500ms resetStreamUi / soft steer / 队列 drain / fork 后
 * session_id 切换）全部原样。
 */
export function useSubmitImpl(refs: ChatEngineRefs, flags: StreamFlags, ports: ChatSubmitPorts) {
  const {
    streamUiRef,
    streamCacheRef,
    streamHandlesRef,
    sessionStreamGenRef,
    stoppingSessionsRef,
    streamResetTimersRef,
    streamAwayDuringGenRef,
    doneNotifiedGensRef,
    drainIntentRef,
    sessionModelRef,
    submitImplRef,
  } = refs
  const {
    streamingSessionIdsRef,
    wakeWaitingSessionIdsRef,
    markSessionStreaming,
  } = flags
  const {
    activeIdRef,
    onError,
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
    clearSessionBackgroundJobs,
    clearSessionWakeState,
    startWakeCountdown,
    pendingWakeRef,
    resolveSessionTitle,
    maybeNotifyChatDone,
    markStreamingSessionsAwayIfNeeded,
    pushStreamEvent,
    syncPromptQueueUi,
    drainPromptQueueAfterStream,
  } = ports

  submitImplRef.current = async (text?: string, attachmentIds?: string[], attachmentMetas?: ChatAttachmentMeta[]) => {
    const msg = (text ?? '').trim()
    const ids = attachmentIds?.filter(Boolean) ?? []
    if (!msg && !ids.length) return

    let sessionId = activeIdRef.current
    if (!sessionId) {
      try {
        const { session } = await createSession()
        sessionId = session.id
        activeIdRef.current = sessionId
        setActiveId(sessionId)
        setActiveSessionMeta(session)
        setSessionModelState(session.model)
        setSessionLlmParamsState(session.llmParams)
        if (session.model?.trim()) setDefaultModel(session.model.trim())
        await refreshSessions()
        resetContextUsageForSession(sessionId)
      } catch (e) {
        onError(e instanceof Error ? e.message : '创建对话失败')
        return
      }
    }

    if (streamingSessionIdsRef.current.has(sessionId)) {
      // 生成中：纯文本走 soft steer；带附件仍排队等本轮结束后发送
      if (!ids.length && msg) {
        try {
          const result = await steerSessionChat(sessionId, msg)
          if (!result.ok) {
            if (result.reason === 'no_active_chat') {
              onError('当前没有进行中的回复，请直接发送新问题')
            } else {
              onError('补充说明未能送出，请稍后重试')
            }
          }
        } catch (e) {
          onError(e instanceof Error ? e.message : '补充说明未能送出')
        }
        return
      }
      const result = enqueueQueuedPrompt(sessionId, {
        text: msg,
        attachmentIds: ids,
        attachmentMetas,
      })
      syncPromptQueueUi(sessionId)
      if (!result.ok && result.reason === 'full') {
        onError('排队已满，请先处理或删除后再添加')
      }
      return
    }

    const pendingReset = streamResetTimersRef.current.get(sessionId)
    if (pendingReset != null) {
      window.clearTimeout(pendingReset)
      streamResetTimersRef.current.delete(sessionId)
    }

    const streamGen = (sessionStreamGenRef.current.get(sessionId) ?? 0) + 1
    sessionStreamGenRef.current.set(sessionId, streamGen)
    streamAwayDuringGenRef.current.set(sessionId, false)
    for (const key of [...doneNotifiedGensRef.current]) {
      if (key.startsWith(`${sessionId}:`)) doneNotifiedGensRef.current.delete(key)
    }
    // 新一轮默认自动续跑下一条；Stop / runNow 会在本轮中途覆盖
    drainIntentRef.current.set(sessionId, { kind: 'auto' })
    clearSessionWakeState(sessionId)
    clearSessionBackgroundJobs(sessionId)
    const initialSnapshot = createThinkingStreamSnapshot()
    streamCacheRef.current.set(sessionId, initialSnapshot)
    markSessionStreaming(sessionId, true)
    // 若发送时已不在前台，立即记为曾离开
    void markStreamingSessionsAwayIfNeeded()
    stoppingSessionsRef.current.delete(sessionId)
    if (activeIdRef.current === sessionId) {
      syncStreamSnapshotToUi(initialSnapshot, streamUiRef.current)
    }
    onError('')

    const optimistic: ChatDisplayMessage = {
      role: 'user',
      content: msg || '（附件）',
      at: new Date().toISOString(),
      ...(attachmentMetas?.length ? { attachments: attachmentMetas } : {}),
    }
    if (activeIdRef.current === sessionId) {
      setMessages(prev => [...prev, optimistic])
    }

    let resolvedSessionId = sessionId
    const abortController = new AbortController()
    streamHandlesRef.current.set(sessionId, { abortController, streamGen })

    const isStreamStale = () => streamGen !== (sessionStreamGenRef.current.get(sessionId) ?? 0)

    const applyFreshSession = async (sid: string): Promise<boolean> => {
      const fresh = await getSession(sid)
      if (isStreamStale()) return false
      if (activeIdRef.current === sid) {
        setActiveSessionMeta(fresh.session)
        setMessages(fresh.messages)
        setContextRef(fresh.contextRef ?? null)
        setSessionModelState(fresh.session.model)
        setSessionLlmParamsState(fresh.session.llmParams)
        if (fresh.contextUsage) {
          setContextUsage(fresh.contextUsage)
        } else {
          resetContextUsageForSession(sid)
        }
      }
      const list = await refreshSessions()
      if (isStreamStale()) return false
      setSessions(list)
      return true
    }

    try {
      let turnComplete = false
      let doneTitle: string | undefined
      await streamSessionChat(sessionId, msg, (event) => {
        pushStreamEvent(sessionId, event)
        if (event.type === 'done') {
          resolvedSessionId = event.session_id || resolvedSessionId
        }
        if (isChatTurnCompleteEvent(event)) {
          turnComplete = true
          if (event.type === 'done') {
            doneTitle = event.title
          }
        }
      }, sessionModelRef.current, abortController.signal, ids.length ? ids : undefined, (() => {
        const state = readPersistedCanvasState()
        const activeProposal = consumePendingAdjustProposal()
        return buildResearchCanvasAgentSnapshot({
          state,
          messages,
          activeProposal,
          activeWidgetId: getActiveWidgetId(),
        })
      })())

      if (!isStreamStale()) {
        const sid = resolvedSessionId
        if (sid !== sessionId && activeIdRef.current === sessionId) {
          activeIdRef.current = sid
          setActiveId(sid)
        }
        const applied = await applyFreshSession(sid)
        if (turnComplete && applied) {
          const completedGen = streamGen
          const sessionTitle = resolveSessionTitle(sid, doneTitle)
          afterNextPaint(() => {
            if ((sessionStreamGenRef.current.get(sessionId) ?? 0) !== completedGen) return
            maybeNotifyChatDone(sid, sessionTitle, completedGen)
          })
        }
      }
    } catch (e) {
      const aborted = (
        (e instanceof DOMException && e.name === 'AbortError')
        || (e instanceof Error && e.name === 'AbortError')
      )
      if (aborted) {
        try {
          await applyFreshSession(sessionId)
        } catch {
          /* keep current messages */
        }
      } else if (!isStreamStale()) {
        if (activeIdRef.current === sessionId) {
          onError(e instanceof Error ? e.message : '发送失败')
        }
        try {
          await applyFreshSession(sessionId)
        } catch {
          if (!isStreamStale() && activeIdRef.current === sessionId) {
            setMessages(prev => prev.slice(0, -1))
          }
        }
      }
    } finally {
      streamHandlesRef.current.delete(sessionId)
      stoppingSessionsRef.current.delete(sessionId)
      const hadPendingAsk = Boolean(streamCacheRef.current.get(sessionId)?.pendingUserPrompt)
      const pendingWake = pendingWakeRef.current.get(sessionId)
      markSessionStreaming(sessionId, false)
      if (pendingWake) {
        // 保留过程条，进入秒级倒计时（已到期则显示「正在继续」）
        startWakeCountdown(sessionId, pendingWake)
      } else {
        streamCacheRef.current.delete(sessionId)
        clearSessionWakeState(sessionId)
        if (activeIdRef.current === sessionId) {
          const prevTimer = streamResetTimersRef.current.get(sessionId)
          if (prevTimer != null) window.clearTimeout(prevTimer)
          const timer = window.setTimeout(() => {
            streamResetTimersRef.current.delete(sessionId)
            if (activeIdRef.current !== sessionId) return
            if (streamGen !== (sessionStreamGenRef.current.get(sessionId) ?? 0)) return
            if (streamingSessionIdsRef.current.has(sessionId)) return
            if (wakeWaitingSessionIdsRef.current.has(sessionId)) return
            streamUiRef.current?.resetStreamUi()
          }, 500)
          streamResetTimersRef.current.set(sessionId, timer)
        }
      }
      if (hadPendingAsk) {
        const intent = drainIntentRef.current.get(sessionId)
        if (!intent || intent.kind === 'auto') {
          drainIntentRef.current.set(sessionId, { kind: 'none' })
        }
      }
      drainPromptQueueAfterStream(sessionId)
    }
  }
}
