import type { ChatToolStep } from '../../types/chatProgress'
import type { Widget, WidgetType } from './types'
import { WIDGET_TYPE_SET } from './types'
import { compactChartStyle, sanitizeChartStyle } from '@opptrix/shared/research-chart-style'
import { compactResearchWidgetView, sanitizeResearchWidgetView } from '@opptrix/shared/research-view-params'

const WIDGET_TYPES = WIDGET_TYPE_SET

export interface PreviewProposalMeta {
  id: string
  type: WidgetType
  title: string
  datasetId: string
  view?: Widget['view']
  style?: Widget['style']
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseToolStepJson(raw: string | undefined): Record<string, unknown> | null {
  if (!raw?.trim()) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isRecord(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function asWidgetType(value: unknown): WidgetType | null {
  return typeof value === 'string' && WIDGET_TYPES.has(value as WidgetType)
    ? value as WidgetType
    : null
}

export function proposalMetaFromToolStep(step: ChatToolStep): PreviewProposalMeta | null {
  const result = parseToolStepJson(step.resultDetail)
  const args = parseToolStepJson(step.argsDetail)
  const type = asWidgetType(result?.type) ?? asWidgetType(args?.type)
  const title = typeof result?.title === 'string' && result.title.trim()
    ? result.title.trim()
    : typeof args?.title === 'string' && args.title.trim()
      ? args.title.trim()
      : ''
  const datasetId = typeof result?.datasetId === 'string' && result.datasetId.trim()
    ? result.datasetId.trim()
    : typeof args?.datasetId === 'string' && args.datasetId.trim()
      ? args.datasetId.trim()
      : ''
  if (!type || !title) return null
  const id = typeof result?.proposalId === 'string' && result.proposalId.trim()
    ? result.proposalId.trim()
    : step.id
  const view = compactResearchWidgetView(sanitizeResearchWidgetView(result?.view ?? args?.view))
  const style = compactChartStyle(sanitizeChartStyle(result?.style ?? args?.style))
  return {
    id,
    type,
    title,
    datasetId,
    ...(view ? { view } : {}),
    ...(style ? { style } : {}),
  }
}

export function toolStepHasProposalError(step: ChatToolStep): boolean {
  if (step.status === 'error') return true
  const result = parseToolStepJson(step.resultDetail)
  if (!result) return false
  if (result.ok === false) return true
  return typeof result.error === 'string' && Boolean(result.error)
}
