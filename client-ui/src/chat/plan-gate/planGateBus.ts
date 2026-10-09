import type { ResearchFetchPlan } from '@opptrix/shared/research-query-plan'

/** 取数计划确认（方案 B）：服务端在 query_data 执行前推来的计划，按会话保留最新一条 */
export interface PlanGateEvent {
  sessionId: string
  stepId: string
  plan: ResearchFetchPlan
  autoContinueMs: number
  receivedAt?: number
}

type Listener = () => void

const latest = new Map<string, PlanGateEvent>()
const listeners = new Set<Listener>()

export function publishPlanGate(event: PlanGateEvent): void {
  latest.set(event.sessionId, { ...event, receivedAt: event.receivedAt ?? Date.now() })
  for (const listener of listeners) listener()
}

export function readPlanGate(sessionId: string | null): PlanGateEvent | null {
  return sessionId ? latest.get(sessionId) ?? null : null
}

export function clearPlanGate(sessionId: string): void {
  if (latest.delete(sessionId)) for (const listener of listeners) listener()
}

export function subscribePlanGate(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
