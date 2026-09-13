import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useAppNavigation } from '../../hooks/useAppNavigation'
import {
  sidebarExpandThreshold,
  useBreakpoint,
  useSidebarOverlayMode,
  useSidebarPreference,
  useSidebarResizeSync,
} from '../../hooks/useBreakpoint'
import { useWorkspaceSplit } from '../../hooks/useWorkspaceSplit'
import { useSessionSidebarWidth } from '../../hooks/useSessionSidebarWidth'
import { useSettingsSidebarWidth } from '../../hooks/useSettingsSidebarWidth'
import { useElectronFullscreen } from '../../hooks/useElectronFullscreen'
import { desktopChromeToolbarReserve } from '../../desktop/layout'
import {
  SIDEBAR_DEFAULT_WIDTH,
  WORKSPACE_CHAT_MIN_WIDTH,
  WORKSPACE_CHAT_RIGHT_MIN_WIDTH,
} from '../../desktop/constants'
import { readSettingsDeepLink } from '../../utils/settingsDeepLink'
import { isElectron } from '../../platform/detect'
import type { ChatAttachmentMeta } from '../../types/chat'
import type { FilePreviewTarget } from '../FilePreviewPanel'
import { WorkspaceUiContext, type MobileRightSheetKind, type WorkspaceUiContextValue } from './WorkspaceUiContext'

