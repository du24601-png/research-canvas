import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { AppRoute } from '../../hooks/useAppNavigation'
import type {
  ChatContextUsage, ChatDisplayMessage, SessionContextRef, SessionLlmParams, SessionMeta,
} from '../../types/chat'
import type { ChatEngineRefs, EngineErrorPort, StreamFlags } from './engineTypes'
import { useWakeCountdown } from './useWakeCountdown'
import { useStreamNotifications } from './useStreamNotifications'
import { useBackgroundJobBoard } from './useBackgroundJobBoard'
import { useCollaborationBoard } from './useCollaborationBoard'
import { useCollaborationChildView } from './useCollaborationChildView'
import { useStreamEventRouter } from './useStreamEventRouter'
import { usePromptQueueMirror } from './usePromptQueueMirror'
import { useSubmitImpl } from './useSubmitImpl'
import { useChatSubmit } from './useChatSubmit'
import { useLiveProgressFeed } from './useLiveProgressFeed'

export interface ChatEnginePorts {
  viewRef: MutableRefObject<AppRoute>
  onError: EngineErrorPort
  activeId: string | null
  activeIdRef: MutableRefObject<string | null>
  activeSessionMetaRef: MutableRefObject<SessionMeta | null>
  sessionsRef: MutableRefObject<SessionMeta[]>
  setActiveId: Dispatch<SetStateAction<string | null>>
  setActiveSessionMeta: Dispatch<SetStateAction<SessionMeta | null>>
  setMessages: Dispatch<SetStateAction<ChatDisplayMessage[]>>
  messages: ChatDisplayMessage[]
  setContextRef: Dispatch<SetStateAction<SessionContextRef | null>>
  setSessionModelState: Dispatch<SetStateAction<string | undefined>>
  setSessionLlmParamsState: Dispatch<SetStateAction<SessionLlmParams | undefined>>
  setContextUsage: Dispatch<SetStateAction<ChatContextUsage | null>>
  resetContextUsageForSession: (sessionId: string | null) => void
  refreshSessions: () => Promise<SessionMeta[]>
  setSessions: Dispatch<SetStateAction<SessionMeta[]>>
  setDefaultModel: Dispatch<SetStateAction<string | undefined>>
  setContextHintBanner: (message: string) => void
}

/**
 * 引擎域组合（组合顺序 TDZ 关键，子 hook 禁止互相 import，全部经参数注入）：
 * refs/flags 由 Shell 先建并传入 → wake → notify → jobs → board → child → router → queue → submit → feed。
 */
