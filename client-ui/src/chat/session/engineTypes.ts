import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { ChatStreamUiRef } from '../chatStreamUiBridge'
import type { SessionStreamSnapshot } from '../sessionStreamRuntime'
import type { PendingWakeInfo } from '../turnWakeCountdown'
import type { DrainIntent } from '../sessionPromptQueue'
import type { ChatProgressEvent } from '../../types/chatProgress'
import type {
  ChatAttachmentMeta, ChatContextUsage, ChatDisplayMessage, SessionContextRef, SessionLlmParams, SessionMeta,
} from '../../types/chat'
import type { SessionCollaborationTask } from '../sessionCollaborationTasks'

/** 发送一条消息（文本 / 附件均可省略；原 submitImplRef 内联函数签名） */
export type SubmitImpl = (
  text?: string,
  attachmentIds?: string[],
  attachmentMetas?: ChatAttachmentMeta[],
) => Promise<void>

/** 进行中的流句柄（原 streamHandlesRef 的值类型） */
export type StreamHandle = { abortController: AbortController; streamGen: number }

/** 错误单通道端口：任何引擎域 hook 不许私设 error state */
export type EngineErrorPort = (message: string) => void

/** 引擎控制 API：后组合的域（submit）在 render 期回填，先组合的域（queue）在事件期读取 */
export type ChatEngineApi = {
  abortSessionStream: (sessionId: string) => Promise<void>
}

/** 引擎域共享的稳定 ref 束（useEngineRefs 一次创建；跨 hook 注入，子 hook 禁止互相 import） */
export type ChatEngineRefs = {
  /** ChatView 过程条写入通道（原 streamUiRef） */
  streamUiRef: ChatStreamUiRef
  streamCacheRef: MutableRefObject<Map<string, SessionStreamSnapshot>>
  streamHandlesRef: MutableRefObject<Map<string, StreamHandle>>
  sessionStreamGenRef: MutableRefObject<Map<string, number>>
  stoppingSessionsRef: MutableRefObject<Set<string>>
  /** 流结束后延迟清除过程条的 timer（sessionId → timeout id） */
  streamResetTimersRef: MutableRefObject<Map<string, number>>
  /** 本轮生成期间曾失焦/不可见（sessionId → true） */
  streamAwayDuringGenRef: MutableRefObject<Map<string, boolean>>
  /** 同轮完成通知去重键：`${sessionId}:${streamGen}` */
  doneNotifiedGensRef: MutableRefObject<Set<string>>
  /** 系统通知被拒时仅温和提示一次 */
  notificationDeniedHintedRef: MutableRefObject<boolean>
  /** 每会话 drain 意图：Stop=none；失败/成功=auto；打断指定项=runItem */
  drainIntentRef: MutableRefObject<Map<string, DrainIntent>>
  sessionModelRef: MutableRefObject<string | undefined>
  submitImplRef: MutableRefObject<SubmitImpl>
  engineApiRef: MutableRefObject<ChatEngineApi>
}

/** schedule_turn_wake 倒计时状态机的 ref 束（useWakeCountdown 持有） */
export type WakeCountdownRefs = {
  /** schedule_turn_wake 到期前本地倒计时 */
  pendingWakeRef: MutableRefObject<Map<string, PendingWakeInfo>>
  wakeCountdownTimersRef: MutableRefObject<Map<string, number>>
  wakeExpirySafetyTimersRef: MutableRefObject<Map<string, number>>
}

/** 双轨流标记（state 驱动渲染 + ref 供事件期同步读写） */
export type StreamFlags = {
  streamingSessionIds: string[]
  wakeWaitingSessionIds: string[]
  streamingSessionIdsRef: MutableRefObject<Set<string>>
  wakeWaitingSessionIdsRef: MutableRefObject<Set<string>>
  markSessionStreaming: (sessionId: string, streaming: boolean) => void
  markSessionWakeWaiting: (sessionId: string, waiting: boolean) => void
}

/** 发送/停止域共享端口（submitImpl / abort / stop 共用；子 hook 间禁止互相 import，经 useChatEngine 注入） */
export interface ChatSubmitPorts {
  activeId: string | null
  activeIdRef: MutableRefObject<string | null>
  onError: EngineErrorPort
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
  clearSessionBackgroundJobs: (sessionId: string) => void
  collaborationTasksBySession: Record<string, SessionCollaborationTask[]>
  patchSessionCollaborationTasks: (
    sessionId: string,
    updater: (prev: SessionCollaborationTask[]) => SessionCollaborationTask[],
  ) => void
  clearSessionWakeState: (sessionId: string) => void
  startWakeCountdown: (sessionId: string, wake: PendingWakeInfo) => void
  pendingWakeRef: MutableRefObject<Map<string, PendingWakeInfo>>
  resolveSessionTitle: (targetSessionId: string, eventTitle?: string) => string | undefined
  maybeNotifyChatDone: (targetSessionId: string, sessionTitle?: string, streamGen?: number) => void
  markStreamingSessionsAwayIfNeeded: () => Promise<void>
  pushStreamEvent: (targetSessionId: string, event: ChatProgressEvent) => void
  syncPromptQueueUi: (sessionId: string | null) => void
  drainPromptQueueAfterStream: (sessionId: string) => void
}
