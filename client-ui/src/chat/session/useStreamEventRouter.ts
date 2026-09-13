import { useCallback } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { AppRoute } from '../../hooks/useAppNavigation'
import type { ChatProgressEvent } from '../../types/chatProgress'
import type { ChatContextUsage } from '../../types/chat'
import type { CollaborationViewTab } from '../SessionCollaborationTabs'
import { parseChildProgressRelay } from '../collaborationChildLiveTrace'
import {
  applyChatProgressEvent,
  createThinkingStreamSnapshot,
  syncStreamSnapshotToUi,
  type SessionStreamSnapshot,
} from '../sessionStreamRuntime'
import { parseScheduleTurnWakeFromStep, type PendingWakeInfo } from '../turnWakeCountdown'
import { publishResearchCanvasEvent } from '../research-canvas/researchCanvasBus'
import { applySubagentProgressToTasks, type SessionCollaborationTask } from '../sessionCollaborationTasks'
import {
  buildChatAskNotification,
  maybeShowChatLocalNotification,
  resolveWindowFocused,
} from '../../platform/chatNotifications'
import { playChatCueSound } from '../../platform/chatSound'
import type { ChatEngineRefs } from './engineTypes'

export interface StreamEventRouterPorts {
  streamingSessionIds: string[]
  wakeWaitingSessionIds: string[]
  streamingSessionIdsRef: MutableRefObject<Set<string>>
  wakeWaitingSessionIdsRef: MutableRefObject<Set<string>>
  pendingWakeRef: MutableRefObject<Map<string, PendingWakeInfo>>
  applyBackgroundJobProgressEvent: (targetSessionId: string, event: ChatProgressEvent) => void
  patchSessionCollaborationTasks: (
    sessionId: string,
    updater: (prev: SessionCollaborationTask[]) => SessionCollaborationTask[],
  ) => void
  bumpChildLiveTrace: (runId: string, inner: ChatProgressEvent) => void
  clearChildLiveTrace: (runId: string) => void
  collaborationViewTabRef: MutableRefObject<CollaborationViewTab>
  setChildLiveTraceVersion: Dispatch<SetStateAction<number>>
  handleNotificationResult: (result: 'skipped' | 'shown' | 'denied' | 'failed') => void
  activeIdRef: MutableRefObject<string | null>
  viewRef: MutableRefObject<AppRoute>
  setContextHintBanner: (message: string) => void
  setContextUsage: Dispatch<SetStateAction<ChatContextUsage | null>>
}

