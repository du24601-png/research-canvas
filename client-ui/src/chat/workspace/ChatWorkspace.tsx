import { mergeClasses } from '@fluentui/react-components'
import type { ReactNode } from 'react'
import ChatView from '../ChatView'
import RightPanel from '../RightPanel'
import WorkspaceSplitDivider from '../WorkspaceSplitDivider'
import type { ChatAttachmentMeta } from '../../types/chat'
import { WORKSPACE_CHAT_MIN_WIDTH } from '../../desktop/constants'
import { useMobileSlideStyles, useWorkspaceUi } from './WorkspaceUiContext'
import { useWorkspaceShellStyles } from './workspaceShellStyles'
import type { ChatColumnSharedProps } from './useChatColumnSharedProps'

export interface ChatWorkspaceProps {
  /** 当前路由是否落在聊天视图 */
  active: boolean
  /** settings / 独立视图等宿主侧隐藏条件（keep-alive，不卸载） */
  hidden: boolean
  drawerSidebar: ReactNode
  chat: ChatColumnSharedProps
  titleSlot: ReactNode
  overlaySlot: ReactNode
  contextHint: string
  previewSessionId: string | null
  onSelectPreviewAttachment: (attachment: ChatAttachmentMeta) => void
  onOpenMobileFilesPanel: () => void
}

/**
 * 聊天工作区：mobile 三段轨道（drawer | ChatView | RightPanel sheet）
 * 与 desktop 分栏（chatColumn | splitter | RightPanel）。
 * mobile / desktop 的开关语义差异是故意的，逐项对应原实现。
 */
export function ChatWorkspace({
  active,
  hidden,
  drawerSidebar,
  chat,
  titleSlot,
  overlaySlot,
  contextHint,
  previewSessionId,
  onSelectPreviewAttachment,
  onOpenMobileFilesPanel,
}: ChatWorkspaceProps) {
  const s = useWorkspaceShellStyles()
  const ui = useWorkspaceUi()
  const { trackStyle, mainStyle, rightSheetStyle } = useMobileSlideStyles()
  const viewHidden = !active || hidden

  return (
    <div
      ref={ui.workspaceRef}
      className={mergeClasses(
        s.contentWorkspace,
        ui.isMobile && s.contentWorkspaceMobile,
        ui.electronChrome && s.contentWorkspaceElectron,
        ui.electronChrome && 'opptrix-app-main',
        viewHidden && s.viewHidden,
      )}
      aria-hidden={viewHidden}
    >
      {ui.isMobile ? (
        <div className={s.mobileSlideTrack} style={trackStyle}>
          {!viewHidden ? drawerSidebar : null}

          <div
            className={mergeClasses(s.chatColumn, s.mobileSlideMain)}
            style={mainStyle}
            onClick={ui.drawerOpen ? ui.closeDrawer : undefined}
          >
            <div className={s.chatPanel}>
              <ChatView
                {...chat}
                titleSlot={titleSlot}
                overlaySlot={overlaySlot}
                contextHint={contextHint}
                isMobile
                onOpenSidebar={ui.toggleSidebar}
                onToggleSidebar={undefined}
                rightPanelOpen={ui.mobileRightSheet === 'market'}
                onToggleRightPanel={undefined}
                onToggleChatColumn={undefined}
                sessionFilesPreviewOpen={ui.mobileRightSheet === 'preview'}
                onOpenMobileMarketPanel={ui.openMobileMarketPanel}
                onOpenMobileFilesPanel={onOpenMobileFilesPanel}
              />
            </div>
          </div>

          <div
            className={s.mobileRightSheet}
            style={rightSheetStyle}
            role="dialog"
            aria-modal={ui.mobileSheetOpen}
            aria-label={ui.mobileRightSheet === 'preview' ? '文件预览' : '研究画布'}
            aria-hidden={!ui.mobileSheetOpen}
          >
            <div className={s.mobileRightSheetInner}>
              <RightPanel
                visible
                fullWidth
                transitionEnabled={false}
                onToggleRightPanel={ui.mobileSheetOpen ? ui.closeMobileRightSheet : undefined}
                previewMode={ui.mobileRightSheet === 'preview'}
                preview={ui.previewTarget}
                previewSessionId={previewSessionId}
                onSelectAttachment={onSelectPreviewAttachment}
                onClosePreview={ui.closeMobileRightSheet}
              />
            </div>
          </div>
        </div>
      ) : (
        <>
          {ui.chatVisible && (
            <div
              className={mergeClasses(
                s.chatColumn,
                ui.electronChrome && s.chatColumnElectron,
                ui.isSplitDragging && s.chatColumnDragging,
              )}
              style={
                ui.isSplitDragging && ui.showSplitter
                  ? {
                      flex: '0 0 auto',
                      width: ui.chatWidth,
                      minWidth: ui.chatWidth,
                    }
                  : {
                      flex: 1,
                      width: undefined,
                      minWidth: ui.showSplitter ? WORKSPACE_CHAT_MIN_WIDTH : 0,
                    }
              }
            >
              {ui.electronChrome && (
                <div className={mergeClasses(s.chatTitleBar, 'opptrix-chat-title-bar')} aria-hidden />
              )}
              <div className={mergeClasses(s.chatPanel, ui.electronChrome && 'opptrix-chat-panel')}>
                <ChatView
                  {...chat}
                  titleSlot={titleSlot}
                  overlaySlot={overlaySlot}
                  contextHint={contextHint}
                  onOpenSidebar={ui.toggleSidebarVisible}
                  onToggleSidebar={undefined}
                  rightPanelOpen={ui.rightPanelVisible}
                  onToggleRightPanel={ui.toggleRightPanel}
                  onToggleChatColumn={ui.canToggleChatColumn ? ui.toggleChatColumn : undefined}
                  sessionFilesPreviewOpen={ui.paneMode === 'preview'}
                />
              </div>
            </div>
          )}

          {ui.showSplitter && (
            <WorkspaceSplitDivider
              electronChrome={ui.electronChrome}
              extendIntoSecondaryChrome={ui.electronChrome}
              isDragging={ui.isSplitDragging}
              onBeginDrag={ui.beginSplitDrag}
            />
          )}

          <RightPanel
            visible={ui.rightPanelVisible}
            width={ui.rightPanelWidth}
            fullWidth={!ui.chatVisible}
            transitionEnabled={!ui.isSplitDragging}
            electronChrome={ui.electronChrome}
            chatColumnVisible={ui.chatVisible}
            chromeToolbarReserve={ui.chromeToolbarReserve}
            onToggleRightPanel={ui.toggleRightPanel}
            onToggleChatColumn={ui.canToggleChatColumn ? ui.toggleChatColumn : undefined}
            previewMode={ui.paneMode === 'preview'}
            preview={ui.previewTarget}
            previewSessionId={previewSessionId}
            onSelectAttachment={onSelectPreviewAttachment}
            onClosePreview={ui.closePreview}
            onSlideTransitionEnd={ui.onPeerSlideSettled}
          />
        </>
      )}
    </div>
  )
}
