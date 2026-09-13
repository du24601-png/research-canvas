import { useCallback, useRef } from 'react'
import type { MutableRefObject } from 'react'
import { fetchSessionPendingWakes } from '../../api/client'
import { syncStreamSnapshotToUi, type SessionStreamSnapshot } from '../sessionStreamRuntime'
import {
  decideAfterWakeExpiryFetch,
  formatWakeCountdownLabel,
  parsePendingWakesApi,
  secondsLeftUntil,
  type PendingWakeInfo,
} from '../turnWakeCountdown'
import type { ChatEngineRefs, WakeCountdownRefs } from './engineTypes'

/** schedule_turn_wake 空闲等待倒计时刷新间隔 */
const WAKE_COUNTDOWN_TICK_MS = 1000
/** 到期后若仍无 live progress，再查一次 pending-wakes 的安全窗 */
const WAKE_EXPIRY_SAFETY_MS = 45_000

export interface WakeCountdownPorts {
  activeIdRef: MutableRefObject<string | null>
  streamingSessionIdsRef: MutableRefObject<Set<string>>
  wakeWaitingSessionIdsRef: MutableRefObject<Set<string>>
  markSessionWakeWaiting: (sessionId: string, waiting: boolean) => void
}

/** schedule_turn_wake 唤醒倒计时状态机（原 ChatAppShell 唤醒 ref 束 + 倒计时段逐字迁移） */
export function useWakeCountdown(refs: ChatEngineRefs, ports: WakeCountdownPorts): WakeCountdownRefs & {
  clearSessionWakeState: (sessionId: string) => void
  startWakeCountdown: (sessionId: string, wake: PendingWakeInfo) => void
} {
  const { streamCacheRef, streamUiRef } = refs
  const {
    activeIdRef,
    streamingSessionIdsRef,
    wakeWaitingSessionIdsRef,
    markSessionWakeWaiting,
  } = ports
  /** schedule_turn_wake 到期前本地倒计时 */
  const pendingWakeRef = useRef(new Map<string, PendingWakeInfo>())
  const wakeCountdownTimersRef = useRef(new Map<string, number>())
  const wakeExpirySafetyTimersRef = useRef(new Map<string, number>())

  const stopWakeCountdown = useCallback((sessionId: string) => {
    const timer = wakeCountdownTimersRef.current.get(sessionId)
    if (timer != null) {
      window.clearInterval(timer)
      wakeCountdownTimersRef.current.delete(sessionId)
    }
  }, [])

  const clearWakeExpirySafety = useCallback((sessionId: string) => {
    const t = wakeExpirySafetyTimersRef.current.get(sessionId)
    if (t != null) {
      window.clearTimeout(t)
      wakeExpirySafetyTimersRef.current.delete(sessionId)
    }
  }, [])

  const clearSessionWakeState = useCallback((sessionId: string) => {
    pendingWakeRef.current.delete(sessionId)
    stopWakeCountdown(sessionId)
    clearWakeExpirySafety(sessionId)
    markSessionWakeWaiting(sessionId, false)
  }, [clearWakeExpirySafety, markSessionWakeWaiting, stopWakeCountdown])

  const applyWakeCountdownSnapshot = useCallback((sessionId: string, fireAt: string) => {
    const left = secondsLeftUntil(fireAt)
    const phaseLabel = left > 0 ? formatWakeCountdownLabel(left) : '正在继续'
    const prev = streamCacheRef.current.get(sessionId)
    const next: SessionStreamSnapshot = {
      liveTrace: {
        steps: prev?.liveTrace?.steps ?? [],
        phaseLabel,
        thinkingLabel: `${phaseLabel}…`,
      },
      pendingUserPrompt: null,
      userPromptSubmitting: false,
      contextHint: prev?.contextHint ?? null,
    }
    streamCacheRef.current.set(sessionId, next)
    if (activeIdRef.current === sessionId) {
      syncStreamSnapshotToUi(next, streamUiRef.current)
    }
  }, [activeIdRef, streamCacheRef, streamUiRef])

  const startWakeCountdown = useCallback((sessionId: string, wake: PendingWakeInfo) => {
    pendingWakeRef.current.set(sessionId, wake)
    markSessionWakeWaiting(sessionId, true)
    applyWakeCountdownSnapshot(sessionId, wake.fireAt)
    stopWakeCountdown(sessionId)
    clearWakeExpirySafety(sessionId)

    const handleExpiry = () => {
      stopWakeCountdown(sessionId)
      applyWakeCountdownSnapshot(sessionId, wake.fireAt)
      void fetchSessionPendingWakes(sessionId).then((data) => {
        const decision = decideAfterWakeExpiryFetch(parsePendingWakesApi(data))
        if (decision.kind === 'restart') {
          startWakeCountdown(sessionId, decision.wake)
          return
        }
        // 等 live-progress；45s 后再查一次 pending
        const safety = window.setTimeout(() => {
          wakeExpirySafetyTimersRef.current.delete(sessionId)
          if (streamingSessionIdsRef.current.has(sessionId)) return
          if (!wakeWaitingSessionIdsRef.current.has(sessionId)) return
          void fetchSessionPendingWakes(sessionId).then((again) => {
            const next = decideAfterWakeExpiryFetch(parsePendingWakesApi(again))
            if (next.kind === 'restart') startWakeCountdown(sessionId, next.wake)
          }).catch(() => { /* ignore */ })
        }, WAKE_EXPIRY_SAFETY_MS)
        wakeExpirySafetyTimersRef.current.set(sessionId, safety)
      }).catch(() => { /* ignore */ })
    }

    if (secondsLeftUntil(wake.fireAt) <= 0) {
      handleExpiry()
      return
    }

    const timer = window.setInterval(() => {
      const current = pendingWakeRef.current.get(sessionId)
      if (!current) {
        stopWakeCountdown(sessionId)
        return
      }
      applyWakeCountdownSnapshot(sessionId, current.fireAt)
      if (secondsLeftUntil(current.fireAt) <= 0) {
        handleExpiry()
      }
    }, WAKE_COUNTDOWN_TICK_MS)
    wakeCountdownTimersRef.current.set(sessionId, timer)
  }, [
    applyWakeCountdownSnapshot,
    clearWakeExpirySafety,
    markSessionWakeWaiting,
    pendingWakeRef,
    stopWakeCountdown,
    streamingSessionIdsRef,
    wakeCountdownTimersRef,
    wakeExpirySafetyTimersRef,
    wakeWaitingSessionIdsRef,
  ])

  return {
    pendingWakeRef,
    wakeCountdownTimersRef,
    wakeExpirySafetyTimersRef,
    clearSessionWakeState,
    startWakeCountdown,
  }
}
