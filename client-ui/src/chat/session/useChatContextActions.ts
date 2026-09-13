import { useCallback } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { ephemeralAsk } from '../../api/client'
import type {
  EphemeralAskTurn, MessageSelection, SessionContextRef,
} from '../../types/chat'
import type { WorkspaceSearchAction } from '../WorkspaceSearchDialog'
import type { EngineErrorPort } from './engineTypes'

export interface ChatContextActionsPorts {
  restoreChatColumn: () => void
  closeDrawer: () => void
  navigate: (route: 'chat') => void
  view: string
  activeId: string | null
  activeIdRef: MutableRefObject<string | null>
  resolvedSessionModel: string | undefined
  onError: EngineErrorPort
  setContextRef: Dispatch<SetStateAction<SessionContextRef | null>>
  pushComposerDraft: (text: string) => void
  refreshContextUsage: (sessionId: string, opts?: { force?: boolean }) => Promise<void>
  loadSession: (id: string) => Promise<void>
}

export function useChatContextActions(ports: ChatContextActionsPorts) {
  const {
    restoreChatColumn,
    closeDrawer,
    navigate,
    view,
    activeId,
    activeIdRef,
    resolvedSessionModel,
    onError,
    setContextRef,
    pushComposerDraft,
    refreshContextUsage,
    loadSession,
  } = ports

  const handleSearchAction = useCallback(async (action: WorkspaceSearchAction) => {
    if (action.type === 'session') {
      restoreChatColumn()
      closeDrawer()
      try {
        await loadSession(action.sessionId)
        if (view !== 'chat') navigate('chat')
      } catch (e) {
        onError(e instanceof Error ? e.message : '加载对话失败')
      }
      return
    }
    if (action.type === 'stock') {
      restoreChatColumn()
      closeDrawer()
      if (view !== 'chat') navigate('chat')
    }
  }, [
    loadSession,
    navigate,
    onError,
    restoreChatColumn,
    closeDrawer,
    view,
  ])

  const handleEphemeralAsk = useCallback(async (
    message: string,
    selection: MessageSelection,
    priorTurns: EphemeralAskTurn[],
  ) => {
    if (!activeId) throw new Error('无活动对话')
    const { reply } = await ephemeralAsk(
      activeId,
      message,
      selection.text,
      resolvedSessionModel,
      priorTurns,
    )
    return reply
  }, [activeId, resolvedSessionModel])

  return {
    handleSearchAction,
    handleEphemeralAsk,
  }
}
