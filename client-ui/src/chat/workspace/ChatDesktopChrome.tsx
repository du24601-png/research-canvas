import type { ReactNode } from 'react'
import { FolderListRegular } from '@fluentui/react-icons'
import type { AppRoute } from '../../hooks/useAppNavigation'
import DesktopWindowChrome from '../../desktop/DesktopWindowChrome'
import ChromeToolButton from '../../desktop/ChromeToolButton'
import OverlaySidebarEdgeTrigger from '../../desktop/OverlaySidebarEdgeTrigger'
import { DESKTOP_TOOL_ICON_SIZE } from '../../desktop/constants'
import type { SessionMeta } from '../../types/chat'
import SessionPickerMenu from '../SessionPickerMenu'
import { useWorkspaceUi } from './WorkspaceUiContext'

export interface ChatDesktopChromeProps {
  view: AppRoute
  isSettings: boolean
  isStandaloneView: boolean
  chromeTitle: string
  canGoBack: boolean
  canGoForward: boolean
  onGoBack: () => void
  onGoForward: () => void
  onNewChat: () => void
  onOpenSearch: () => void
  onOpenSettings: () => void
  onSelectSession: (id: string) => void
  sessions: SessionMeta[]
  onToggleSessionFilesPreview: () => void
  activeSessionId: string | null
  titleSlot: ReactNode
}

/**
 * Electron 桌面窗chrome：侧栏边缘唤出触发器 + DesktopWindowChrome。
 * 侧栏/右栏几何与开关全部读取全局工作区状态。
 */
export function ChatDesktopChrome({
  view,
  isSettings,
  isStandaloneView,
  chromeTitle,
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
  onNewChat,
  onOpenSearch,
  onOpenSettings,
  onSelectSession,
  sessions,
  onToggleSessionFilesPreview,
  activeSessionId,
  titleSlot,
}: ChatDesktopChromeProps) {
  const {
    isMobile,
    electronChrome,
    paneMode,
    sidebarOverlayMode,
    settingsSidebarVisible,
    settingsSidebarWidth,
    settingsSidebarDragging,
    rightPanelVisible,
    rightPanelWidth,
    chatVisible,
    chatWidth,
    showSplitter,
    isSplitDragging,
    canToggleChatColumn,
    toggleRightPanel,
    toggleChatColumn,
    toggleSidebar,
    revealSidebar,
  } = useWorkspaceUi()

  const settingsSidebarInlineVisible = settingsSidebarVisible && !sidebarOverlayMode
  const overlaySidebarOpen = isSettings ? settingsSidebarVisible : false
  const chromeViewMode = isSettings ? 'settings' : 'chat'

  /** Electron：挂到 DesktopWindowChrome titleBarTrailing；右侧全宽（无聊天列）时隐藏 */
  const sessionFilesPreviewButton = electronChrome && view === 'chat' && !isStandaloneView && !isMobile && chatVisible ? (
    <ChromeToolButton
      label="文件预览"
      active={paneMode === 'preview'}
      disabled={!activeSessionId}
      data-session-files-toggle
      onClick={onToggleSessionFilesPreview}
    >
      <FolderListRegular fontSize={DESKTOP_TOOL_ICON_SIZE} />
    </ChromeToolButton>
  ) : null

  return (
    <>
      {electronChrome && isSettings && sidebarOverlayMode && !overlaySidebarOpen && (
        <OverlaySidebarEdgeTrigger
          enabled
          onReveal={revealSidebar}
        />
      )}
      {electronChrome && (
        <DesktopWindowChrome
          title={chromeTitle}
          titleSlot={titleSlot}
          titleBarTrailing={sessionFilesPreviewButton ?? undefined}
          viewMode={chromeViewMode}
          sidebarOpen={isSettings ? settingsSidebarVisible : false}
          sidebarInline={isSettings
            ? settingsSidebarInlineVisible
            : false}
          sidebarWidth={isSettings ? settingsSidebarWidth : 0}
          sidebarDragging={isSettings ? settingsSidebarDragging : false}
          showSidebarToggle={isSettings}
          sidebarHoverReveal={isSettings && sidebarOverlayMode}
          onRevealSidebar={isSettings ? revealSidebar : undefined}
          canGoBack={isSettings || canGoBack}
          canGoForward={!isSettings && canGoForward}
          onToggleSidebar={isSettings ? toggleSidebar : undefined}
          toolbarLeading={!isSettings && !isMobile ? (
            <SessionPickerMenu
              sessions={sessions}
              activeId={activeSessionId}
              onSelect={onSelectSession}
              onOpenSearch={onOpenSearch}
              onOpenSettings={onOpenSettings}
            />
          ) : undefined}
          onNewChat={onNewChat}
          onOpenSearch={!isSettings ? onOpenSearch : undefined}
          onGoBack={!isSettings ? onGoBack : undefined}
          onGoForward={!isSettings ? onGoForward : undefined}
          rightPanelOpen={view === 'chat' && !isMobile ? rightPanelVisible : undefined}
          rightPanelWidth={view === 'chat' && !isMobile && rightPanelVisible ? rightPanelWidth : undefined}
          rightPanelDragging={view === 'chat' && !isMobile ? isSplitDragging : undefined}
          chatColumnWidth={view === 'chat' && !isMobile && chatVisible && showSplitter ? chatWidth : undefined}
          chatAreaLeft={isSettings
            ? (settingsSidebarInlineVisible ? settingsSidebarWidth : 0)
            : 0}
          chatColumnVisible={view === 'chat' && !isMobile ? chatVisible : undefined}
          onToggleRightPanel={view === 'chat' && !isMobile ? toggleRightPanel : undefined}
          onToggleChatColumn={view === 'chat' && !isMobile && canToggleChatColumn ? toggleChatColumn : undefined}
        />
      )}
    </>
  )
}
