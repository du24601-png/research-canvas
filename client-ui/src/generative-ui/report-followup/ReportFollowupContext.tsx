import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { ChatDisplayMessage, MessageSelection } from '../../types/chat'
import { readFollowupLinks, resolveReportVersions, type ReportVersion } from './reportVersions'

export interface ReportFollowupValue {
  messages: readonly ChatDisplayMessage[]
  /** 原回答下标 → 各版本（含 v1） */
  versions: ReadonlyMap<number, ReportVersion[]>
  /** 把一段报告引用进输入框（与选中文字「引用」同一路径） */
  quote: (selection: MessageSelection) => void
  /** 跳到某条消息 */
  scrollTo: (messageIndex: number) => void
}

const ReportFollowupContext = createContext<ReportFollowupValue | null>(null)
const TurnIndexContext = createContext<number | null>(null)

/** 由对话列表提供；没有提供（旧布局、协作只读、单测）时追问功能整体不出现 */
export function ReportFollowupProvider({ sessionId, messages, quote, scrollTo, children }: {
  sessionId: string | null
  messages: readonly ChatDisplayMessage[]
  quote?: (selection: MessageSelection) => void
  scrollTo: (messageIndex: number) => void
  children: ReactNode
}) {
  const value = useMemo<ReportFollowupValue | null>(() => {
    if (!sessionId || !quote) return null
    return { messages, versions: resolveReportVersions(messages, readFollowupLinks(sessionId)), quote, scrollTo }
  }, [messages, quote, scrollTo, sessionId])
  return <ReportFollowupContext.Provider value={value}>{children}</ReportFollowupContext.Provider>
}

/** 历史消息里的一轮回答知道自己的下标；实时流式的那轮没有 */
export function TurnIndexProvider({ index, children }: { index: number; children: ReactNode }) {
  return <TurnIndexContext.Provider value={index}>{children}</TurnIndexContext.Provider>
}

export function useReportFollowup(): ReportFollowupValue | null {
  return useContext(ReportFollowupContext)
}

export function useTurnIndex(): number | null {
  return useContext(TurnIndexContext)
}
