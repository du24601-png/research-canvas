/**
 * 会话级冻结 tools — DSH 前缀缓存：首次 chat 全量 pack + 稳定排序，mid-loop 不再变集/变序。
 */

import { allToolPackIds, businessPackIds, defaultSessionPackIds, type ToolPackId } from '@opptrix/shared'
import type { OpenAiTool } from '../tools.js'
import { orderToolsByPreference } from './tool-route-plan.js'
import { toolNamesForPacks } from './tool-pack-session.js'
import {
  filterOpenAiToolsForUnattended,
  filterToolNamesForUnattended,
} from '../unattended.js'
import {
  filterToolNamesForSubagent,
  filterToolsForSubagent,
} from '../subagents/tool-filter.js'

export interface SessionFrozenToolsEntry {
  openAiTools: OpenAiTool[]
  activeNames: readonly string[]
  /** JSON.stringify(openAiTools) — 同会话字节相等校验 */
  toolsJson: string
  schemaGeneration: number
  /** 冻结时是否含 artifacts；切换勾选后须重建 */
  artifactsEnabled: boolean
  /** 冻结时是否含 research_canvas_edit（旧双栏布局）；切换后须重建 */
  canvasEdit?: boolean
}

/** 稳定排序：remoteFirst + 名字典序；禁止 preferred 重排 */
export function orderToolsStable<T extends { function?: { name?: string }; name?: string }>(
  tools: readonly T[],
): T[] {
  return orderToolsByPreference([...tools], [], { remoteFirst: true })
}

export interface SessionPackOptions {
  artifactsEnabled?: boolean
  /** 旧双栏布局（对话优先开关关闭）时由客户端每次请求带上：加载 research_canvas_edit */
  canvasEdit?: boolean
}

/** 默认包 + 用户勾选的 artifacts + 旧布局的 research_canvas_edit；各可选包互不连带 */
export function resolveFullSessionPackIds(opts?: SessionPackOptions): ToolPackId[] {
  const wanted = new Set<ToolPackId>(defaultSessionPackIds())
  if (opts?.artifactsEnabled) wanted.add('artifacts')
  if (opts?.canvasEdit) wanted.add('research_canvas_edit')
  return allToolPackIds().filter(id => wanted.has(id))
}

export function resolveFullSessionToolNames(opts?: SessionPackOptions): string[] {
  return toolNamesForPacks(resolveFullSessionPackIds(opts))
}

export function filterFrozenToolsForSubagent(entry: SessionFrozenToolsEntry): SessionFrozenToolsEntry {
  const activeNames = filterToolNamesForSubagent([...entry.activeNames])
  const openAiTools = filterToolsForSubagent(entry.openAiTools) as OpenAiTool[]
  return {
    openAiTools,
    activeNames,
    toolsJson: JSON.stringify(openAiTools),
    schemaGeneration: entry.schemaGeneration,
    artifactsEnabled: entry.artifactsEnabled,
    canvasEdit: entry.canvasEdit,
  }
}

export function filterFrozenToolsForUnattended(entry: SessionFrozenToolsEntry): SessionFrozenToolsEntry {
  const activeNames = filterToolNamesForUnattended([...entry.activeNames])
  const openAiTools = filterOpenAiToolsForUnattended([...entry.openAiTools])
  return {
    openAiTools,
    activeNames,
    toolsJson: JSON.stringify(openAiTools),
    schemaGeneration: entry.schemaGeneration,
    artifactsEnabled: entry.artifactsEnabled,
    canvasEdit: entry.canvasEdit,
  }
}

export function businessPackIdsForSessionSeed(): ToolPackId[] {
  return businessPackIds()
}
