import type { ChatViewProps } from '../ChatView'
import type { ChatStreamUiRef } from '../chatStreamUiBridge'
import type { CollaborationViewTab } from '../SessionCollaborationTabs'
import type { QueuedPrompt } from '../sessionPromptQueue'
import type { SessionBackgroundJob } from '../jobWatchProgress'
import type { SessionCollaborationTask } from '../sessionCollaborationTasks'
import type { SessionStreamSnapshot } from '../sessionStreamRuntime'
import type {
  AvailableModel,
  ChatContextUsage,
  ChatDisplayMessage,
  SessionContextRef,
  SessionMeta,
} from '../../types/chat'
import { useWorkspaceUi } from './WorkspaceUiContext'
import { DEFAULT_SESSION_DISPLAY_TITLE } from '../sessionSidebarPresentation'

/** mobile / desktop 两分支共享的 ChatView 字段束（分支差异字段全部剔除） */
export type ChatColumnSharedProps = Omit<
  ChatViewProps,
  | 'titleSlot'
  | 'overlaySlot'
  | 'contextHint'
  | 'isMobile'
  | 'onOpenSidebar'
  | 'onToggleSidebar'
  | 'rightPanelOpen'
  | 'onToggleRightPanel'
  | 'onToggleChatColumn'
  | 'sessionFilesPreviewOpen'
  | 'onOpenMobileMarketPanel'
  | 'onOpenMobileFilesPanel'
>

/** 会话/引擎域输入（引擎域迁移完成前仍由 ChatApp Shell 持有） */
export interface ChatColumnSharedInput {
  activeSession: SessionMeta | null
  activeId: string | null
  welcomeEpoch: number
  chatScrollEpoch: number
  messages: ChatDisplayMessage[]
  collaborationChildMessages: ChatDisplayMessage[]
  collaborationViewTab: CollaborationViewTab
  contextRef: SessionContextRef | null
  composerDraft: NonNullable<ChatViewProps['composerDraft']>
  loading: boolean
  wakeWaiting: boolean
  streamUiRef: ChatStreamUiRef
  error: string
  availableModels: AvailableModel[]
  sessionModel: ChatViewProps['sessionModel']
  sessionLlmParams: ChatViewProps['sessionLlmParams']
  contextUsage: ChatContextUsage | null
  onModelPanelOpenChange: (open: boolean) => void
  llmLabel: string
  backendOk: boolean
  onSubmit: NonNullable<ChatViewProps['onSubmit']>
  ensureSession: NonNullable<ChatViewProps['ensureSession']>
  onStop: NonNullable<ChatViewProps['onStop']>
  promptQueue: QueuedPrompt[]
  onPromptQueueRemove: NonNullable<ChatViewProps['onPromptQueueRemove']>
  onPromptQueueRunNow: NonNullable<ChatViewProps['onPromptQueueRunNow']>
  sessionBackgroundJobs: SessionBackgroundJob[]
  onCancelBackgroundJob: NonNullable<ChatViewProps['onCancelBackgroundJob']>
  sessionCollaborationTasks: SessionCollaborationTask[]
  onCancelCollaborationTask: NonNullable<ChatViewProps['onCancelCollaborationTask']>
  onDismissCollaborationTask: NonNullable<ChatViewProps['onDismissCollaborationTask']>
  onSelectCollaborationRun: NonNullable<ChatViewProps['onSelectCollaborationRun']>
  onCollaborationViewTabChange: NonNullable<ChatViewProps['onCollaborationViewTabChange']>
  collaborationChildLoading: boolean
  collaborationChildError: string
  collaborationChildLiveTrace: ChatViewProps['collaborationChildLiveTrace']
  collaborationChildStreaming: boolean
  onReloadCollaborationChild: NonNullable<ChatViewProps['onReloadCollaborationChild']>
  onForkFromMessage: NonNullable<ChatViewProps['onForkMessage']>
  onEditResend: NonNullable<ChatViewProps['onEditResend']>
  onQuoteSelection: NonNullable<ChatViewProps['onQuoteSelection']>
  onEphemeralAsk: NonNullable<ChatViewProps['onEphemeralAsk']>
  onClearContextRef: NonNullable<ChatViewProps['onClearContextRef']>
  onModelChange: NonNullable<ChatViewProps['onModelChange']>
  onLlmParamsChange: NonNullable<ChatViewProps['onLlmParamsChange']>
  artifactsEnabled: boolean
  onToggleArtifacts: (enabled: boolean) => void
  onNewChat: NonNullable<ChatViewProps['onNewChat']>
  onOpenSettings: NonNullable<ChatViewProps['onOpenSettings']>
  onOpenSearch: NonNullable<ChatViewProps['onOpenSearch']>
  sessions: SessionMeta[]
  onSelectSession: NonNullable<ChatViewProps['onSelectSession']>
  onStreamError: NonNullable<ChatViewProps['onStreamError']>
  resolveStreamSnapshot: NonNullable<ChatViewProps['resolveStreamSnapshot']>
  clearPendingUserPrompt: NonNullable<ChatViewProps['onClearPendingUserPrompt']>
  onToggleSessionFilesPreview: NonNullable<ChatViewProps['onToggleSessionFilesPreview']>
}

