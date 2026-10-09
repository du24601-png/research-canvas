import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { renderWithProviders } from '../../test/testUtils'
import { CHAT_FIRST_STORAGE_KEY } from '../pin-board/chatFirstLayout'
import type { ChatColumnSharedProps } from './useChatColumnSharedProps'

const chatViewProps: Array<Record<string, unknown>> = []
const rightPanelProps: Array<Record<string, unknown>> = []

vi.mock('../ChatView', () => ({
  default: (props: Record<string, unknown>) => {
    chatViewProps.push(props)
    return <div data-testid="chat-view">{props.headerTrailing as ReactNode}</div>
  },
}))
vi.mock('../RightPanel', () => ({
  default: (props: Record<string, unknown>) => {
    rightPanelProps.push(props)
    return <div data-testid="right-panel" data-visible={String(props.visible)} />
  },
}))
vi.mock('../WorkspaceSplitDivider', () => ({ default: () => <div data-testid="splitter" /> }))
vi.mock('../pin-board/PinBoardDrawer', () => ({ default: () => <div data-testid="pin-board-drawer" /> }))
vi.mock('./WorkspaceUiContext', () => ({
  useMobileSlideStyles: () => ({}),
  useWorkspaceUi: () => ({
    isMobile: false,
    electronChrome: false,
    chatVisible: true,
    presentMode: false,
    isSplitDragging: false,
    showSplitter: true,
    rightPanelVisible: true,
    paneMode: 'market',
    rightPanelWidth: 640,
    chatWidth: 480,
    canToggleChatColumn: true,
    toggleRightPanel: () => {},
    toggleChatColumn: () => {},
    toggleSidebarVisible: () => {},
  }),
}))

async function renderWorkspace() {
  const { ChatWorkspace } = await import('./ChatWorkspace')
  const chat = { sessionId: 'sess-layout', title: '测试会话' } as unknown as ChatColumnSharedProps
  return renderWithProviders(
    <ChatWorkspace
      active
      hidden={false}
      drawerSidebar={null}
      chat={chat}
      titleSlot={null}
      overlaySlot={null}
      contextHint=""
      previewSessionId={null}
      onSelectPreviewAttachment={() => {}}
      onOpenMobileFilesPanel={() => {}}
    />,
  )
}

describe('ChatWorkspace layout flag', () => {
  beforeEach(() => {
    chatViewProps.length = 0
    rightPanelProps.length = 0
    window.localStorage.clear()
  })
  afterEach(() => cleanup())

  it('chat-first (default): no canvas column, board button and drawer instead', async () => {
    await renderWorkspace()
    const panel = rightPanelProps.at(-1) ?? {}
    expect(panel.visible).toBe(false)
    expect(panel.canvasEnabled).toBe(false)
    expect(screen.queryByTestId('splitter')).toBeNull()
    expect(screen.getByTestId('pin-board-drawer')).toBeTruthy()
    expect(screen.getByRole('button', { name: /看板/ })).toBeTruthy()
    expect(chatViewProps.at(-1)?.onToggleRightPanel).toBeUndefined()
  })

  it('flag off restores the two-column research canvas', async () => {
    window.localStorage.setItem(CHAT_FIRST_STORAGE_KEY, '0')
    await renderWorkspace()
    const panel = rightPanelProps.at(-1) ?? {}
    expect(panel.visible).toBe(true)
    expect(panel.canvasEnabled).toBe(true)
    expect(screen.getByTestId('splitter')).toBeTruthy()
    expect(screen.queryByTestId('pin-board-drawer')).toBeNull()
    expect(screen.queryByRole('button', { name: /看板/ })).toBeNull()
    expect(typeof chatViewProps.at(-1)?.onToggleRightPanel).toBe('function')
  })
})