export function useChatEngine(refs: ChatEngineRefs, flags: StreamFlags, ports: ChatEnginePorts) {
  const {
    viewRef,
    onError,
    activeId,
    activeIdRef,
    activeSessionMetaRef,
    sessionsRef,
    setActiveId,
    setActiveSessionMeta,
    setMessages,
    messages,
    setContextRef,
    setSessionModelState,
    setSessionLlmParamsState,
    setContextUsage,
    resetContextUsageForSession,
    refreshSessions,
    setSessions,
    setDefaultModel,
    setContextHintBanner,
  } = ports

  // 1-2) refs / flags 由调用方先建（见 Shell）
  // 3) 唤醒倒计时
  const wake = useWakeCountdown(refs, {
    activeIdRef,
    streamingSessionIdsRef: flags.streamingSessionIdsRef,
    wakeWaitingSessionIdsRef: flags.wakeWaitingSessionIdsRef,
    markSessionWakeWaiting: flags.markSessionWakeWaiting,
  })
  // 4) 通知
  const notify = useStreamNotifications(refs, {
    activeIdRef,
    viewRef,
    onError,
    sessionsRef,
    activeSessionMetaRef,
    streamingSessionIdsRef: flags.streamingSessionIdsRef,
  })
  // 5) 后台 Job
  const jobs = useBackgroundJobBoard({ activeId, markWakeWaiting: flags.markSessionWakeWaiting })
  // 6) 协作看板
  const board = useCollaborationBoard({ activeId })
  // 7) 协作子视图
  const collab = useCollaborationChildView({
    activeId,
    activeIdRef,
    streamCacheRef: refs.streamCacheRef,
    visibleCollaborationTasks: board.visibleCollaborationTasks,
  })
  // 8) 流事件路由
  const router = useStreamEventRouter(refs, {
    streamingSessionIds: flags.streamingSessionIds,
    wakeWaitingSessionIds: flags.wakeWaitingSessionIds,
    streamingSessionIdsRef: flags.streamingSessionIdsRef,
    wakeWaitingSessionIdsRef: flags.wakeWaitingSessionIdsRef,
    pendingWakeRef: wake.pendingWakeRef,
    applyBackgroundJobProgressEvent: jobs.applyBackgroundJobProgressEvent,
    patchSessionCollaborationTasks: board.patchSessionCollaborationTasks,
    bumpChildLiveTrace: collab.bumpChildLiveTrace,
    clearChildLiveTrace: collab.clearChildLiveTrace,
    collaborationViewTabRef: collab.collaborationViewTabRef,
    setChildLiveTraceVersion: collab.setChildLiveTraceVersion,
    handleNotificationResult: notify.handleNotificationResult,
    activeIdRef,
    viewRef,
    setContextHintBanner,
    setContextUsage,
  })
  // 9) 排队提示（drain 经共享 submitImplRef 调用发送）
  const queue = usePromptQueueMirror({
    refs,
    activeId,
    activeIdRef,
    streamingSessionIdsRef: flags.streamingSessionIdsRef,
  })
  // 10) 发送 / 停止（submitImpl 与 abort/stop 共享同一端口对象）
  const submitPorts = {
    activeId,
    activeIdRef,
    onError,
    setActiveId,
    setActiveSessionMeta,
    setMessages,
    messages,
    setContextRef,
    setSessionModelState,
    setSessionLlmParamsState,
    setContextUsage,
    resetContextUsageForSession,
    refreshSessions,
    setSessions,
    setDefaultModel,
    clearSessionBackgroundJobs: jobs.clearSessionBackgroundJobs,
    collaborationTasksBySession: board.collaborationTasksBySession,
    patchSessionCollaborationTasks: board.patchSessionCollaborationTasks,
    clearSessionWakeState: wake.clearSessionWakeState,
    startWakeCountdown: wake.startWakeCountdown,
    pendingWakeRef: wake.pendingWakeRef,
    resolveSessionTitle: notify.resolveSessionTitle,
    maybeNotifyChatDone: notify.maybeNotifyChatDone,
    markStreamingSessionsAwayIfNeeded: notify.markStreamingSessionsAwayIfNeeded,
    pushStreamEvent: router.pushStreamEvent,
    syncPromptQueueUi: queue.syncPromptQueueUi,
    drainPromptQueueAfterStream: queue.drainPromptQueueAfterStream,
  }
  useSubmitImpl(refs, flags, submitPorts)
  const submit = useChatSubmit(refs, flags, submitPorts)
  // 11) live-progress 总线（与 stream 共享 refs / router，实现互斥）
  useLiveProgressFeed(refs, flags, {
    activeId,
    activeIdRef,
    setActiveSessionMeta,
    setMessages,
    setContextRef,
    setSessionModelState,
    setSessionLlmParamsState,
    setContextUsage,
    resetContextUsageForSession,
    refreshSessions,
    applyBackgroundJobProgressEvent: jobs.applyBackgroundJobProgressEvent,
    patchSessionBackgroundJobs: jobs.patchSessionBackgroundJobs,
    patchSessionCollaborationTasks: board.patchSessionCollaborationTasks,
    clearSessionWakeState: wake.clearSessionWakeState,
    startWakeCountdown: wake.startWakeCountdown,
    pendingWakeRef: wake.pendingWakeRef,
    resolveSessionTitle: notify.resolveSessionTitle,
    maybeNotifyChatDone: notify.maybeNotifyChatDone,
    pushStreamEvent: router.pushStreamEvent,
  })

  return {
    // jobs
    sessionBackgroundJobs: jobs.sessionBackgroundJobs,
    handleCancelBackgroundJob: jobs.handleCancelBackgroundJob,
    // collab
    collaborationViewTab: collab.collaborationViewTab,
    collaborationChildMessages: collab.collaborationChildMessages,
    collaborationChildLoading: collab.collaborationChildLoading,
    collaborationChildError: collab.collaborationChildError,
    collaborationChildLiveTrace: collab.collaborationChildLiveTrace,
    collaborationChildStreaming: collab.collaborationChildStreaming,
    handleSelectCollaborationRun: collab.handleSelectCollaborationRun,
    handleCollaborationViewTabChange: collab.handleCollaborationViewTabChange,
    handleReloadCollaborationChild: collab.handleReloadCollaborationChild,
    handleCancelCollaborationTask: board.handleCancelCollaborationTask,
    handleDismissCollaborationTask: board.handleDismissCollaborationTask,
    sessionCollaborationTasks: board.sessionCollaborationTasks,
    // queue
    promptQueue: queue.promptQueue,
    handlePromptQueueRemove: queue.handlePromptQueueRemove,
    handlePromptQueueRunNow: queue.handlePromptQueueRunNow,
    // submit
    handleSubmit: submit.handleSubmit,
    handleStop: submit.handleStop,
    abortSessionStream: submit.abortSessionStream,
    // wake / jobs / board / queue（handleDelete / handleArchive 等动作层消费）
    clearSessionWakeState: wake.clearSessionWakeState,
    clearSessionBackgroundJobs: jobs.clearSessionBackgroundJobs,
    clearSessionCollaborationTasks: board.clearSessionCollaborationTasks,
    syncPromptQueueUi: queue.syncPromptQueueUi,
    // notify（visibility 效应留 Shell 组合 notify + data）
    markStreamingSessionsAwayIfNeeded: notify.markStreamingSessionsAwayIfNeeded,
    // router（memo 化 ChatView 需要）
    resolveStreamSnapshot: router.resolveStreamSnapshot,
    clearPendingUserPrompt: router.clearPendingUserPrompt,
  }
}
