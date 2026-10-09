/**
 * 取数计划确认（方案 B，开关默认关）：query_data 执行前先发 research_plan 事件，
 * 短暂倒计时后自动继续；倒计时内用户发来补充说明（现有 soft steer），就跳过本次取数，
 * 让下一轮模型先读用户的修改。只作用于 1–3 家（4 家以上已有 plan_preview 确认流程）。
 */
import { buildResearchFetchPlan, resolveResearchMetric, type ResearchFetchPlan } from '@opptrix/shared'
import type { ChatProgressEvent } from './chat-progress.js'

export const PLAN_AUTO_CONTINUE_MS = 4000
const POLL_MS = 150

export interface PlanGateInput {
  enabled: boolean
  tool: string
  args: Record<string, unknown>
  stepId: string
  emit: (event: ChatProgressEvent) => void
  hasSteer: () => boolean
  signal?: AbortSignal
  waitMs?: number
}

export function planForQueryData(args: Record<string, unknown>): ResearchFetchPlan | null {
  if (args.confirmed === true || args.confirmed === 'true') return null
  const entityNames = Array.isArray(args.entities) ? args.entities.filter((e): e is string => typeof e === 'string' && Boolean(e.trim())) : []
  const metric = resolveResearchMetric(typeof args.metric === 'string' ? args.metric : '')
  const start = typeof args.start === 'string' ? args.start : ''
  const end = typeof args.end === 'string' ? args.end : ''
  if (!entityNames.length || !metric || !start || !end) return null
  const plan = buildResearchFetchPlan({ entityNames, metric, start, end })
  return plan.tier === 'auto' ? plan : null
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** null = 继续执行工具；对象 = 用户在倒计时内调整了计划，作为工具结果返回给模型 */
export async function runPlanGate(input: PlanGateInput): Promise<Record<string, unknown> | null> {
  if (!input.enabled || input.tool !== 'query_data') return null
  const plan = planForQueryData(input.args)
  if (!plan) return null
  const waitMs = input.waitMs ?? PLAN_AUTO_CONTINUE_MS
  input.emit({ type: 'research_plan', stepId: input.stepId, plan, autoContinueMs: waitMs })
  const deadline = Date.now() + waitMs
  while (Date.now() < deadline) {
    if (input.signal?.aborted || input.hasSteer()) break
    await sleep(Math.min(POLL_MS, Math.max(0, deadline - Date.now())))
  }
  if (!input.hasSteer()) return null
  return {
    ok: false,
    status: 'plan_cancelled',
    hint: '用户在取数前调整了计划：先读用户的补充说明，按新要求重新调用 query_data，不要沿用原参数。',
  }
}
