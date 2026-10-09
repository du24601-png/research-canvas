/**
 * engine 终答前的最小钩子：客户端要求时（ui_composer）跑一次 Composer，
 * 成功则发 research_ui_spec 事件并返回合成步骤，失败静默（前端保留原预览卡）。
 */
import type { ChatProgressEvent, ChatToolStep } from './chat-progress.js'
import { getTurnCanvasRecords } from './research-canvas-turn-state.js'
import { composeResearchUi, composerStep, turnDatasetIds, type ComposerChat } from './research-ui-composer.js'

export async function runResearchUiComposer(opts: {
  enabled: boolean
  sessionId: string
  task: string
  steps: readonly ChatToolStep[]
  chat: ComposerChat
  emit: (event: ChatProgressEvent) => void
}): Promise<ChatToolStep | null> {
  if (!opts.enabled) return null
  const ids = turnDatasetIds(opts.steps)
  if (!ids.length) return null
  const records = getTurnCanvasRecords(opts.sessionId) ?? []
  const datasets = ids.map(id => records.find(record => record.id === id)).filter(record => record != null)
  if (!datasets.length) return null
  const result = await composeResearchUi({ task: opts.task, datasets, chat: opts.chat })
  if ('error' in result) return null
  const step = composerStep(result.spec, datasets.map(dataset => dataset.id))
  opts.emit({ type: 'research_ui_spec', step })
  return step
}
