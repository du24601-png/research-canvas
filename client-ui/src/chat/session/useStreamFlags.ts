import { useCallback, useRef, useState } from 'react'
import type { StreamFlags } from './engineTypes'

/**
 * 流双轨标记：state（驱动渲染）+ ref（事件期同步读写）。
 * markSessionStreaming / markSessionWakeWaiting 必须在同一模块内同步写两轨（原语义逐字迁移）。
 */
export function useStreamFlags(): StreamFlags {
  const [streamingSessionIds, setStreamingSessionIds] = useState<string[]>([])
  const [wakeWaitingSessionIds, setWakeWaitingSessionIds] = useState<string[]>([])
  const streamingSessionIdsRef = useRef(new Set<string>())
  const wakeWaitingSessionIdsRef = useRef(new Set<string>())

  const markSessionStreaming = useCallback((sessionId: string, streaming: boolean) => {
    if (streaming) streamingSessionIdsRef.current.add(sessionId)
    else streamingSessionIdsRef.current.delete(sessionId)
    setStreamingSessionIds(Array.from(streamingSessionIdsRef.current))
  }, [])

  const markSessionWakeWaiting = useCallback((sessionId: string, waiting: boolean) => {
    if (waiting) wakeWaitingSessionIdsRef.current.add(sessionId)
    else wakeWaitingSessionIdsRef.current.delete(sessionId)
    setWakeWaitingSessionIds(Array.from(wakeWaitingSessionIdsRef.current))
  }, [])

  return {
    streamingSessionIds,
    wakeWaitingSessionIds,
    streamingSessionIdsRef,
    wakeWaitingSessionIdsRef,
    markSessionStreaming,
    markSessionWakeWaiting,
  }
}
