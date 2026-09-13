import { useEffect, useRef, useState } from 'react'
import { makeStyles, mergeClasses } from '@fluentui/react-components'
import { opptrixCssVars } from '../theme/tokens'
import { electronPlatform } from '../platform/detect'
import WorkspaceSearchDialog from './WorkspaceSearchDialog'
import SessionSidebar, { type SidebarListTab } from './SessionSidebar'
import { sessionSidebarPresentation } from './sessionSidebarPresentation'
import {
  DESKTOP_FRAME_TITLEBAR_HEIGHT,
} from '../desktop/constants'
import { useWorkspaceUi } from './workspace/WorkspaceUiContext'
import { WorkspaceUiProvider } from './workspace/WorkspaceUiProvider'
import { SettingsViewHost } from './workspace/SettingsViewHost'
import { ChatDesktopChrome } from './workspace/ChatDesktopChrome'
import { ChatWorkspace } from './workspace/ChatWorkspace'
import { useChatDomain } from './session/useChatDomain'
import { useChatSessionFlow } from './session/useChatSessionFlow'
import { useChatColumnProps } from './session/useChatColumnProps'
import { buildSessionTitleSlots } from './workspace/sessionTitleSlots'
import { useChatAppChrome } from './useChatAppChrome'

const useStyles = makeStyles({
  root: {
    display: 'flex',
    height: '100dvh',
    backgroundColor: opptrixCssVars.canvas,
    overflow: 'hidden',
  },
  rootElectron: {
    backgroundColor: 'transparent',
  },
  rootElectronFrameTitlebar: {
    paddingTop: `${DESKTOP_FRAME_TITLEBAR_HEIGHT}px`,
    boxSizing: 'border-box',
  },
  rootLayout: {
    display: 'flex',
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    width: '100%',
  },
})

export default function ChatApp() {
  return (
    <WorkspaceUiProvider>
      <ChatAppShell />
    </WorkspaceUiProvider>
  )
}

function ChatAppShell() {
  const s = useStyles()
  const ui = useWorkspaceUi()
  const {
    view, canGoBack, canGoForward, goForward,
    isMobile, electronChrome,
    sidebarWidth, drawerOpen, closeDrawer,
    setSettingsSidebarVisible,
  } = ui

  const [sidebarListTab, setSidebarListTab] = useState<SidebarListTab>('chat')
  const [error, setError] = useState('')
  const [contextHintBanner, setContextHintBanner] = useState('')
  const viewRef = useRef(view)
  viewRef.current = view

  const domain = useChatDomain({
    viewRef,
    onError: setError,
    setContextHintBanner,
  })

  const chrome = useChatAppChrome({
    viewRef,
    activeId: domain.activeId,
    refreshHealth: domain.refreshHealth,
    loadSession: domain.loadSession,
    onError: setError,
    setContextHintBanner,
  })

  const flow = useChatSessionFlow({
    sidebarListTab,
    setSidebarListTab,
    openRolePersonaDrawer: chrome.openRolePersonaDrawer,
    onError: setError,
    chrome: {
      openSystemSettings: chrome.openSystemSettings,
      handleOpenSearch: chrome.handleOpenSearch,
    },
  }, domain)

  /** L5 壳层职责：标题双 slot 与 drawer 侧栏元素在此构建一次（数据来自 L2 无头 hook） */
  const { sessionTitleTools, chatTitleSlot } = buildSessionTitleSlots(flow.titleTools)
  const sessionPresentation = sessionSidebarPresentation(isMobile)
  const drawerSidebar = sessionPresentation === 'drawer' ? (
    <SessionSidebar
      mode="drawer"
      width={sidebarWidth}
      drawerOpen={drawerOpen}
      onClose={closeDrawer}
      {...flow.sidebarProps}
    />
  ) : null

  const chatColumnProps = useChatColumnProps({
    error,
    onError: setError,
    openSystemSettings: chrome.openSystemSettings,
    openSearch: chrome.handleOpenSearch,
  }, domain, flow)

  useEffect(() => {
    setContextHintBanner('')
  }, [domain.activeId, view])

  useEffect(() => {
    if (!contextHintBanner) return
    const timer = window.setTimeout(() => setContextHintBanner(''), 4200)
    return () => window.clearTimeout(timer)
  }, [contextHintBanner])

  const isSettings = view === 'settings'
  const isStandaloneView = false
  const chromeTitle = domain.activeSession?.title ?? '新对话'

  return (
    <>
      <WorkspaceSearchDialog
        open={chrome.searchOpen}
        onClose={() => chrome.setSearchOpen(false)}
        onAction={flow.handleSearchAction}
      />
      <ChatDesktopChrome
        view={view}
        isSettings={isSettings}
        isStandaloneView={isStandaloneView}
        chromeTitle={chromeTitle}
        canGoBack={canGoBack}
        canGoForward={canGoForward}
        onGoBack={chrome.handleChromeGoBack}
        onGoForward={goForward}
        onNewChat={flow.handleNew}
        onOpenSearch={chrome.handleOpenSearch}
        onOpenSettings={chrome.openSystemSettings}
        onSelectSession={flow.handleSelect}
        sessions={flow.sidebarProps.sessions}
        onToggleSessionFilesPreview={domain.handleToggleSessionFilesPreview}
        activeSessionId={domain.activeId}
        titleSlot={sessionTitleTools}
      />
      <div className={mergeClasses(
        s.root,
        electronChrome && s.rootElectron,
        electronChrome && electronPlatform() !== 'darwin' && s.rootElectronFrameTitlebar,
        electronChrome && 'opptrix-app-shell',
      )}>
        <div className={s.rootLayout}>
        {isSettings && (
          <SettingsViewHost
            isMobile={isMobile}
            initialSection={chrome.settingsInitialSection}
            onSectionChange={chrome.syncSettingsDeepLink}
            onBack={chrome.handleExitSettings}
            onSaved={async () => {
              await domain.refreshHealth()
            }}
            onSidebarClose={() => setSettingsSidebarVisible(false)}
          />
        )}

        <ChatWorkspace
          active={view === 'chat'}
          hidden={isSettings || isStandaloneView}
          drawerSidebar={drawerSidebar}
          chat={chatColumnProps}
          titleSlot={electronChrome ? undefined : chatTitleSlot}
          overlaySlot={chrome.rolePersonaDrawer}
          contextHint={contextHintBanner}
          previewSessionId={domain.activeId}
          onSelectPreviewAttachment={domain.handleSelectPreviewAttachment}
          onOpenMobileFilesPanel={domain.handleOpenMobileFilesPanel}
        />

        </div>
      </div>
    </>
  )
}
