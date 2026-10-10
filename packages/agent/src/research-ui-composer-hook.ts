/**
 * engine 终答前的最小钩子：客户端要求时（ui_composer）跑一次 Composer，
 * 成功则发 research_ui_spec 事件并返回合成步骤，失败静默（前端保留原预览卡）。
 */
import type { ChatProgressEvent, ChatToolStep } from './chat-progress.js'
import { getTurnCanvasRecords } from './research-canvas-turn-state.js'
import { composeResearchUi, composerStep, turnDatasetIds, type ComposerChat } from './research-ui-composer.js'

/**
 * Composer 输出上限。组件增多后（如个股速览 9 个块、每块带数据集 id），800 会截断 JSON，
 * 部分模型还把推理计入上限，因此放宽到 2400。
 */
export const COMPOSER_MAX_TOKENS = 2400

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
  if ('error' in result) {
    // 失败仍静默回退到预览卡，但留一行服务端日志便于排查（只含校验错误，不含数值或密钥）
    console.warn(`[research-ui-composer] 回退到预览卡：${result.error}`)
    return null
  }
  const step = composerStep(result.spec, datasets.map(dataset => dataset.id))
  opts.emit({ type: 'research_ui_spec', step })
  return step
}
