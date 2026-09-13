import type { Dispatch, SetStateAction } from 'react'
import type { SettingsSection } from '../../pages/settings/SettingsSidebar'
import { useOpptrixDialogAlert } from '../../components/opptrix/OpptrixDialogAlert'
import { useWorkspaceUi } from '../workspace/WorkspaceUiContext'
import type { SidebarListTab } from '../SessionSidebar'
import type { useChatDomain } from './useChatDomain'
import { useSessionArchive } from './useSessionArchive'
import { useSessionCrudActions } from './useSessionCrudActions'
import { useChatContextActions } from './useChatContextActions'
import { useSessionTitleActions } from './useSessionTitleActions'
import { useSessionSidebarModel } from './useSessionSidebarModel'

type ChatDomainReturn = ReturnType<typeof useChatDomain>

export interface ChatSessionFlowPorts {
  sidebarListTab: SidebarListTab
  setSidebarListTab: Dispatch<SetStateAction<SidebarListTab>>
  openRolePersonaDrawer: () => void
  onError: (message: string) => void
  chrome: {
    openSystemSettings: (section?: SettingsSection) => void
    handleOpenSearch: () => void
  }
}

export function useChatSessionFlow(ports: ChatSessionFlowPorts, domain: ChatDomainReturn) {
  const ui = useWorkspaceUi()
  const { confirm } = useOpptrixDialogAlert()
  const { sidebarListTab, setSidebarListTab, openRolePersonaDrawer, onError, chrome } = ports
  const { navigate } = ui

  const {
    activeId, activeIdRef, activeSessionMeta, activeSession, messages,
    setActiveId, setActiveSessionMeta, setMessages, setContextRef, setSessionModelState,
    setSessionLlmParamsState, pushComposerDraft, loadSession, resetContextUsageForSession,
    refreshSessions, setSessions, setDefaultModel, resolvedSessionModel,
    refreshContextUsage, setWelcomeEpoch, refs, flags, engine,
  } = domain
  const { sessions } = domain
  const { streamingSessionIdsRef, streamingSessionIds } = flags
  const { drainIntentRef, submitImplRef } = refs
  const {
    abortSessionStream, clearSessionWakeState, clearSessionBackgroundJobs,
    clearSessionCollaborationTasks, syncPromptQueueUi,
  } = engine

  const {
    archivedGroups,
    refreshArchived,
    handleCreateArchiveFolder,
    handleRenameArchiveFolder,
    handleDeleteArchiveFolder,
    handleClearArchiveFolder,
    handleDeleteArchivedSession,
  } = useSessionArchive({
    onError,
    activeId,
    refreshSessions,
    loadSession,
    resetContextUsageForSession,
    activeIdRef,
    setActiveId,
    setActiveSessionMeta,
    setMessages,
    setContextRef,
    setSessionModelState,
    setSessionLlmParamsState,
  })

  const crud = useSessionCrudActions({
    confirm,
    restoreChatColumn: ui.restoreChatColumn,
    closeDrawer: ui.closeDrawer,
    navigate,
    view: ui.view,
    activeId,
    activeIdRef,
    messages,
    setSidebarListTab,
    onError,
    setActiveId,
    setActiveSessionMeta,
    setMessages,
    setContextRef,
    setSessionModelState,
    setSessionLlmParamsState,
    setWelcomeEpoch,
    pushComposerDraft,
    loadSession,
    resetContextUsageForSession,
    refreshSessions,
    setSessions,
    setDefaultModel,
    refreshArchived,
    abortSessionStream,
    clearSessionWakeState,
    clearSessionBackgroundJobs,
    clearSessionCollaborationTasks,
    syncPromptQueueUi,
    drainIntentRef,
    streamingSessionIdsRef,
    submitImplRef,
  })
  const {
    handleNew,
    handleSelect,
    handleDelete,
    handleArchive,
    handleForkFromMessage,
    handleEditResend,
  } = crud

  const contextActions = useChatContextActions({
    restoreChatColumn: ui.restoreChatColumn,
    closeDrawer: ui.closeDrawer,
    navigate,
    view: ui.view,
    activeId,
    activeIdRef,
    resolvedSessionModel,
    onError,
    setContextRef,
    pushComposerDraft,
    refreshContextUsage,
    loadSession,
  })
  const {
    handleSearchAction,
    handleEphemeralAsk,
  } = contextActions

  const titleActions = useSessionTitleActions({
    view: ui.view,
    isStandaloneView: false,
    activeId,
    activeSessionMeta,
    activeSession,
    messages,
    onError,
    openRolePersonaDrawer,
    handleArchive,
    handleDelete,
    setSessions,
    setActiveSessionMeta,
  })
  const { titleTools } = titleActions

  const sidebarModel = useSessionSidebarModel({
    sessions,
    setSidebarListTab,
    sidebarListTab,
    streamingSessionIds,
    activeId,
    refreshArchived,
    archivedGroups,
    handleSelect,
    handleNew,
    handleDelete,
    handleArchive,
    handleOpenSearch: chrome.handleOpenSearch,
    openSystemSettings: chrome.openSystemSettings,
    onCreateArchiveFolder: handleCreateArchiveFolder,
    onRenameArchiveFolder: handleRenameArchiveFolder,
    onDeleteArchiveFolder: handleDeleteArchiveFolder,
    onClearArchiveFolder: handleClearArchiveFolder,
    onDeleteArchivedSession: handleDeleteArchivedSession,
  })
  const { sidebarProps } = sidebarModel

  return {
    archivedGroups,
    handleNew,
    handleSelect,
    handleForkFromMessage,
    handleEditResend,
    handleSearchAction,
    handleEphemeralAsk,
    titleTools,
    sidebarProps,
  }
}
