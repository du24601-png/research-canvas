import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { readPersistedCanvasState } from '../research-canvas/layoutStorage'
import { subscribeResearchCanvasEvents } from '../research-canvas/researchCanvasBus'

/**
 * 对话优先布局下的「看板」状态：开关抽屉 + 已钉住数量。
 * 看板内容就是原研究画布的状态与持久化（adoptProposal 写入），这里只管展示开合。
 * 没有 Provider 时 chatFirst=false，组件按旧的双栏文案工作。
 */
export interface PinBoardContextValue {
  chatFirst: boolean
  open: boolean
  pinnedCount: number
  openBoard: () => void
  closeBoard: () => void
  toggleBoard: () => void
}

const NOOP = () => {}

const PinBoardContext = createContext<PinBoardContextValue>({
  chatFirst: false,
  open: false,
  pinnedCount: 0,
  openBoard: NOOP,
  closeBoard: NOOP,
  toggleBoard: NOOP,
})

const COUNT_EVENTS = new Set(['widget_adopted', 'widget_deleted', 'canvas_restored', 'widget_created', 'widget_updated'])

function usePinnedCount(sessionId: string | null): number {
  const read = useCallback(() => readPersistedCanvasState(sessionId).widgets.length, [sessionId])
  const [count, setCount] = useState(read)
  useEffect(() => {
    setCount(read())
    return subscribeResearchCanvasEvents((event) => {
      const type = typeof event === 'object' && event !== null ? (event as { type?: unknown }).type : null
      if (typeof type !== 'string' || !COUNT_EVENTS.has(type)) return
      // 画布监听器先落盘，下一拍再读
      window.setTimeout(() => setCount(read()), 0)
    })
  }, [read])
  return count
}

export function PinBoardProvider({ chatFirst, sessionId, children }: {
  chatFirst: boolean
  sessionId: string | null
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const pinnedCount = usePinnedCount(sessionId)
  const openBoard = useCallback(() => setOpen(true), [])
  const closeBoard = useCallback(() => setOpen(false), [])
  const toggleBoard = useCallback(() => setOpen(prev => !prev), [])
  useEffect(() => setOpen(false), [sessionId])
  useEffect(() => {
    if (!chatFirst) return undefined
    document.body.setAttribute('data-finframe-chat-first', '')
    return () => document.body.removeAttribute('data-finframe-chat-first')
  }, [chatFirst])
  const value = useMemo<PinBoardContextValue>(() => ({
    chatFirst, open: chatFirst && open, pinnedCount, openBoard, closeBoard, toggleBoard,
  }), [chatFirst, open, pinnedCount, openBoard, closeBoard, toggleBoard])
  return <PinBoardContext.Provider value={value}>{children}</PinBoardContext.Provider>
}

export function usePinBoard(): PinBoardContextValue {
  return useContext(PinBoardContext)
}
