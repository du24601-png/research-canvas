import type { SettingsSection } from '../../pages/settings/SettingsSidebar'
import { useChatColumnSharedProps } from '../workspace/useChatColumnSharedProps'
import type { useChatDomain } from './useChatDomain'
import type { useChatSessionFlow } from './useChatSessionFlow'

type ChatDomainReturn = ReturnType<typeof useChatDomain>
type ChatFlowReturn = ReturnType<typeof useChatSessionFlow>

export interface ChatColumnPropsPorts {
  /** 聊天错误单通道（Shell 持有） */
  error: string
  onError: (message: string) => void
  openSystemSettings: (section?: SettingsSection) => void
  openSearch: () => void
}

/** ChatView 共享字段束桥（原 Shell 52 字段逐字接线；仅换输入来源，useChatColumnSharedProps 不动） */
export function useChatColumnProps(ports: ChatColumnPropsPorts, domain: ChatDomainReturn, flow: ChatFlowReturn) {
  const { error, onError, openSystemSettings, openSearch } = ports
  const {
    activeSession,
    activeId,
    welcomeEpoch,
    chatScrollEpoch,
    messages,
    contextRef,
    composerDraft,
    loading,
    wakeWaiting,
    refs,
    availableModels,
    sessionLlmParams,
    contextUsage,
    handleModelPanelOpenChange,
    llmLabel,
    backendOk,
    ensureSession,
    handleClearContextRef,
    handleQuoteSelection,
    handleModelChange,
    handleLlmParamsChange,
    handleToggleArtifacts,
    engine,
  } = domain
  const { streamUiRef } = refs
  const {
    handleSubmit,
    handleStop,
    promptQueue,
    handlePromptQueueRemove,
    handlePromptQueueRunNow,
    sessionBackgroundJobs,
    handleCancelBackgroundJob,
    sessionCollaborationTasks,
    handleCancelCollaborationTask,
    handleDismissCollaborationTask,
    handleSelectCollaborationRun,
    handleCollaborationViewTabChange,
    collaborationViewTab,
    collaborationChildMessages,
    collaborationChildLoading,
    collaborationChildError,
    collaborationChildLiveTrace,
    collaborationChildStreaming,
    handleReloadCollaborationChild,
    resolveStreamSnapshot,
    clearPendingUserPrompt,
  } = engine
  const {
    handleForkFromMessage,
    handleEditResend,
    handleEphemeralAsk,
  } = flow

  return useChatColumnSharedProps({
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
    sessionModel: domain.resolvedSessionModel,
    sessionLlmParams,
    contextUsage,
    onModelPanelOpenChange: handleModelPanelOpenChange,
    llmLabel,
    backendOk,
    onSubmit: handleSubmit,
    ensureSession,
    onStop: handleStop,
    promptQueue,
    onPromptQueueRemove: handlePromptQueueRemove,
    onPromptQueueRunNow: handlePromptQueueRunNow,
    sessionBackgroundJobs,
    onCancelBackgroundJob: handleCancelBackgroundJob,
    sessionCollaborationTasks,
    onCancelCollaborationTask: handleCancelCollaborationTask,
    onDismissCollaborationTask: handleDismissCollaborationTask,
    onSelectCollaborationRun: handleSelectCollaborationRun,
    onCollaborationViewTabChange: handleCollaborationViewTabChange,
    collaborationChildLoading,
    collaborationChildError,
    collaborationChildLiveTrace,
    collaborationChildStreaming,
    onReloadCollaborationChild: handleReloadCollaborationChild,
    onForkFromMessage: handleForkFromMessage,
    onEditResend: handleEditResend,
    onQuoteSelection: handleQuoteSelection,
    onEphemeralAsk: handleEphemeralAsk,
    onClearContextRef: handleClearContextRef,
    onModelChange: handleModelChange,
    onLlmParamsChange: handleLlmParamsChange,
    artifactsEnabled: Boolean(activeSession?.artifactsEnabled),
    onToggleArtifacts: handleToggleArtifacts,
    onNewChat: flow.handleNew,
    onOpenSettings: openSystemSettings,
    onOpenSearch: openSearch,
    sessions: flow.sidebarProps.sessions,
    onSelectSession: flow.handleSelect,
    onStreamError: onError,
    resolveStreamSnapshot,
    clearPendingUserPrompt,
    onToggleSessionFilesPreview: domain.handleToggleSessionFilesPreview,
  })
}
