import { useCallback, useMemo } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { SidebarListTab } from '../SessionSidebar'
import type { ArchiveFolderGroup } from '../SessionSidebarArchivePanel'
import type { SettingsSection } from '../../pages/settings/SettingsSidebar'
import type { SessionMeta } from '../../types/chat'

export interface SessionSidebarModelPorts {
  sessions: SessionMeta[]
  setSidebarListTab: Dispatch<SetStateAction<SidebarListTab>>
  sidebarListTab: SidebarListTab
  streamingSessionIds: string[]
  activeId: string | null
  refreshArchived: () => Promise<unknown>
  archivedGroups: ArchiveFolderGroup[]
  handleSelect: (id: string) => Promise<void>
  handleNew: () => Promise<void>
  handleDelete: (id: string) => Promise<void>
  handleArchive: (id: string, folderId: string) => Promise<void>
  handleOpenSearch: () => void
  openSystemSettings: (section?: SettingsSection) => void
  onCreateArchiveFolder: (title: string) => Promise<void>
  onRenameArchiveFolder: (id: string, title: string) => Promise<void>
  onDeleteArchiveFolder: (id: string) => Promise<void>
  onClearArchiveFolder: (id: string) => Promise<void>
  onDeleteArchivedSession: (id: string) => Promise<void>
}

export function useSessionSidebarModel(ports: SessionSidebarModelPorts) {
  const {
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
    handleOpenSearch,
    openSystemSettings,
    onCreateArchiveFolder,
    onRenameArchiveFolder,
    onDeleteArchiveFolder,
    onClearArchiveFolder,
    onDeleteArchivedSession,
  } = ports

  const handleSidebarListTabChange = useCallback((tab: SidebarListTab) => {
    setSidebarListTab(tab)
    if (tab === 'archive') void refreshArchived()
  }, [refreshArchived, setSidebarListTab])

  const sidebarSessions = useMemo(
    () => sessions.filter(s => !s.expertId),
    [sessions],
  )

  const sidebarProps = useMemo(() => ({
    sessions: sidebarSessions,
    activeId,
    activeRoute: 'chat' as const,
    busySessionIds: streamingSessionIds,
    onSelect: handleSelect,
    onNew: handleNew,
    onDelete: handleDelete,
    onArchive: handleArchive,
    onOpenSearch: handleOpenSearch,
    onOpenSystemSettings: openSystemSettings,
    listTab: sidebarListTab,
    onListTabChange: handleSidebarListTabChange,
    archivedGroups,
    onCreateArchiveFolder,
    onRenameArchiveFolder,
    onDeleteArchiveFolder,
    onClearArchiveFolder,
    onDeleteArchivedSession,
  }), [
    sidebarSessions,
    activeId,
    streamingSessionIds,
    handleSelect,
    handleNew,
    handleDelete,
    handleArchive,
    handleOpenSearch,
    openSystemSettings,
    sidebarListTab,
    handleSidebarListTabChange,
    archivedGroups,
    onCreateArchiveFolder,
    onRenameArchiveFolder,
    onDeleteArchiveFolder,
    onClearArchiveFolder,
    onDeleteArchivedSession,
  ])

  return { sidebarSessions, handleSidebarListTabChange, sidebarProps }
}
