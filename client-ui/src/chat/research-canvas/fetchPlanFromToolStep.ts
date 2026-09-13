import type { ChatToolStep } from '../../types/chatProgress'
import {
  parseResearchFetchPlanPreview,
  type ResearchFetchPlan,
  type ResearchFetchPlanQuery,
} from '@opptrix/shared/research-query-plan'
import { parseToolStepJson } from './proposalFromToolStep'

export function fetchPlanFromToolStep(step: ChatToolStep): {
  plan: ResearchFetchPlan
  query: ResearchFetchPlanQuery
} | null {
  if (step.tool !== 'query_data' || step.status !== 'done') return null
  const result = parseToolStepJson(step.resultDetail)
  if (!result) return null
  return parseResearchFetchPlanPreview(result)
}
