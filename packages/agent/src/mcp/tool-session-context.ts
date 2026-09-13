import { AsyncLocalStorage } from 'node:async_hooks'

interface ToolSessionStore {
  sessionId: string
  toolCallId?: string
}

/** 工具调用期间的会话上下文（避免全局 bridge 在并发/打断重发时串台） */
const toolSessionAls = new AsyncLocalStorage<ToolSessionStore>()

export function runInToolSession<T>(
  sessionId: string,
  fn: () => Promise<T>,
  toolCallId?: string,
): Promise<T> {
  const store: ToolSessionStore = { sessionId }
  if (toolCallId?.trim()) store.toolCallId = toolCallId.trim()
  return toolSessionAls.run(store, fn)
}

export function currentToolSessionId(): string | undefined {
  return toolSessionAls.getStore()?.sessionId
}

export function currentToolCallId(): string | undefined {
  return toolSessionAls.getStore()?.toolCallId
}
