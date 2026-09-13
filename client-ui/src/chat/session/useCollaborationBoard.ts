import { useCallback, useMemo, useState } from 'react'
import { cancelSessionSubagent } from '../../api/client'
import {
  applySubagentProgressToTasks,
  dismissCollaborationTask,
  shouldShowCollaborationTask,
  sortCollaborationTasksForTabs,
  type SessionCollaborationTask,
} from '../sessionCollaborationTasks'

export interface CollaborationBoardPorts {
  activeId: string | null
}

/** 协作任务看板（原 ChatAppShell collaborationTasks 全簇逐字迁移） */
export function useCollaborationBoard(ports: CollaborationBoardPorts) {
  const { activeId } = ports
  const [collaborationTasksBySession, setCollaborationTasksBySession] = useState<
    Record<string, SessionCollaborationTask[]>
  >({})
  const sessionCollaborationTasks = activeId
    ? (collaborationTasksBySession[activeId] ?? [])
    : []
  const visibleCollaborationTasks = useMemo(
    () => sortCollaborationTasksForTabs(
      sessionCollaborationTasks.filter(shouldShowCollaborationTask),
    ),
    [sessionCollaborationTasks],
  )

  const patchSessionCollaborationTasks = useCallback((
    sessionId: string,
    updater: (prev: SessionCollaborationTask[]) => SessionCollaborationTask[],
  ) => {
    const sid = String(sessionId ?? '').trim()
    if (!sid) return
    setCollaborationTasksBySession((prev) => {
      const nextList = updater(prev[sid] ?? [])
      if (nextList.length === 0) {
        if (!(sid in prev)) return prev
        const { [sid]: _removed, ...rest } = prev
        return rest
      }
      return { ...prev, [sid]: nextList }
    })
  }, [])

  const clearSessionCollaborationTasks = useCallback((sessionId: string) => {
    const sid = String(sessionId ?? '').trim()
    if (!sid) return
    setCollaborationTasksBySession((prev) => {
      if (!(sid in prev)) return prev
      const { [sid]: _removed, ...rest } = prev
      return rest
    })
  }, [])

  const handleCancelCollaborationTask = useCallback(async (runId: string) => {
    const sid = activeId?.trim() ?? ''
    const rid = runId.trim()
    if (!sid || !rid) {
      return { ok: false, error: '暂时无法结束该协作任务，请稍后重试' }
    }
    const res = await cancelSessionSubagent(sid, rid)
    if (res.ok) {
      patchSessionCollaborationTasks(sid, (list) => {
        const prev = list.find((t) => t.runId === rid)
        return applySubagentProgressToTasks(list, {
          type: 'subagent_done',
          run_id: rid,
          label: prev?.label ?? '协作任务',
          status: res.status ?? 'cancelled',
          summary: res.summary,
          child_session_id: prev?.childSessionId,
          mode: prev?.mode,
        })
      })
    }
    return res
  }, [activeId, patchSessionCollaborationTasks])

  const handleDismissCollaborationTask = useCallback((runId: string) => {
    const sid = activeId?.trim() ?? ''
    const rid = runId.trim()
    if (!sid || !rid) return
    patchSessionCollaborationTasks(sid, (list) => dismissCollaborationTask(list, rid))
  }, [activeId, patchSessionCollaborationTasks])

  return {
    collaborationTasksBySession,
    sessionCollaborationTasks,
    visibleCollaborationTasks,
    patchSessionCollaborationTasks,
    clearSessionCollaborationTasks,
    handleCancelCollaborationTask,
    handleDismissCollaborationTask,
  }
}
