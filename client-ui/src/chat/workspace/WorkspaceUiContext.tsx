import {
  createContext,
  useContext,
  type CSSProperties,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react'
import type { AppRoute } from '../../hooks/useAppNavigation'
import type { ChatAttachmentMeta } from '../../types/chat'
import type { FilePreviewTarget } from '../FilePreviewPanel'

export type RightPaneViewMode = 'market' | 'preview'
export type MobileRightSheetKind = 'market' | 'preview'

export interface WorkspaceUiContextValue {
  view: AppRoute
  canGoBack: boolean
  canGoForward: boolean
  navigate: (route: AppRoute) => void
  goBack: () => void
  goForward: () => void
  isMobile: boolean
  electronChrome: boolean
  viewportWidth: number
  chromeToolbarReserve: number
  sidebarVisible: boolean
  sidebarInlineVisible: boolean
  sidebarOverlayMode: boolean
  sidebarWidth: number
  sidebarDragging: boolean
  beginSidebarDrag: (clientX: number) => void
  drawerOpen: boolean
  openDrawer: () => void
  closeDrawer: () => void
  /** 原 handleToggleSidebar：settings 视图切设置侧栏，其余走偏好切换（mobile 先收右栏） */
  toggleSidebar: () => void
  /** 原 useSidebarPreference.toggleVisible：desktop 顶栏按钮语义 */
  toggleSidebarVisible: () => void
  setSidebarVisible: (visible: boolean) => void
  revealSidebar: () => void
  closeSidebarOverlay: () => void
  settingsSidebarVisible: boolean
  setSettingsSidebarVisible: Dispatch<SetStateAction<boolean>>
  settingsSidebarWidth: number
  settingsSidebarDragging: boolean
  beginSettingsSidebarDrag: (clientX: number) => void
  splitEnabled: boolean
  rightPanelVisible: boolean
  chatVisible: boolean
  rightPanelWidth: number
  chatWidth: number
  showSplitter: boolean
  isSplitDragging: boolean
  canToggleChatColumn: boolean
  paneMode: RightPaneViewMode
  workspaceRef: RefObject<HTMLDivElement | null>
  beginSplitDrag: (clientX: number) => void
  toggleRightPanel: () => void
  toggleChatColumn: () => void
  restoreChatColumn: () => void
  /** 分栏右栏切到行情并展开（原 useWorkspaceSplit.openMarket） */
  openMarket: () => void
  workspaceMinWidth: number
  previewTarget: FilePreviewTarget | null
  previewAutoOpenDismissed: boolean
  openFilePreview: (sessionId: string, attachment: ChatAttachmentMeta) => void
  openPreviewTarget: (target: FilePreviewTarget | null) => void
  setPreviewTarget: Dispatch<SetStateAction<FilePreviewTarget | null>>
  markPreviewAutoOpenDismissed: () => void
  resetPreviewAutoOpenState: () => void
  closePreview: () => void
  onPeerSlideSettled: () => void
  mobileRightSheet: MobileRightSheetKind | null
  mobileSheetOpen: boolean
  openMobileSheet: (kind: MobileRightSheetKind) => void
  openMobileMarketPanel: () => void
  closeMobileRightSheet: () => void
}

export const WorkspaceUiContext = createContext<WorkspaceUiContextValue | null>(null)

export function useWorkspaceUi(): WorkspaceUiContextValue {
  const value = useContext(WorkspaceUiContext)
  if (!value) {
    throw new Error('useWorkspaceUi 必须在 WorkspaceUiProvider 内使用')
  }
  return value
}

/** 移动端三段轨道几何（与 SessionSidebar drawer / tokens.mobileDrawerWidth 对齐） */
export function useMobileSlideStyles(): {
  drawerPx: number
  trackStyle: CSSProperties
  mainStyle: CSSProperties
  rightSheetStyle: CSSProperties
} {
  const ui = useWorkspaceUi()
  const { isMobile, viewportWidth, mobileSheetOpen, drawerOpen } = ui
  const drawerPx = Math.min(Math.round(viewportWidth * 0.88), 272)
  /** 关闭：主列居中（轨左移 drawer）；开左：轨归零；开右：再左移一个视口 */
  const trackX = !isMobile
    ? 0
    : mobileSheetOpen
      ? -(drawerPx + viewportWidth)
      : drawerOpen
        ? 0
        : -drawerPx
  const trackStyle: CSSProperties = {
    ['--opptrix-mobile-drawer-width' as string]: `${drawerPx}px`,
    transform: `translate3d(${trackX}px, 0, 0)`,
  }
  const mainStyle: CSSProperties = {
    flex: `0 0 ${viewportWidth}px`,
    width: viewportWidth,
  }
  const rightSheetStyle: CSSProperties = {
    flex: `0 0 ${viewportWidth}px`,
    width: viewportWidth,
    pointerEvents: mobileSheetOpen ? 'auto' as const : 'none' as const,
  }
  return { drawerPx, trackStyle, mainStyle, rightSheetStyle }
}
