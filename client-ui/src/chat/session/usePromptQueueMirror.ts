import { useCallback, useEffect, useState } from 'react'
import type { MutableRefObject } from 'react'
import {
  listQueuedPrompts,
  promoteQueuedPrompt,
  removeQueuedPrompt,
  resolveDrainAction,
  shiftQueuedPrompt,
  takeQueuedPromptById,
  type QueuedPrompt,
} from '../sessionPromptQueue'
import type { ChatEngineRefs } from './engineTypes'

export interface PromptQueueMirrorPorts {
  refs: ChatEngineRefs
  activeId: string | null
  activeIdRef: MutableRefObject<string | null>
  streamingSessionIdsRef: MutableRefObject<Set<string>>
}

/**
 * 排队提示（localStorage 镜像）+ drain 状态机（原 ChatAppShell 排队段逐字迁移）。
 * drain / runNow 经共享 submitImplRef 调用发送；中断经 engineApiRef（render 期由 submit 域回填）。
 */
export function usePromptQueueMirror(ports: PromptQueueMirrorPorts) {
  const { refs, activeId, activeIdRef, streamingSessionIdsRef } = ports
  const {
    streamCacheRef,
    streamHandlesRef,
    streamUiRef,
    drainIntentRef,
    submitImplRef,
    engineApiRef,
  } = refs

  /** 当前会话排队提示（localStorage 镜像） */
  const [promptQueue, setPromptQueue] = useState<QueuedPrompt[]>([])

  const syncPromptQueueUi = useCallback((sessionId: string | null) => {
    if (!sessionId) {
      setPromptQueue([])
      return
    }
    if (activeIdRef.current === sessionId) {
      setPromptQueue(listQueuedPrompts(sessionId))
    }
  }, [activeIdRef])

  useEffect(() => {
    syncPromptQueueUi(activeId)
  }, [activeId, syncPromptQueueUi])

  const drainPromptQueueAfterStream = useCallback((sessionId: string) => {
    const intent = drainIntentRef.current.get(sessionId) ?? { kind: 'auto' }
    drainIntentRef.current.delete(sessionId)

    const pendingAsk = Boolean(streamCacheRef.current.get(sessionId)?.pendingUserPrompt)
    const decision = resolveDrainAction(intent, {
      hasPendingUserPrompt: pendingAsk,
      alreadyStreaming: streamingSessionIdsRef.current.has(sessionId)
        || streamHandlesRef.current.has(sessionId),
    })
    if (decision.action === 'skip') {
      syncPromptQueueUi(sessionId)
      return
    }

    let next: QueuedPrompt | null = null
    if (decision.action === 'take') {
      next = takeQueuedPromptById(sessionId, decision.itemId).item
    } else {
      next = shiftQueuedPrompt(sessionId).item
    }
    syncPromptQueueUi(sessionId)
    if (!next) return

    // 微任务：确保本流 finally 的 streaming 清理已完成
    queueMicrotask(() => {
      if (streamingSessionIdsRef.current.has(sessionId)) return
      void submitImplRef.current(
        next.text || undefined,
        next.attachmentIds,
        next.attachmentMetas,
      )
    })
  }, [drainIntentRef, streamCacheRef, streamHandlesRef, streamingSessionIdsRef, submitImplRef, syncPromptQueueUi])

  const handlePromptQueueRemove = useCallback((id: string) => {
    const sid = activeIdRef.current
    if (!sid) return
    removeQueuedPrompt(sid, id)
    syncPromptQueueUi(sid)
  }, [activeIdRef, syncPromptQueueUi])

  const handlePromptQueueRunNow = useCallback((id: string) => {
    const sid = activeIdRef.current
    if (!sid) return
    const pendingAsk = Boolean(streamCacheRef.current.get(sid)?.pendingUserPrompt)
      || Boolean(streamUiRef.current?.readPendingUserPrompt?.())
    if (pendingAsk) return

    if (!streamingSessionIdsRef.current.has(sid)) {
      const { item } = takeQueuedPromptById(sid, id)
      syncPromptQueueUi(sid)
      if (!item) return
      void submitImplRef.current(item.text || undefined, item.attachmentIds, item.attachmentMetas)
      return
    }

    promoteQueuedPrompt(sid, id)
    syncPromptQueueUi(sid)
    drainIntentRef.current.set(sid, { kind: 'runItem', itemId: id })
    void engineApiRef.current.abortSessionStream(sid)
  }, [activeIdRef, drainIntentRef, engineApiRef, streamCacheRef, streamingSessionIdsRef, streamUiRef, submitImplRef, syncPromptQueueUi])

  return {
    promptQueue,
    syncPromptQueueUi,
    drainPromptQueueAfterStream,
    handlePromptQueueRemove,
    handlePromptQueueRunNow,
  }
}
