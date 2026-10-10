import type { ChatToolStep } from '../types/chatProgress'

export const COMPOSE_STEP_TOOL = 'compose_research_ui'

/** 本轮 Composer 步骤里的原始 Spec（未校验；SpecRenderer 负责校验） */
export function specFromSteps(steps: readonly ChatToolStep[]): unknown {
  const step = [...steps].reverse().find(item => item.tool === COMPOSE_STEP_TOOL && item.status === 'done')
  if (!step?.resultDetail) return null
  try {
    return (JSON.parse(step.resultDetail) as { spec?: unknown }).spec ?? null
  } catch {
    return null
  }
}
