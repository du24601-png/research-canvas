import { useCallback, useEffect, useState } from 'react'
import type { MutableRefObject } from 'react'
import type { AppRoute } from '../hooks/useAppNavigation'
import type { SettingsSection } from '../pages/settings/SettingsSidebar'
import {
  clearSettingsDeepLink,
  readSettingsDeepLink,
  resolveSettingsNavigationTarget,
  writeSettingsDeepLink,
} from '../utils/settingsDeepLink'
import { normalizeSettingsSectionForRole } from '../auth/roles'
import { useAuthStatus } from '../auth/AuthGate'
import { useDesktopShell } from '../hooks/useDesktopShell'
import SessionRolePersonaDrawer from './SessionRolePersonaDrawer'
import { unlockChatCueSound } from '../platform/chatSound'
import { isCommandPaletteShortcut } from './sessionSidebarPresentation'
import { useWorkspaceUi } from './workspace/WorkspaceUiContext'

export interface ChatAppChromePorts {
  viewRef: MutableRefObject<AppRoute>
  activeId: string | null
  refreshHealth: () => Promise<void>
  loadSession: (id: string) => Promise<void>
  onError: (message: string) => void
  setContextHintBanner: (message: string) => void
}

export function useChatAppChrome(ports: ChatAppChromePorts) {
  const { viewRef, activeId, refreshHealth, loadSession, onError, setContextHintBanner } = ports
  const {
    view, canGoBack, goBack, navigate, closeDrawer, restoreChatColumn, closeSidebarOverlay,
  } = useWorkspaceUi()
  const { status } = useAuthStatus()

  useEffect(() => {
    const unlock = () => {
      unlockChatCueSound()
    }
    window.addEventListener('pointerdown', unlock, { once: true, passive: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  const [settingsInitialSection, setSettingsInitialSection] = useState<SettingsSection | undefined>(
    () => readSettingsDeepLink() ?? undefined,
  )
  const [searchOpen, setSearchOpen] = useState(false)
  const [rolePersonaOpen, setRolePersonaOpen] = useState(false)

  const openSystemSettings = useCallback((section?: SettingsSection) => {
    const target = resolveSettingsNavigationTarget(section)
    const allowedSection = normalizeSettingsSectionForRole(target.section, status?.role)
    closeDrawer()
    closeSidebarOverlay()
    setSettingsInitialSection(allowedSection)
    writeSettingsDeepLink(
      allowedSection,
      view === 'settings' ? 'replace' : 'push',
    )
    navigate('settings')
  }, [closeDrawer, closeSidebarOverlay, navigate, setSettingsInitialSection, status?.role, view])

  const syncSettingsDeepLink = useCallback((section: SettingsSection) => {
    writeSettingsDeepLink(section, 'replace')
  }, [])

  const handleExitSettings = useCallback(() => {
    clearSettingsDeepLink()
    navigate('chat')
    refreshHealth().catch(() => {})
  }, [navigate, refreshHealth])

  const handleChromeGoBack = useCallback(() => {
    if (view === 'settings' && !canGoBack) {
      handleExitSettings()
      return
    }
    goBack()
  }, [view, canGoBack, goBack, handleExitSettings])

  const handleProtocolChat = useCallback(async (sessionId?: string) => {
    restoreChatColumn()
    closeDrawer()
    navigate('chat')
    if (!sessionId) return
    try {
      await loadSession(sessionId)
    } catch {
      onError('无法打开链接中的对话，可能已被删除')
    }
  }, [closeDrawer, loadSession, navigate, onError, restoreChatColumn])

  useDesktopShell({
    openChat: handleProtocolChat,
    openSettings: openSystemSettings,
  })

  useEffect(() => {
    const onPopState = () => {
      const linked = readSettingsDeepLink()
      if (linked) {
        setSettingsInitialSection(linked)
        if (viewRef.current !== 'settings') {
          navigate('settings')
        }
        return
      }
      if (viewRef.current === 'settings') {
        navigate('chat')
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [navigate, setSettingsInitialSection, viewRef])

  const handleOpenSearch = useCallback(() => {
    closeDrawer()
    setSearchOpen(true)
  }, [closeDrawer])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (view !== 'chat') return
      if (!isCommandPaletteShortcut(event)) return
      event.preventDefault()
      if (searchOpen) {
        setSearchOpen(false)
        return
      }
      handleOpenSearch()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [handleOpenSearch, searchOpen, view])

  useEffect(() => {
    setRolePersonaOpen(false)
    setContextHintBanner('')
  }, [activeId, setContextHintBanner, view])

  const openRolePersonaDrawer = useCallback(() => {
    setRolePersonaOpen(true)
  }, [])

  const rolePersonaDrawer = (
    <SessionRolePersonaDrawer
      open={rolePersonaOpen && view === 'chat'}
      sessionId={activeId}
      onOpenChange={setRolePersonaOpen}
    />
  )

  return {
    settingsInitialSection,
    handleExitSettings,
    syncSettingsDeepLink,
    handleChromeGoBack,
    openSystemSettings,
    handleOpenSearch,
    searchOpen,
    setSearchOpen,
    openRolePersonaDrawer,
    rolePersonaDrawer,
  }
}
