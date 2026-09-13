import { useMemo, useRef } from 'react'
import type { ChatEngineRefs, SubmitImpl } from './engineTypes'
import type { ChatStreamUiRef } from '../chatStreamUiBridge'
import type { DrainIntent } from '../sessionPromptQueue'
import type { SessionStreamSnapshot } from '../sessionStreamRuntime'

/**
 * 一次创建全部稳定引擎 ref（原 ChatAppShell 散落各处的 ref 逐字迁移）。
 * activeIdRef / viewRef 不在此创建：分别由 useSessionData / Shell 持有并注入。
 */
export function useEngineRefs(): ChatEngineRefs {
  const streamUiRef = useRef<ChatStreamUiRef['current']>(null)
  const streamCacheRef = useRef(new Map<string, SessionStreamSnapshot>())
  const streamHandlesRef = useRef(new Map<string, { abortController: AbortController; streamGen: number }>())
  const sessionStreamGenRef = useRef(new Map<string, number>())
  const stoppingSessionsRef = useRef(new Set<string>())
  const streamResetTimersRef = useRef(new Map<string, number>())
  const streamAwayDuringGenRef = useRef(new Map<string, boolean>())
  const doneNotifiedGensRef = useRef(new Set<string>())
  const notificationDeniedHintedRef = useRef(false)
  const drainIntentRef = useRef(new Map<string, DrainIntent>())
  const sessionModelRef = useRef<string | undefined>(undefined)
  const submitImplRef = useRef<SubmitImpl>(async () => {})
  const engineApiRef = useRef<{ abortSessionStream: (sessionId: string) => Promise<void> }>({
    abortSessionStream: async () => {},
  })

  return useMemo(() => ({
    streamUiRef,
    streamCacheRef,
    streamHandlesRef,
    sessionStreamGenRef,
    stoppingSessionsRef,
    streamResetTimersRef,
    streamAwayDuringGenRef,
    doneNotifiedGensRef,
    notificationDeniedHintedRef,
    drainIntentRef,
    sessionModelRef,
    submitImplRef,
    engineApiRef,
  }), [])
}
