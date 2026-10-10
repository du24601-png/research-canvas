/**
 * 「打开文件并跳到第 N 页」的一次性请求：引用 chip 写入，FilePreviewPanel 订阅。
 * 不经 WorkspaceUi 状态，避免为一个页码改动预览目标的整条传递链。
 */
import { useSyncExternalStore } from 'react'

export type DocPageRequest = {
  sessionId: string
  attachmentId: string
  page: number
  /** 每次请求递增，同一页再点也会重新跳转 */
  key: number
  createdAt: number
}

/** 预览没能及时消费（如面板未挂载）时，过期作废，免得之后重开同一文件跳到旧页 */
export const DOC_PAGE_REQUEST_TTL_MS = 15_000

let current: DocPageRequest | null = null
let seq = 0
const listeners = new Set<() => void>()

export function requestDocPage(sessionId: string, attachmentId: string, page: number): void {
  seq += 1
  current = { sessionId, attachmentId, page, key: seq, createdAt: Date.now() }
  notify()
}

/** 跳页完成后调用：只清掉同一次请求，不误清更新的请求 */
export function clearDocPageRequest(key: number): void {
  if (current?.key !== key) return
  current = null
  notify()
}

function notify(): void {
  for (const fn of listeners) fn()
}

export function getDocPageRequest(): DocPageRequest | null {
  return current
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** 当前预览文件对应的跳页请求；不是这份文件时返回 null */
export function useDocPageRequest(
  sessionId: string | undefined,
  attachmentId: string | undefined,
): DocPageRequest | null {
  const req = useSyncExternalStore(subscribe, getDocPageRequest, getDocPageRequest)
  if (!req || !sessionId || !attachmentId) return null
  if (Date.now() - req.createdAt > DOC_PAGE_REQUEST_TTL_MS) return null
  return req.sessionId === sessionId && req.attachmentId === attachmentId ? req : null
}