export function WorkspaceUiProvider({ children }: { children: ReactNode }) {
  const breakpoint = useBreakpoint()
  const isMobile = breakpoint === 'mobile'
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1280,
  )

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const {
    current: view,
    canGoBack,
    canGoForward,
    navigate,
    goBack,
    goForward,
  } = useAppNavigation(readSettingsDeepLink() ? 'settings' : 'chat')

  const splitEnabled = !isMobile && view === 'chat'

  const {
    workspaceRef,
    rightPanelOpen: rightPanelVisible,
    chatVisible,
    rightPanelWidth,
    showSplitter,
    chatWidth,
    isDragging,
    canToggleChatColumn,
    beginDrag,
    collapseRightPanel,
    toggleRightPanel,
    toggleChatColumn,
    mode,
    openPreview,
    openMarket,
  } = useWorkspaceSplit({ enabled: splitEnabled })

  const modeRef = useRef(mode)
  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  const workspaceMinWidth = splitEnabled && rightPanelVisible
    ? WORKSPACE_CHAT_RIGHT_MIN_WIDTH
    : WORKSPACE_CHAT_MIN_WIDTH

  const [preview, setPreview] = useState<FilePreviewTarget | null>(null)
  /** 本会话停留期间用户主动关闭预览后，不再自动打开 */
  const [previewAutoOpenDismissed, setPreviewAutoOpenDismissed] = useState(false)
  /** 移动端右栏：与左抽屉同轨 translate（常驻第三列，不二次挂载） */
  const [mobileRightSheet, setMobileRightSheet] = useState<MobileRightSheetKind | null>(null)
  const mobileSheetOpen = isMobile && view === 'chat' && mobileRightSheet != null

  useEffect(() => {
    if (!isMobile || view !== 'chat') {
      setMobileRightSheet(null)
    }
  }, [isMobile, view])

  useEffect(() => {
    if (mode === 'market' && !rightPanelVisible) {
      setPreview(null)
    }
  }, [mode, rightPanelVisible])

  const closeMobileRightSheet = useCallback(() => {
    setMobileRightSheet(null)
    setPreview(null)
  }, [])

  const closePreview = useCallback(() => {
    setPreviewAutoOpenDismissed(true)
    if (isMobile) {
      closeMobileRightSheet()
      return
    }
    openMarket()
  }, [openMarket, isMobile, closeMobileRightSheet])

  const onPeerSlideSettled = useCallback(() => {
    if (modeRef.current === 'market') {
      setPreview(null)
    }
  }, [])

  const {
    width: sidebarWidth,
    isDragging: sidebarDragging,
    beginDrag: beginSidebarDrag,
  } = useSessionSidebarWidth({
    enabled: !isMobile,
    viewportWidth,
    workspaceMinWidth,
  })

  const {
    width: settingsSidebarWidth,
    isDragging: settingsSidebarDragging,
    beginDrag: beginSettingsSidebarDrag,
  } = useSettingsSidebarWidth({
    enabled: !isMobile,
    viewportWidth,
  })

  const {
    visible: sidebarVisible,
    drawerOpen,
    setVisible: setSidebarVisible,
    toggleVisible,
    openDrawer,
    closeDrawer,
  } = useSidebarPreference(isMobile, sidebarWidth)

  const [settingsSidebarVisible, setSettingsSidebarVisible] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth >= sidebarExpandThreshold(SIDEBAR_DEFAULT_WIDTH)
  })

  const overlayWidthForMode = view === 'settings' ? settingsSidebarWidth : sidebarWidth
  const widthBasedOverlay = useSidebarOverlayMode(!isMobile, overlayWidthForMode)
  const sidebarOverlayMode = view === 'settings' ? widthBasedOverlay : true
  const sidebarInlineVisible = view === 'settings'
    ? (settingsSidebarVisible && !widthBasedOverlay)
    : false

  const electronChrome = isElectron() && !isMobile

  useEffect(() => {
    if (!electronChrome) return
    let cancelled = false
    const outer = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return
        document.documentElement.classList.remove('opptrix-electron-startup')
        window.electronAPI?.signalShellReady?.()
      })
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(outer)
    }
  }, [electronChrome])

  const macFullscreen = useElectronFullscreen()
  const chromeToolbarReserve = electronChrome && !sidebarInlineVisible
    ? desktopChromeToolbarReserve(macFullscreen)
    : 0

  const collapseSidebars = useCallback(() => {
    setSettingsSidebarVisible(false)
    collapseRightPanel(true)
  }, [collapseRightPanel])

  const expandSidebars = useCallback(() => {
    setSettingsSidebarVisible(true)
  }, [])

  useSidebarResizeSync(!isMobile, overlayWidthForMode, collapseSidebars, expandSidebars)

  const toggleSidebar = useCallback(() => {
    if (view === 'settings') {
      setSettingsSidebarVisible(prev => !prev)
      return
    }
    if (isMobile && mobileRightSheet != null) {
      closeMobileRightSheet()
    }
    toggleVisible()
  }, [view, toggleVisible, isMobile, mobileRightSheet, closeMobileRightSheet])

  const openFilePreview = useCallback((sessionId: string, attachment: ChatAttachmentMeta) => {
    setPreview({ sessionId, attachment })
    if (isMobile) {
      closeDrawer()
      setMobileRightSheet('preview')
      return
    }
    openPreview()
  }, [openPreview, isMobile, closeDrawer])

  const openPreviewTarget = useCallback((target: FilePreviewTarget | null) => {
    setPreview(target)
    if (!isMobile) openPreview()
  }, [openPreview, isMobile])

  const openMarketPanel = useCallback(() => {
    openMarket()
  }, [openMarket])

  const markPreviewAutoOpenDismissed = useCallback(() => {
    setPreviewAutoOpenDismissed(true)
  }, [])

  const resetPreviewAutoOpenState = useCallback(() => {
    setPreviewAutoOpenDismissed(false)
  }, [])

  const openMobileSheet = useCallback((kind: MobileRightSheetKind) => {
    setMobileRightSheet(kind)
  }, [])

  const openMobileMarketPanel = useCallback(() => {
    closeDrawer()
    setMobileRightSheet((prev) => (prev === 'market' ? null : 'market'))
  }, [closeDrawer])

  const restoreChatColumn = useCallback(() => {
    if (!chatVisible && canToggleChatColumn) {
      toggleChatColumn()
    }
  }, [canToggleChatColumn, chatVisible, toggleChatColumn])

  const revealSidebar = useCallback(() => {
    if (view === 'settings') {
      setSettingsSidebarVisible(true)
      return
    }
    setSidebarVisible(true)
  }, [view, setSidebarVisible])

  const closeSidebarOverlay = useCallback(() => {
    setSidebarVisible(false)
  }, [setSidebarVisible])

  const value = useMemo<WorkspaceUiContextValue>(() => ({
    view,
    canGoBack, canGoForward, navigate, goBack, goForward,
    isMobile, electronChrome, viewportWidth, chromeToolbarReserve,
    sidebarVisible, sidebarInlineVisible, sidebarOverlayMode, sidebarWidth, sidebarDragging,
    beginSidebarDrag, drawerOpen, openDrawer, closeDrawer,
    toggleSidebar, toggleSidebarVisible: toggleVisible, setSidebarVisible, revealSidebar, closeSidebarOverlay,
    settingsSidebarVisible, setSettingsSidebarVisible, settingsSidebarWidth, settingsSidebarDragging, beginSettingsSidebarDrag,
    splitEnabled, rightPanelVisible, chatVisible, rightPanelWidth, chatWidth,
    showSplitter, isSplitDragging: isDragging, canToggleChatColumn, paneMode: mode,
    workspaceRef, beginSplitDrag: beginDrag, toggleRightPanel, toggleChatColumn, restoreChatColumn, openMarket: openMarketPanel, workspaceMinWidth,
    previewTarget: preview, previewAutoOpenDismissed,
    openFilePreview, openPreviewTarget, setPreviewTarget: setPreview,
    markPreviewAutoOpenDismissed, resetPreviewAutoOpenState, closePreview, onPeerSlideSettled,
    mobileRightSheet, mobileSheetOpen, openMobileSheet, openMobileMarketPanel, closeMobileRightSheet,
  }), [
    view, canGoBack, canGoForward, navigate, goBack, goForward,
    isMobile, electronChrome, viewportWidth, chromeToolbarReserve,
    sidebarVisible, sidebarInlineVisible, sidebarOverlayMode, sidebarWidth, sidebarDragging,
    beginSidebarDrag, drawerOpen, openDrawer, closeDrawer,
    toggleSidebar, toggleVisible, setSidebarVisible, revealSidebar, closeSidebarOverlay,
    settingsSidebarVisible, setSettingsSidebarVisible, settingsSidebarWidth, settingsSidebarDragging, beginSettingsSidebarDrag,
    splitEnabled, rightPanelVisible, chatVisible, rightPanelWidth, chatWidth,
    showSplitter, isDragging, canToggleChatColumn, mode,
    workspaceRef, beginDrag, toggleRightPanel, toggleChatColumn, restoreChatColumn, openMarketPanel, workspaceMinWidth,
    preview, previewAutoOpenDismissed,
    openFilePreview, openPreviewTarget, setPreview,
    markPreviewAutoOpenDismissed, resetPreviewAutoOpenState, closePreview, onPeerSlideSettled,
    mobileRightSheet, mobileSheetOpen, openMobileSheet, openMobileMarketPanel, closeMobileRightSheet,
  ])

  return (
    <WorkspaceUiContext.Provider value={value}>
      {children}
    </WorkspaceUiContext.Provider>
  )
}
