import { useCallback } from 'react'
import type { MutableRefObject } from 'react'
import type { AppRoute } from '../../hooks/useAppNavigation'
import type { SessionMeta } from '../../types/chat'
import { isElectron } from '../../platform/detect'
import {
  buildChatDoneNotification,
  isAwayFromForeground,
  maybeShowChatLocalNotification,
  resolveWindowFocused,
} from '../../platform/chatNotifications'
import { playChatCueSound } from '../../platform/chatSound'
import type { ChatEngineRefs, EngineErrorPort } from './engineTypes'

export interface StreamNotificationsPorts {
  activeIdRef: MutableRefObject<string | null>
  viewRef: MutableRefObject<AppRoute>
  onError: EngineErrorPort
  sessionsRef: MutableRefObject<SessionMeta[]>
  activeSessionMetaRef: MutableRefObject<SessionMeta | null>
  streamingSessionIdsRef: MutableRefObject<Set<string>>
}

/** 完成/提问本地通知 + 离焦追踪 + 提示音（原 ChatAppShell 通知段逐字迁移） */
export function useStreamNotifications(refs: ChatEngineRefs, ports: StreamNotificationsPorts) {
  const {
    sessionStreamGenRef,
    streamAwayDuringGenRef,
    doneNotifiedGensRef,
    notificationDeniedHintedRef,
  } = refs
  const {
    activeIdRef,
    viewRef,
    onError,
    sessionsRef,
    activeSessionMetaRef,
    streamingSessionIdsRef,
  } = ports

  const resolveSessionTitle = useCallback((targetSessionId: string, eventTitle?: string) => {
    return eventTitle
      ?? (activeSessionMetaRef.current?.id === targetSessionId
        ? activeSessionMetaRef.current.title
        : undefined)
      ?? sessionsRef.current.find(s => s.id === targetSessionId)?.title
  }, [activeSessionMetaRef, sessionsRef])

  const handleNotificationResult = useCallback((result: 'skipped' | 'shown' | 'denied' | 'failed') => {
    if (result !== 'denied' || notificationDeniedHintedRef.current) return
    notificationDeniedHintedRef.current = true
    onError(
      isElectron()
        ? '桌面通知未开启。可在系统设置中允许本应用发送通知，以免错过对话完成提醒。'
        : '浏览器通知未开启。可在地址栏旁允许通知，离开对话时也能及时收到完成提醒。',
    )
  }, [notificationDeniedHintedRef, onError])

  const maybeNotifyChatDone = useCallback((
    targetSessionId: string,
    sessionTitle?: string,
    streamGen?: number,
  ) => {
    const gen = streamGen ?? sessionStreamGenRef.current.get(targetSessionId) ?? 0
    const dedupeKey = `${targetSessionId}:${gen}`
    if (doneNotifiedGensRef.current.has(dedupeKey)) return
    doneNotifiedGensRef.current.add(dedupeKey)
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
          awayDuringGeneration: streamAwayDuringGenRef.current.get(targetSessionId) === true,
        },
        buildChatDoneNotification(targetSessionId, sessionTitle),
      )
      handleNotificationResult(result)
    })()
  }, [activeIdRef, doneNotifiedGensRef, handleNotificationResult, sessionStreamGenRef, streamAwayDuringGenRef, viewRef])

  const markStreamingSessionsAwayIfNeeded = useCallback(async () => {
    if (streamingSessionIdsRef.current.size === 0) return
    const documentVisible = typeof document !== 'undefined'
      && document.visibilityState === 'visible'
    const windowFocused = await resolveWindowFocused()
    if (!isAwayFromForeground({ documentVisible, windowFocused })) return
    for (const sessionId of streamingSessionIdsRef.current) {
      streamAwayDuringGenRef.current.set(sessionId, true)
    }
  }, [streamAwayDuringGenRef, streamingSessionIdsRef])

  return {
    resolveSessionTitle,
    handleNotificationResult,
    maybeNotifyChatDone,
    markStreamingSessionsAwayIfNeeded,
  }
}
