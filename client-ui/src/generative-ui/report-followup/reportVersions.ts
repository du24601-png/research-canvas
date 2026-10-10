/**
 * 报告追问（FinFrame M4b，开关默认关）：用户引用某段报告（组件或句子）再提问，
 * 这次回答成为那段报告的新版本，旧版本保留。
 * 追问关系只记在本浏览器（与 Dataset 一样），不改接口与会话存储。
 */
import type { ResearchUiBlock } from '@opptrix/shared/research-ui-spec'
import type { Dataset } from '../../chat/research-canvas/types'
import { researchMetricLabel } from '../../chat/research-canvas/sourcePresentation'
import { isUiComposerEnabled } from '../../chat/pin-board/chatFirstLayout'
import type { SessionContextRef } from '../../types/chat'
import { periodRange } from '../types'

/** localStorage `finframe.reportFollowup`='1' 开启；仅在 Composer 生效时有意义 */
export const REPORT_FOLLOWUP_STORAGE_KEY = 'finframe.reportFollowup'
const LINKS_KEY_PREFIX = 'finframe.reportFollowups.'
const LINKS_LIMIT = 50

export function resolveReportFollowup(composerEnabled: boolean, storedValue: string | null): boolean {
  return composerEnabled && storedValue === '1'
}

/** 一次追问：引用的是哪段回答（按 at 锚定），追问原文是什么 */
export interface ReportFollowupLink {
  sourceAt: string
  question: string
}

export interface ReportVersion {
  /** 从 1 开始；1 是原始回答 */
  version: number
  messageIndex: number
  /** 追问原文；v1 没有 */
  question?: string
}

interface VersionMessage {
  role: 'user' | 'assistant'
  content: string
  at: string
}

function linksKey(sessionId: string): string {
  return `${LINKS_KEY_PREFIX}${sessionId}`
}

function isLink(value: unknown): value is ReportFollowupLink {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.sourceAt === 'string' && typeof record.question === 'string'
}

export function readFollowupLinks(sessionId: string): ReportFollowupLink[] {
  try {
    const raw = window.localStorage.getItem(linksKey(sessionId))
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter(isLink) : []
  } catch {
    return []
  }
}

export function recordFollowupLink(sessionId: string, link: ReportFollowupLink): void {
  const question = link.question.trim()
  if (!question || !link.sourceAt) return
  const next = [...readFollowupLinks(sessionId), { sourceAt: link.sourceAt, question }].slice(-LINKS_LIMIT)
  try {
    window.localStorage.setItem(linksKey(sessionId), JSON.stringify(next))
  } catch {
    // 存不下就不记版本关系，回答本身照常显示
  }
}

export function isReportFollowupEnabled(): boolean {
  try {
    return resolveReportFollowup(isUiComposerEnabled(), window.localStorage.getItem(REPORT_FOLLOWUP_STORAGE_KEY))
  } catch {
    return false
  }
}

/** 发送时：开关开、且引用的是一段回答，就记下「这次提问是对那段报告的追问」 */
export function recordFollowupOnSubmit(
  sessionId: string | null,
  contextRef: SessionContextRef | null,
  text: string | undefined,
): void {
  if (!sessionId || !text?.trim() || contextRef?.kind !== 'selection' || contextRef.sourceRole !== 'assistant') return
  if (!isReportFollowupEnabled()) return
  recordFollowupLink(sessionId, { sourceAt: contextRef.anchorAt, question: text })
}

function nextAssistant(messages: readonly VersionMessage[], from: number): number {
  for (let i = from; i < messages.length; i += 1) {
    if (messages[i]?.role === 'assistant') return i
    if (i > from && messages[i]?.role === 'user') return -1
  }
  return -1
}

/**
 * 把追问关系对到消息上：每条链接找原回答之后第一条原文相同、尚未被认领的用户消息，
 * 它后面的那条回答就是新版本。对不上的链接忽略（例如会话被分叉或编辑过）。
 */
export function resolveReportVersions(
  messages: readonly VersionMessage[],
  links: readonly ReportFollowupLink[],
): Map<number, ReportVersion[]> {
  const result = new Map<number, ReportVersion[]>()
  const claimed = new Set<number>()
  for (const link of links) {
    const source = messages.findIndex(m => m.role === 'assistant' && m.at === link.sourceAt)
    if (source < 0) continue
    const userIndex = messages.findIndex((m, i) =>
      i > source && !claimed.has(i) && m.role === 'user' && m.content.trim() === link.question)
    if (userIndex < 0) continue
    const answer = nextAssistant(messages, userIndex)
    if (answer < 0) continue
    claimed.add(userIndex)
    const versions = result.get(source) ?? [{ version: 1, messageIndex: source }]
    versions.push({ version: versions.length + 1, messageIndex: answer, question: link.question })
    result.set(source, versions)
  }
  return result
}

/** 追问回答 → 它是哪段报告的第几版 */
export function followupOrigin(
  versions: ReadonlyMap<number, ReportVersion[]>,
  messageIndex: number,
): { sourceIndex: number; version: number } | null {
  for (const [sourceIndex, list] of versions) {
    const hit = list.find(item => item.version > 1 && item.messageIndex === messageIndex)
    if (hit) return { sourceIndex, version: hit.version }
  }
  return null
}

/** 引用一个组件时放进输入框的说明：只有标题、公司、指标、期间，不带数值 */
export function describeBlockForQuote(block: ResearchUiBlock, getDataset: (id: string) => Dataset | undefined): string {
  const ids = 'datasetIds' in block ? block.datasetIds : [block.datasetId]
  const parts = ids
    .map(getDataset)
    .filter((dataset): dataset is Dataset => Boolean(dataset))
    .map(dataset => `${dataset.entities.map(entity => entity.name).join('、')} ${researchMetricLabel(dataset.metric)}（${periodRange(dataset)}）`)
  const head = block.title ? `「${block.title}」` : '这部分图表'
  return parts.length ? `${head}：${parts.join('；')}` : head
}
