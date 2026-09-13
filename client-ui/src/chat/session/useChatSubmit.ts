import { useCallback } from 'react'
import { cancelSessionChat, listSessionSubagents } from '../../api/client'
import type { ChatAttachmentMeta } from '../../types/chat'
import {
  isActiveCollaborationStatus,
  mergeCollaborationTasksFromApi,
} from '../sessionCollaborationTasks'
import type { ChatEngineRefs, ChatSubmitPorts, StreamFlags } from './engineTypes'

/** 中断 / 停止 / 提交入口（原 ChatAppShell 段逐字迁移；先 bump gen 再 abort 语义保留） */
export function useChatSubmit(refs: ChatEngineRefs, flags: StreamFlags, ports: ChatSubmitPorts) {
  const {
    sessionStreamGenRef,
    stoppingSessionsRef,
    streamHandlesRef,
    drainIntentRef,
    submitImplRef,
    engineApiRef,
  } = refs
  const { streamingSessionIdsRef } = flags
  const {
    activeId,
    clearSessionWakeState,
    collaborationTasksBySession,
    patchSessionCollaborationTasks,
  } = ports

  const abortSessionStream = useCallback(async (sessionId: string) => {
    sessionStreamGenRef.current.set(
      sessionId,
      (sessionStreamGenRef.current.get(sessionId) ?? 0) + 1,
    )
    stoppingSessionsRef.current.add(sessionId)
    clearSessionWakeState(sessionId)
    streamHandlesRef.current.get(sessionId)?.abortController.abort()
    try {
      await cancelSessionChat(sessionId)
    } catch {
      /* stream may have already ended */
    }
  }, [clearSessionWakeState, sessionStreamGenRef, stoppingSessionsRef, streamHandlesRef])

  const handleStop = useCallback(async () => {
    const sid = activeId
    if (!sid || stoppingSessionsRef.current.has(sid)) return
    const hasActiveCollab = (collaborationTasksBySession[sid] ?? []).some(
      (t) => isActiveCollaborationStatus(t.status),
    )
    const wasStreaming = streamingSessionIdsRef.current.has(sid)
    // 父未 streaming 但有后台协作任务时仍须 cancel
    if (!wasStreaming && !hasActiveCollab) return
    drainIntentRef.current.set(sid, { kind: 'none' })
    await abortSessionStream(sid)
    if (!wasStreaming) {
      // 无父流时 abort 不会走 stream finally，须手动清 stopping 标记
      stoppingSessionsRef.current.delete(sid)
    }
    try {
      const sub = await listSessionSubagents(sid)
      patchSessionCollaborationTasks(sid, (prev) =>
        mergeCollaborationTasksFromApi(prev, sub.runs),
      )
    } catch {
      /* ignore */
    }
  }, [abortSessionStream, activeId, collaborationTasksBySession, drainIntentRef, patchSessionCollaborationTasks, stoppingSessionsRef, streamingSessionIdsRef])

  // render 期回填：queue 域的 runNow / drain 经共享 ref 晚绑调用（与 submitImplRef 同模式）
  engineApiRef.current.abortSessionStream = abortSessionStream

  const handleSubmit = useCallback((text?: string, attachmentIds?: string[], attachmentMetas?: ChatAttachmentMeta[]) => {
    void submitImplRef.current(text, attachmentIds, attachmentMetas)
  }, [submitImplRef])

  return { abortSessionStream, handleStop, handleSubmit }
}