/** 构建 mobile / desktop 共享的 ChatView props（对照原两分支交集逐字段照抄） */
export function useChatColumnSharedProps(input: ChatColumnSharedInput): ChatColumnSharedProps {
  const { sidebarVisible, drawerOpen, chatVisible, openFilePreview } = useWorkspaceUi()
  const {
    activeSession,
    activeId,
    welcomeEpoch,
    chatScrollEpoch,
    messages,
    collaborationChildMessages,
    collaborationViewTab,
    contextRef,
    composerDraft,
    loading,
    wakeWaiting,
    streamUiRef,
    error,
    availableModels,
    sessionModel,
    sessionLlmParams,
    contextUsage,
    onModelPanelOpenChange,
    llmLabel,
    backendOk,
    onSubmit,
    ensureSession,
    onStop,
    promptQueue,
    onPromptQueueRemove,
    onPromptQueueRunNow,
    sessionBackgroundJobs,
    onCancelBackgroundJob,
    sessionCollaborationTasks,
    onCancelCollaborationTask,
    onDismissCollaborationTask,
    onSelectCollaborationRun,
    onCollaborationViewTabChange,
    collaborationChildLoading,
    collaborationChildError,
    collaborationChildLiveTrace,
    collaborationChildStreaming,
    onReloadCollaborationChild,
    onForkFromMessage,
    onEditResend,
    onQuoteSelection,
    onEphemeralAsk,
    onClearContextRef,
    onModelChange,
    onLlmParamsChange,
    artifactsEnabled,
    onToggleArtifacts,
    onNewChat,
    onOpenSettings,
    onOpenSearch,
    sessions,
    onSelectSession,
    onStreamError,
    resolveStreamSnapshot,
    clearPendingUserPrompt,
    onToggleSessionFilesPreview,
  } = input

  return {
    title: activeSession?.title ?? DEFAULT_SESSION_DISPLAY_TITLE,
    sessionId: activeId,
    welcomeEpoch,
    chatScrollEpoch,
    messages: collaborationViewTab === 'main' ? messages : collaborationChildMessages,
    contextRef: collaborationViewTab === 'main' ? contextRef : null,
    composerDraft,
    loading: collaborationViewTab === 'main' ? loading : false,
    wakeWaiting: collaborationViewTab === 'main' ? wakeWaiting : false,
    streamUiRef,
    error: collaborationViewTab === 'main' ? error : '',
    availableModels,
    sessionModel,
    sessionLlmParams,
    contextUsage,
    onRefreshContextUsage: () => {
      void onModelPanelOpenChange(true)
    },
    sidebarVisible,
    sidebarDrawerOpen: drawerOpen,
    llmLabel,
    backendOk,
    onSubmit,
    ensureSession,
    onStop,
    promptQueue,
    onPromptQueueRemove,
    onPromptQueueRunNow,
    backgroundJobs: sessionBackgroundJobs,
    onCancelBackgroundJob,
    collaborationTasks: sessionCollaborationTasks,
    onCancelCollaborationTask,
    onDismissCollaborationTask,
    onSelectCollaborationRun,
    collaborationViewTab,
    onCollaborationViewTabChange,
    collaborationChildLoading,
    collaborationChildError,
    collaborationChildLiveTrace,
    collaborationChildStreaming,
    onReloadCollaborationChild,
    onForkMessage: onForkFromMessage,
    onEditResend,
    onQuoteSelection: activeId && collaborationViewTab === 'main' ? onQuoteSelection : undefined,
    onEphemeralAsk: activeId && collaborationViewTab === 'main' ? onEphemeralAsk : undefined,
    onClearContextRef: contextRef && collaborationViewTab === 'main' ? onClearContextRef : undefined,
    onModelChange: availableModels.length ? onModelChange : undefined,
    onLlmParamsChange: availableModels.length ? onLlmParamsChange : undefined,
    artifactsEnabled,
    onToggleArtifacts,
    onNewChat,
    onOpenSettings,
    onOpenSearch,
    sessions,
    onSelectSession,
    chatColumnVisible: chatVisible,
    onOpenFilePreview: openFilePreview,
    onStreamError,
    resolveStreamSnapshot,
    onClearPendingUserPrompt: clearPendingUserPrompt,
    onToggleSessionFilesPreview,
  }
}
