import { useEffect } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import {
  fetchSessionPendingWakes, getSession, listSessionSubagents, subscribeSessionLiveProgress,
} from '../../api/client'
import type { ChatProgressEvent } from '../../types/chatProgress'
import type {
  ChatContextUsage, ChatDisplayMessage, SessionContextRef, SessionLlmParams, SessionMeta,
} from '../../types/chat'
import { afterNextPaint } from '../workspace/sessionArtifact'
import { createThinkingStreamSnapshot } from '../sessionStreamRuntime'
import {
  mergeCollaborationTasksFromApi,
  type SessionCollaborationTask,
} from '../sessionCollaborationTasks'
import { hydrateBackgroundJobsFromWatches, parsePendingJobWatchesApi, type SessionBackgroundJob } from '../jobWatchProgress'
import { isChatTurnCompleteEvent } from '../../platform/chatNotifications'
import {
  parsePendingWakesApi,
  secondsLeftUntil,
  type PendingWakeInfo,
} from '../turnWakeCountdown'
import type { ChatEngineRefs, StreamFlags } from './engineTypes'

export interface LiveProgressFeedPorts {
  activeId: string | null
  activeIdRef: MutableRefObject<string | null>
  setActiveSessionMeta: Dispatch<SetStateAction<SessionMeta | null>>
  setMessages: Dispatch<SetStateAction<ChatDisplayMessage[]>>
  setContextRef: Dispatch<SetStateAction<SessionContextRef | null>>
  setSessionModelState: Dispatch<SetStateAction<string | undefined>>
  setSessionLlmParamsState: Dispatch<SetStateAction<SessionLlmParams | undefined>>
  setContextUsage: Dispatch<SetStateAction<ChatContextUsage | null>>
  resetContextUsageForSession: (sessionId: string | null) => void
  refreshSessions: () => Promise<SessionMeta[]>
  applyBackgroundJobProgressEvent: (targetSessionId: string, event: ChatProgressEvent) => void
  patchSessionBackgroundJobs: (
    sessionId: string,
    updater: (prev: SessionBackgroundJob[]) => SessionBackgroundJob[],
  ) => void
  patchSessionCollaborationTasks: (
    sessionId: string,
    updater: (prev: SessionCollaborationTask[]) => SessionCollaborationTask[],
  ) => void
  clearSessionWakeState: (sessionId: string) => void
  startWakeCountdown: (sessionId: string, wake: PendingWakeInfo) => void
  pendingWakeRef: MutableRefObject<Map<string, PendingWakeInfo>>
  resolveSessionTitle: (targetSessionId: string, eventTitle?: string) => string | undefined
  maybeNotifyChatDone: (targetSessionId: string, sessionTitle?: string, streamGen?: number) => void
  pushStreamEvent: (targetSessionId: string, event: ChatProgressEvent) => void
}

/**
 * 活动会话 live-progress SSE 总线（原 ChatAppShell 订阅效应逐字迁移）。
 * 与 stream 的互斥（streamHandlesRef.current.has(sessionId)）依赖共享同一 refs 束与 router 实例。
 */
