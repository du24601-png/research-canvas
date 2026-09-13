import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import { getSession, subscribeSessionLiveProgress } from '../../api/client'
import type { ChatProgressEvent } from '../../types/chatProgress'
import type { CollaborationViewTab } from '../SessionCollaborationTabs'
import {
  applyChildLiveProgressEvent,
  shouldIgnoreChildSessionProgressEvent,
} from '../collaborationChildLiveTrace'
import { createThinkingStreamSnapshot, type SessionStreamSnapshot } from '../sessionStreamRuntime'
import { isActiveCollaborationStatus, type SessionCollaborationTask } from '../sessionCollaborationTasks'
import type { ChatDisplayMessage } from '../../types/chat'

export interface CollaborationChildViewPorts {
  activeId: string | null
  activeIdRef: MutableRefObject<string | null>
  streamCacheRef: MutableRefObject<Map<string, SessionStreamSnapshot>>
  visibleCollaborationTasks: SessionCollaborationTask[]
}

/** 协作子 Tab：消息轮询(3s) + 子 SSE + live trace（原 ChatAppShell 协作子视图段逐字迁移） */
export function useCollaborationChildView(ports: CollaborationChildViewPorts) {
  const { activeId, activeIdRef, streamCacheRef, visibleCollaborationTasks } = ports

  const [collaborationViewTab, setCollaborationViewTab] = useState<CollaborationViewTab>('main')
  const collaborationViewTabRef = useRef<CollaborationViewTab>('main')
  const [collaborationChildMessages, setCollaborationChildMessages] = useState<ChatDisplayMessage[]>([])
  const [collaborationChildLoading, setCollaborationChildLoading] = useState(false)
  const [collaborationChildError, setCollaborationChildError] = useState('')
  const [collaborationChildReloadNonce, setCollaborationChildReloadNonce] = useState(0)
  const [childLiveTraceVersion, setChildLiveTraceVersion] = useState(0)

  const selectedCollaborationTask = useMemo(() => {
    if (collaborationViewTab === 'main') return null
    return visibleCollaborationTasks.find((t) => t.runId === collaborationViewTab) ?? null
  }, [collaborationViewTab, visibleCollaborationTasks])

  const collaborationChildSessionId = selectedCollaborationTask?.childSessionId?.trim() ?? ''
  const collaborationChildRefreshKey = selectedCollaborationTask?.updatedAt ?? ''

  const handleSelectCollaborationRun = useCallback((runId: string) => {
    const id = runId.trim()
    if (!id) return
    const task = visibleCollaborationTasks.find((t) => t.runId === id)
    const status = task?.status?.trim().toLowerCase() ?? ''
    if (status === 'needs_parent_action') {
      setCollaborationViewTab('main')
      return
    }
    setCollaborationViewTab(id)
  }, [visibleCollaborationTasks])

  const handleCollaborationViewTabChange = useCallback((tab: CollaborationViewTab) => {
    if (tab === 'main') {
      setCollaborationViewTab('main')
      return
    }
    handleSelectCollaborationRun(tab)
  }, [handleSelectCollaborationRun])

  const handleReloadCollaborationChild = useCallback(() => {
    setCollaborationChildError('')
    setCollaborationChildReloadNonce((n) => n + 1)
  }, [])

  const bumpChildLiveTrace = useCallback((
    runId: string,
    inner: ChatProgressEvent,
  ) => {
    const id = runId.trim()
    const sid = activeIdRef.current
    if (!id || !sid) return
    const prev = streamCacheRef.current.get(sid) ?? createThinkingStreamSnapshot()
    const prevTraces = prev.collaborationTraces ?? {}
    const prevChild = prevTraces[id] ?? null
    const childSnap = applyChildLiveProgressEvent(
      {
        liveTrace: prevChild,
        pendingUserPrompt: null,
        userPromptSubmitting: false,
        contextHint: null,
      },
      inner,
    )
    streamCacheRef.current.set(sid, {
      ...prev,
      collaborationTraces: {
        ...prevTraces,
        [id]: childSnap.liveTrace ?? { steps: [] },
      },
    })
    if (collaborationViewTabRef.current === id) {
      setChildLiveTraceVersion((v) => v + 1)
    }
  }, [activeIdRef, streamCacheRef])

  const clearChildLiveTrace = useCallback((runId: string) => {
    const id = runId.trim()
    const sid = activeIdRef.current
    if (!id || !sid) return
    const prev = streamCacheRef.current.get(sid)
    if (!prev?.collaborationTraces?.[id]) return
    const { [id]: _removed, ...rest } = prev.collaborationTraces
    streamCacheRef.current.set(sid, {
      ...prev,
      collaborationTraces: Object.keys(rest).length > 0 ? rest : undefined,
    })
    if (collaborationViewTabRef.current === id) {
      setChildLiveTraceVersion((v) => v + 1)
    }
  }, [activeIdRef, streamCacheRef])

  // 依赖 childLiveTraceVersion 故意绕过 cache 引用相等（行为保留，勿“修复”）
  const collaborationChildLiveTrace = useMemo(() => {
    if (collaborationViewTab === 'main' || !activeId) return null
    void childLiveTraceVersion
    const traces = streamCacheRef.current.get(activeId)?.collaborationTraces
    return traces?.[collaborationViewTab] ?? null
  }, [activeId, collaborationViewTab, childLiveTraceVersion, streamCacheRef])

  const collaborationChildStreaming = Boolean(
    selectedCollaborationTask
    && isActiveCollaborationStatus(selectedCollaborationTask.status),
  )

  useEffect(() => {
    collaborationViewTabRef.current = collaborationViewTab
  }, [collaborationViewTab])

  useEffect(() => {
    setCollaborationViewTab('main')
    setCollaborationChildMessages([])
    setCollaborationChildError('')
    setCollaborationChildLoading(false)
    setChildLiveTraceVersion((v) => v + 1)
  }, [activeId])

  useEffect(() => {
    if (collaborationViewTab === 'main') return
    if (!visibleCollaborationTasks.some((t) => t.runId === collaborationViewTab)) {
      setCollaborationViewTab('main')
      return
    }
    const task = visibleCollaborationTasks.find((t) => t.runId === collaborationViewTab)
    if (task?.status?.trim().toLowerCase() === 'needs_parent_action') {
      setCollaborationViewTab('main')
    }
  }, [collaborationViewTab, visibleCollaborationTasks])

  useEffect(() => {
    if (collaborationViewTab === 'main') {
      setCollaborationChildMessages([])
      setCollaborationChildError('')
      setCollaborationChildLoading(false)
      return
    }

    if (!collaborationChildSessionId) {
      setCollaborationChildMessages([])
      setCollaborationChildLoading(false)
      setCollaborationChildError('此协作任务进展暂不可查看，请稍后再试')
      return
    }

    let cancelled = false
    let first = true

    const loadChild = async () => {
      if (first) setCollaborationChildLoading(true)
      try {
        const data = await getSession(collaborationChildSessionId)
        if (cancelled) return
        setCollaborationChildMessages(data.messages)
        setCollaborationChildError('')
      } catch {
        if (cancelled) return
        setCollaborationChildError('暂时无法查看此协作任务进展，请稍后重试')
      } finally {
        if (!cancelled && first) {
          setCollaborationChildLoading(false)
          first = false
        }
      }
    }

    void loadChild()
    const active = selectedCollaborationTask
      ? isActiveCollaborationStatus(selectedCollaborationTask.status)
      : false
    const timer = active
      ? window.setInterval(() => { void loadChild() }, 3000)
      : undefined

    return () => {
      cancelled = true
      if (timer != null) window.clearInterval(timer)
    }
  }, [
    collaborationViewTab,
    collaborationChildSessionId,
    collaborationChildRefreshKey,
    collaborationChildReloadNonce,
    selectedCollaborationTask?.status,
  ])

  useEffect(() => {
    if (collaborationViewTab === 'main') return
    const task = selectedCollaborationTask
    if (!task || !isActiveCollaborationStatus(task.status)) return
    const childSid = task.childSessionId?.trim()
    if (!childSid) return

    const runId = task.runId
    let cancelled = false
    const ac = new AbortController()

    const onChildEvent = (event: ChatProgressEvent) => {
      if (cancelled || shouldIgnoreChildSessionProgressEvent(event)) return
      bumpChildLiveTrace(runId, event)
    }

    void (async () => {
      while (!cancelled && !ac.signal.aborted) {
        try {
          await subscribeSessionLiveProgress(childSid, onChildEvent, ac.signal)
          break
        } catch (e) {
          const aborted = (
            (e instanceof DOMException && e.name === 'AbortError')
            || (e instanceof Error && e.name === 'AbortError')
          )
          if (aborted || cancelled) break
          await new Promise((r) => setTimeout(r, 1500))
        }
      }
    })()

    return () => {
      cancelled = true
      ac.abort()
    }
  }, [
    bumpChildLiveTrace,
    collaborationViewTab,
    selectedCollaborationTask?.runId,
    selectedCollaborationTask?.childSessionId,
    selectedCollaborationTask?.status,
  ])

  return {
    collaborationViewTab,
    setCollaborationViewTab,
    collaborationChildMessages,
    collaborationChildLoading,
    collaborationChildError,
    collaborationChildLiveTrace,
    collaborationChildStreaming,
    handleSelectCollaborationRun,
    handleCollaborationViewTabChange,
    handleReloadCollaborationChild,
    bumpChildLiveTrace,
    clearChildLiveTrace,
    collaborationViewTabRef,
    setChildLiveTraceVersion,
  }
}