/** 流事件路由：pushStreamEvent + 快照解析 + 待答问题清除（原 ChatAppShell 段逐字迁移） */
export function useStreamEventRouter(refs: ChatEngineRefs, ports: StreamEventRouterPorts) {
  const { streamCacheRef, streamUiRef } = refs
  const {
    streamingSessionIds,
    wakeWaitingSessionIds,
    streamingSessionIdsRef,
    wakeWaitingSessionIdsRef,
    pendingWakeRef,
    applyBackgroundJobProgressEvent,
    patchSessionCollaborationTasks,
    bumpChildLiveTrace,
    clearChildLiveTrace,
    collaborationViewTabRef,
    setChildLiveTraceVersion,
    handleNotificationResult,
    activeIdRef,
    viewRef,
    setContextHintBanner,
    setContextUsage,
  } = ports

  const pushStreamEvent = useCallback((targetSessionId: string, event: ChatProgressEvent) => {
    const childRelay = parseChildProgressRelay(event)
    if (childRelay && event.type !== 'subagent_child_progress') {
      bumpChildLiveTrace(childRelay.runId, childRelay.inner)
    }

    const prev = streamCacheRef.current.get(targetSessionId) ?? createThinkingStreamSnapshot()
    const next = applyChatProgressEvent(prev, event)
    streamCacheRef.current.set(targetSessionId, next)

    if (
      event.type === 'subagent_child_progress'
      || next.collaborationTraces !== prev.collaborationTraces
    ) {
      const runId = event.type === 'subagent_child_progress'
        ? (typeof event.run_id === 'string' ? event.run_id.trim() : '')
        : ''
      const touchedRunId = runId
        || (childRelay?.runId ?? '')
        || Object.keys(next.collaborationTraces ?? {}).find(
          (k) => next.collaborationTraces?.[k] !== prev.collaborationTraces?.[k],
        )
        || ''
      if (touchedRunId && collaborationViewTabRef.current === touchedRunId) {
        setChildLiveTraceVersion((v) => v + 1)
      }
    }

    if (event.type === 'research_canvas') {
      publishResearchCanvasEvent(event.event)
    }
    if (event.type === 'tool_done') {
      const wake = parseScheduleTurnWakeFromStep(event.step)
      if (wake) pendingWakeRef.current.set(targetSessionId, wake)
    }
    if (event.type === 'job_watch' || event.type === 'job_progress') {
      applyBackgroundJobProgressEvent(targetSessionId, event)
    }
    if (
      event.type === 'subagent_started'
      || event.type === 'subagent_progress'
      || event.type === 'subagent_done'
    ) {
      patchSessionCollaborationTasks(targetSessionId, (list) =>
        applySubagentProgressToTasks(list, event),
      )
      if (event.type === 'subagent_done') {
        const runId = typeof event.run_id === 'string' ? event.run_id.trim() : ''
        if (runId) clearChildLiveTrace(runId)
      }
    }
    if (event.type === 'done' && Array.isArray(event.tool_steps)) {
      for (const step of event.tool_steps) {
        const wake = parseScheduleTurnWakeFromStep(step)
        if (wake) {
          pendingWakeRef.current.set(targetSessionId, wake)
          break
        }
      }
    }

    if (activeIdRef.current === targetSessionId) {
      syncStreamSnapshotToUi(next, streamUiRef.current)
      if (event.type === 'context_compact' && next.contextHint) {
        setContextHintBanner(next.contextHint)
      }
      if (event.type === 'done' && event.context_usage) {
        setContextUsage(event.context_usage)
      }
    }

    if (event.type === 'user_prompt') {
      const promptSummary = event.prompt.title || event.prompt.prompt
      playChatCueSound()
      void (async () => {
        const documentVisible = typeof document !== 'undefined'
          && document.visibilityState === 'visible'
        const windowFocused = await resolveWindowFocused()
        const result = await maybeShowChatLocalNotification(
          targetSessionId,
          {
            activeSessionId: activeIdRef.current,
            view: viewRef.current,
            documentVisible,
            windowFocused,
          },
          buildChatAskNotification(targetSessionId, promptSummary),
        )
        handleNotificationResult(result)
      })()
    }
  }, [
    activeIdRef,
    applyBackgroundJobProgressEvent,
    bumpChildLiveTrace,
    clearChildLiveTrace,
    collaborationViewTabRef,
    handleNotificationResult,
    patchSessionCollaborationTasks,
    pendingWakeRef,
    setChildLiveTraceVersion,
    setContextHintBanner,
    setContextUsage,
    streamCacheRef,
    streamUiRef,
    viewRef,
  ])

  // 依赖数组故意含 streamingSessionIds / wakeWaitingSessionIds（行为：驱动 memo 化 ChatView
  // 重渲染使过程条出现；函数体只读 ref），不得改为 []
  const resolveStreamSnapshot = useCallback((id: string | null) => {
    if (!id) return null
    if (
      !streamingSessionIdsRef.current.has(id)
      && !wakeWaitingSessionIdsRef.current.has(id)
    ) return null
    return streamCacheRef.current.get(id) ?? createThinkingStreamSnapshot()
  }, [streamCacheRef, streamingSessionIds, streamingSessionIdsRef, wakeWaitingSessionIds, wakeWaitingSessionIdsRef])

  const clearPendingUserPrompt = useCallback((sessionId: string | null) => {
    if (!sessionId || !streamingSessionIdsRef.current.has(sessionId)) return
    const prev = streamCacheRef.current.get(sessionId)
    if (!prev?.pendingUserPrompt) return
    const next: SessionStreamSnapshot = { ...prev, pendingUserPrompt: null }
    streamCacheRef.current.set(sessionId, next)
    if (activeIdRef.current === sessionId) {
      syncStreamSnapshotToUi(next, streamUiRef.current)
    }
  }, [activeIdRef, streamCacheRef, streamUiRef, streamingSessionIdsRef])

  return {
    pushStreamEvent,
    resolveStreamSnapshot,
    clearPendingUserPrompt,
  }
}
