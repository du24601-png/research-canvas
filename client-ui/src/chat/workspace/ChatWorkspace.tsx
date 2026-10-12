import { mergeClasses } from '@fluentui/react-components'
import { useMemo, type ReactNode } from 'react'
import ChatView from '../ChatView'
import RightPanel from '../RightPanel'
import WorkspaceSplitDivider from '../WorkspaceSplitDivider'
import type { ChatAttachmentMeta } from '../../types/chat'
import { WORKSPACE_CHAT_MIN_WIDTH } from '../../desktop/constants'
import { useMobileSlideStyles, useWorkspaceUi } from './WorkspaceUiContext'
import { useWorkspaceShellStyles } from './workspaceShellStyles'
import type { ChatColumnSharedProps } from './useChatColumnSharedProps'
import { isChatFirstLayout } from '../pin-board/chatFirstLayout'
import { PinBoardProvider, usePinBoard } from '../pin-board/PinBoardContext'
import PinBoardButton from '../pin-board/PinBoardButton'
import PinBoardDrawer from '../pin-board/PinBoardDrawer'

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
 * 聊天工作区。对话优先布局（默认）：对话占满宽度，右栏只用于文件预览，
 * 研究画布收进可展开的右侧看板；关闭开关则恢复原双栏。
 */
export function ChatWorkspace(props: ChatWorkspaceProps) {
  const chatFirst = useMemo(() => isChatFirstLayout(), [])
  return (
    <PinBoardProvider chatFirst={chatFirst} sessionId={props.chat.sessionId ?? null}>
      <ChatWorkspaceBody {...props} />
    </PinBoardProvider>
  )
}

/**
 * mobile 三段轨道（drawer | ChatView | RightPanel sheet）
 * 与 desktop 分栏（chatColumn | splitter | RightPanel）。
 * mobile / desktop 的开关语义差异是故意的，逐项对应原实现。
 */
function ChatWorkspaceBody({
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
  const board = usePinBoard()
  const chatFirst = board.chatFirst
  /** 对话优先：右栏只在文件预览时出现 */
  const rightVisible = chatFirst ? ui.rightPanelVisible && ui.paneMode === 'preview' : ui.rightPanelVisible
  const showSplitter = chatFirst ? ui.showSplitter && rightVisible : ui.showSplitter
  /** 对话优先：不存在「最大化右栏、隐藏对话」的状态 */
  const chatVisible = chatFirst || ui.chatVisible

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
        <>
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
                rightPanelOpen={chatFirst ? board.open : ui.mobileRightSheet === 'market'}
                onToggleRightPanel={undefined}
                onToggleChatColumn={undefined}
                sessionFilesPreviewOpen={ui.mobileRightSheet === 'preview'}
                onOpenMobileMarketPanel={chatFirst ? board.toggleBoard : ui.openMobileMarketPanel}
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
                canvasEnabled={!chatFirst}
                transitionEnabled={false}
                onToggleRightPanel={ui.mobileSheetOpen ? ui.closeMobileRightSheet : undefined}
                previewMode={ui.mobileRightSheet === 'preview'}
                preview={ui.previewTarget}
                previewSessionId={previewSessionId}
                canvasSessionId={chat.sessionId}
                canvasTitle={chat.title}
                onSelectAttachment={onSelectPreviewAttachment}
                onClosePreview={ui.closeMobileRightSheet}
              />
            </div>
          </div>
        </div>
        {chatFirst ? (
          <PinBoardDrawer
            placement="overlay"
            sessionId={chat.sessionId ?? null}
            sessionTitle={chat.title}
          />
        ) : null}
        </>
      ) : (
        <>
          {chatVisible && !ui.presentMode && (
            <div
              className={mergeClasses(
                s.chatColumn,
                ui.electronChrome && s.chatColumnElectron,
                ui.isSplitDragging && s.chatColumnDragging,
              )}
              style={
                ui.isSplitDragging && showSplitter
                  ? {
                      flex: '0 0 auto',
                      width: ui.chatWidth,
                      minWidth: ui.chatWidth,
                    }
                  : {
                      flex: 1,
                      width: undefined,
                      minWidth: showSplitter ? WORKSPACE_CHAT_MIN_WIDTH : 0,
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
                  headerTrailing={chatFirst ? <PinBoardButton /> : undefined}
                  rightPanelOpen={rightVisible}
                  onToggleRightPanel={chatFirst ? undefined : ui.toggleRightPanel}
                  onToggleChatColumn={!chatFirst && ui.canToggleChatColumn ? ui.toggleChatColumn : undefined}
                  sessionFilesPreviewOpen={ui.paneMode === 'preview'}
                />
              </div>
            </div>
          )}

          {showSplitter && !ui.presentMode && (
            <WorkspaceSplitDivider
              electronChrome={ui.electronChrome}
              extendIntoSecondaryChrome={ui.electronChrome}
              isDragging={ui.isSplitDragging}
              onBeginDrag={ui.beginSplitDrag}
            />
          )}

          <RightPanel
            visible={rightVisible}
            canvasEnabled={!chatFirst}
            width={ui.rightPanelWidth}
            fullWidth={!chatVisible || ui.presentMode}
            transitionEnabled={!ui.isSplitDragging}
            electronChrome={ui.electronChrome}
            chatColumnVisible={chatVisible}
            chromeToolbarReserve={ui.chromeToolbarReserve}
            onToggleRightPanel={ui.toggleRightPanel}
            onToggleChatColumn={ui.canToggleChatColumn ? ui.toggleChatColumn : undefined}
            previewMode={ui.paneMode === 'preview'}
            preview={ui.previewTarget}
            previewSessionId={previewSessionId}
            canvasSessionId={chat.sessionId}
            canvasTitle={chat.title}
            onSelectAttachment={onSelectPreviewAttachment}
            onClosePreview={ui.closePreview}
            onSlideTransitionEnd={ui.onPeerSlideSettled}
          />
          {chatFirst ? (
            <PinBoardDrawer
              placement="dock"
              sessionId={chat.sessionId ?? null}
              sessionTitle={chat.title}
            />
          ) : null}
        </>
      )}
    </div>
  )
}