export function useLiveProgressFeed(refs: ChatEngineRefs, flags: StreamFlags, ports: LiveProgressFeedPorts) {
  const {
    streamUiRef,
    streamCacheRef,
    streamHandlesRef,
    sessionStreamGenRef,
  } = refs
  const {
    streamingSessionIdsRef,
    wakeWaitingSessionIdsRef,
    markSessionStreaming,
  } = flags
  const {
    activeId,
    activeIdRef,
    setActiveSessionMeta,
    setMessages,
    setContextRef,
    setSessionModelState,
    setSessionLlmParamsState,
    setContextUsage,
    resetContextUsageForSession,
    refreshSessions,
    applyBackgroundJobProgressEvent,
    patchSessionBackgroundJobs,
    patchSessionCollaborationTasks,
    clearSessionWakeState,
    startWakeCountdown,
    pendingWakeRef,
    resolveSessionTitle,
    maybeNotifyChatDone,
    pushStreamEvent,
  } = ports

  // 订阅 live-progress：wake 到期续跑的 thinking/tool/done 推到同一会话 UI
  useEffect(() => {
    if (!activeId) return
    const sessionId = activeId
    const ac = new AbortController()
    let cancelled = false

    const finishWakeResume = async (sid: string, event: ChatProgressEvent) => {
      const completedGen = sessionStreamGenRef.current.get(sid) ?? 0
      const shouldNotifyDone = isChatTurnCompleteEvent(event)
      const sessionTitle = event.type === 'done'
        ? resolveSessionTitle(sid, event.title)
        : resolveSessionTitle(sid)
      const pendingWake = pendingWakeRef.current.get(sid)
      markSessionStreaming(sid, false)
      if (pendingWake) {
        startWakeCountdown(sid, pendingWake)
      } else {
        clearSessionWakeState(sid)
        streamCacheRef.current.delete(sid)
      }
      try {
        const fresh = await getSession(sid)
        if (!cancelled && activeIdRef.current === sid) {
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
        if (shouldNotifyDone) {
          afterNextPaint(() => {
            if ((sessionStreamGenRef.current.get(sid) ?? 0) !== completedGen) return
            maybeNotifyChatDone(sid, sessionTitle, completedGen)
          })
        }
        if (!cancelled) {
          await refreshSessions()
        }
      } catch {
        /* keep current */
      }
      if (activeIdRef.current === sid && !streamingSessionIdsRef.current.has(sid)) {
        window.setTimeout(() => {
          if (activeIdRef.current !== sid) return
          if (streamingSessionIdsRef.current.has(sid)) return
          if (wakeWaitingSessionIdsRef.current.has(sid)) return
          streamUiRef.current?.resetStreamUi()
        }, 500)
      }
    }

    const onLiveEvent = (event: ChatProgressEvent) => {
      // 用户本轮已在 chat/stream 中：过程条由 stream 接管；Job 状态条仍吃 bus，避免丢进度
      if (streamHandlesRef.current.has(sessionId)) {
        if (event.type === 'job_watch' || event.type === 'job_progress') {
          applyBackgroundJobProgressEvent(sessionId, event)
        }
        return
      }

      const progressive =
        event.type === 'thinking'
        || event.type === 'tool_start'
        || event.type === 'tool_done'
        || event.type === 'reply'
        || event.type === 'context_compact'
        || event.type === 'user_prompt'
        || event.type === 'steer_applied'

      if (progressive && !streamingSessionIdsRef.current.has(sessionId)) {
        clearSessionWakeState(sessionId)
        const gen = (sessionStreamGenRef.current.get(sessionId) ?? 0) + 1
        sessionStreamGenRef.current.set(sessionId, gen)
        streamCacheRef.current.set(sessionId, createThinkingStreamSnapshot('正在继续…'))
        markSessionStreaming(sessionId, true)
      }

      pushStreamEvent(sessionId, event)

      if (event.type === 'done' || event.type === 'error') {
        void finishWakeResume(sessionId, event)
      }
    }

    void (async () => {
      try {
        const data = await fetchSessionPendingWakes(sessionId)
        if (cancelled) return
        const watches = parsePendingJobWatchesApi(data)
        patchSessionBackgroundJobs(sessionId, () => hydrateBackgroundJobsFromWatches(watches))
        try {
          const sub = await listSessionSubagents(sessionId)
          if (!cancelled) {
            patchSessionCollaborationTasks(sessionId, (prev) =>
              mergeCollaborationTasksFromApi(prev, sub.runs),
            )
          }
        } catch {
          /* ignore */
        }
        const wake = parsePendingWakesApi(data)[0]
        if (
          wake
          && secondsLeftUntil(wake.fireAt) > 0
          && !streamingSessionIdsRef.current.has(sessionId)
        ) {
          startWakeCountdown(sessionId, wake)
        }
      } catch {
        /* ignore */
      }

      while (!cancelled && !ac.signal.aborted) {
        try {
          await subscribeSessionLiveProgress(sessionId, onLiveEvent, ac.signal)
          break
        } catch (e) {
          const aborted = (
            (e instanceof DOMException && e.name === 'AbortError')
            || (e instanceof Error && e.name === 'AbortError')
          )
          if (aborted || cancelled) break
          await new Promise(r => setTimeout(r, 1500))
        }
      }
    })()

    return () => {
      cancelled = true
      ac.abort()
    }
  }, [
    activeId,
    activeIdRef,
    applyBackgroundJobProgressEvent,
    clearSessionWakeState,
    markSessionStreaming,
    maybeNotifyChatDone,
    patchSessionBackgroundJobs,
    patchSessionCollaborationTasks,
    pendingWakeRef,
    pushStreamEvent,
    refreshSessions,
    resetContextUsageForSession,
    resolveSessionTitle,
    setActiveSessionMeta,
    setContextRef,
    setContextUsage,
    setMessages,
    setSessionLlmParamsState,
    setSessionModelState,
    startWakeCountdown,
    streamCacheRef,
    streamHandlesRef,
    streamingSessionIdsRef,
    sessionStreamGenRef,
    streamUiRef,
    wakeWaitingSessionIdsRef,
  ])
}
