import { resolveResearchMetric, type ResearchMetric } from './research-metrics.js'

export type ResearchFetchPlanTier = 'auto' | 'must_confirm'

export interface ResearchFetchPlan {
  entities: string[]
  metric: string
  metricLabel: string
  start: string
  end: string
  statement: string
  tier: ResearchFetchPlanTier
  autoConfirmMs?: number
}

export interface ResearchFetchPlanQuery {
  entities: string[]
  metric: string
  start: string
  end: string
}

const AUTO_CONFIRM_ENTITY_LIMIT = 3
export const RESEARCH_FETCH_AUTO_CONFIRM_MS = 3000

export function classifyResearchFetchPlanTier(entityCount: number): ResearchFetchPlanTier {
  return entityCount <= AUTO_CONFIRM_ENTITY_LIMIT ? 'auto' : 'must_confirm'
}

export function buildResearchFetchStatement(input: {
  entityNames: readonly string[]
  metricLabel: string
  start: string
  end: string
  metricId: string
}): string {
  const names = input.entityNames.filter(name => name.trim())
  const companyPart = names.length ? names.join('、') : '所选公司'
  const periodPart = input.start === input.end
    ? `${input.start} 年`
    : `${input.start}–${input.end} 年`
  if (input.metricId === 'kline') {
    return `查 ${companyPart} 的日K，${periodPart}`
  }
  return `查 ${companyPart}，${input.metricLabel}，${periodPart}年报`
}

export function buildResearchFetchPlan(input: {
  entityNames: readonly string[]
  metric: ResearchMetric
  start: string
  end: string
}): ResearchFetchPlan {
  const tier = classifyResearchFetchPlanTier(input.entityNames.length)
  const statement = buildResearchFetchStatement({
    entityNames: input.entityNames,
    metricLabel: input.metric.name,
    start: input.start,
    end: input.end,
    metricId: input.metric.id,
  })
  return {
    entities: [...input.entityNames],
    metric: input.metric.id,
    metricLabel: input.metric.name,
    start: input.start,
    end: input.end,
    statement,
    tier,
    ...(tier === 'auto' ? { autoConfirmMs: RESEARCH_FETCH_AUTO_CONFIRM_MS } : {}),
  }
}

export function isQueryDataConfirmed(raw: unknown): boolean {
  return raw === true
}

export function parseResearchFetchPlanPreview(raw: unknown): {
  plan: ResearchFetchPlan
  query: ResearchFetchPlanQuery
} | null {
  if (typeof raw !== 'object' || raw === null) return null
  const record = raw as Record<string, unknown>
  if (record.status !== 'plan_preview' || record.ok !== true) return null
  const planRaw = record.plan
  const queryRaw = record.query
  if (typeof planRaw !== 'object' || planRaw === null) return null
  if (typeof queryRaw !== 'object' || queryRaw === null) return null
  const plan = planRaw as Record<string, unknown>
  const query = queryRaw as Record<string, unknown>
  const entities = Array.isArray(plan.entities)
    ? plan.entities.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
  const metric = typeof plan.metric === 'string' ? plan.metric.trim() : ''
  const metricLabel = typeof plan.metricLabel === 'string' ? plan.metricLabel.trim() : ''
  const start = typeof plan.start === 'string' ? plan.start.trim() : ''
  const end = typeof plan.end === 'string' ? plan.end.trim() : ''
  const statement = typeof plan.statement === 'string' ? plan.statement.trim() : ''
  const tier = plan.tier === 'must_confirm' ? 'must_confirm' : 'auto'
  if (!entities.length || !metric || !metricLabel || !start || !end || !statement) return null
  if (!resolveResearchMetric(metric)) return null
  const queryEntities = Array.isArray(query.entities)
    ? query.entities.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : []
  const queryMetric = typeof query.metric === 'string' ? query.metric.trim() : ''
  const queryStart = typeof query.start === 'string' ? query.start.trim() : ''
  const queryEnd = typeof query.end === 'string' ? query.end.trim() : ''
  if (!queryEntities.length || !queryMetric || !queryStart || !queryEnd) return null
  return {
    plan: {
      entities,
      metric,
      metricLabel,
      start,
      end,
      statement,
      tier,
      ...(typeof plan.autoConfirmMs === 'number' && Number.isFinite(plan.autoConfirmMs)
        ? { autoConfirmMs: plan.autoConfirmMs }
        : tier === 'auto'
          ? { autoConfirmMs: RESEARCH_FETCH_AUTO_CONFIRM_MS }
          : {}),
    },
    query: {
      entities: queryEntities,
      metric: queryMetric,
      start: queryStart,
      end: queryEnd,
    },
  }
}

export function buildQueryDataConfirmSteer(plan: ResearchFetchPlan, query: ResearchFetchPlanQuery): string {
  return [
    `确认按此计划取数：${plan.statement}`,
    '请立即调用 query_data，参数与预览一致，并设置 confirmed 为 true。',
    `entities: ${JSON.stringify(query.entities)}`,
    `metric: ${query.metric}`,
    `start: ${query.start}`,
    `end: ${query.end}`,
  ].join('\n')
}
