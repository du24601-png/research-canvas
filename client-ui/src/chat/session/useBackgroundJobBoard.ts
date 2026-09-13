import { useCallback, useState } from 'react'
import { cancelSessionJob } from '../../api/client'
import {
  applyJobProgressToBackgroundJobs,
  jobWatchToBackgroundJob,
  parseJobProgressEvent,
  parseJobWatchEvent,
  removeSessionBackgroundJob,
  shouldShowBackgroundJob,
  upsertSessionBackgroundJob,
  type SessionBackgroundJob,
} from '../jobWatchProgress'
import type { ChatProgressEvent } from '../../types/chatProgress'

export interface BackgroundJobBoardPorts {
  activeId: string | null
  markWakeWaiting: (sessionId: string, waiting: boolean) => void
}

/** 每会话未完成后台 Job 状态条（原 ChatAppShell 后台 Job 段逐字迁移） */
export function useBackgroundJobBoard(ports: BackgroundJobBoardPorts) {
  const { activeId, markWakeWaiting } = ports
  const [backgroundJobsBySession, setBackgroundJobsBySession] = useState<
    Record<string, SessionBackgroundJob[]>
  >({})
  const sessionBackgroundJobs = activeId ? (backgroundJobsBySession[activeId] ?? []) : []

  const patchSessionBackgroundJobs = useCallback((
    sessionId: string,
    updater: (prev: SessionBackgroundJob[]) => SessionBackgroundJob[],
  ) => {
    const sid = String(sessionId ?? '').trim()
    if (!sid) return
    setBackgroundJobsBySession((prev) => {
      const nextList = updater(prev[sid] ?? [])
      if (nextList.length === 0) {
        if (!(sid in prev)) return prev
        const { [sid]: _removed, ...rest } = prev
        return rest
      }
      return { ...prev, [sid]: nextList }
    })
  }, [])

  const clearSessionBackgroundJobs = useCallback((sessionId: string) => {
    const sid = String(sessionId ?? '').trim()
    if (!sid) return
    setBackgroundJobsBySession((prev) => {
      if (!(sid in prev)) return prev
      const { [sid]: _removed, ...rest } = prev
      return rest
    })
  }, [])

  const handleCancelBackgroundJob = useCallback(async (jobId: string) => {
    const sid = activeId?.trim() ?? ''
    const jid = jobId.trim()
    if (!sid || !jid) {
      return { ok: false, error: '暂时无法结束该任务，请稍后重试' }
    }
    const res = await cancelSessionJob(sid, jid)
    if (res.ok) {
      patchSessionBackgroundJobs(sid, (list) => removeSessionBackgroundJob(list, jid))
    }
    return res
  }, [activeId, patchSessionBackgroundJobs])

  const applyBackgroundJobProgressEvent = useCallback((
    targetSessionId: string,
    event: ChatProgressEvent,
  ) => {
    if (event.type === 'job_watch') {
      if (event.action === 'attached' || event.action === 'updated') {
        const info = parseJobWatchEvent(event)
        if (info) {
          const job = jobWatchToBackgroundJob(info)
          if (shouldShowBackgroundJob(job)) {
            markWakeWaiting(targetSessionId, true)
            patchSessionBackgroundJobs(targetSessionId, (list) =>
              upsertSessionBackgroundJob(list, job),
            )
          } else {
            patchSessionBackgroundJobs(targetSessionId, (list) =>
              removeSessionBackgroundJob(list, job.jobId),
            )
          }
        }
        return
      }
      if (event.action === 'cleared') {
        const jobId = typeof event.job_id === 'string' ? event.job_id.trim() : ''
        if (jobId) {
          patchSessionBackgroundJobs(targetSessionId, (list) =>
            removeSessionBackgroundJob(list, jobId),
          )
        } else {
          clearSessionBackgroundJobs(targetSessionId)
        }
        return
      }
      if (event.action === 'resuming') {
        markWakeWaiting(targetSessionId, false)
        const jobId = typeof event.job_id === 'string' ? event.job_id.trim() : ''
        if (jobId) {
          patchSessionBackgroundJobs(targetSessionId, (list) =>
            removeSessionBackgroundJob(list, jobId),
          )
        }
      }
      return
    }
    if (event.type === 'job_progress') {
      const progress = parseJobProgressEvent(event)
      if (progress) {
        patchSessionBackgroundJobs(targetSessionId, (list) =>
          applyJobProgressToBackgroundJobs(list, progress),
        )
      }
    }
  }, [
    clearSessionBackgroundJobs,
    markWakeWaiting,
    patchSessionBackgroundJobs,
  ])

  return {
    backgroundJobsBySession,
    sessionBackgroundJobs,
    patchSessionBackgroundJobs,
    clearSessionBackgroundJobs,
    handleCancelBackgroundJob,
    applyBackgroundJobProgressEvent,
  }
}
