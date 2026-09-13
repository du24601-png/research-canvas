export const RESEARCH_VIEW_INTENTS = [
  'trend',
  'rank',
  'compare',
  'composition',
  'price',
] as const
export type ResearchViewIntent = (typeof RESEARCH_VIEW_INTENTS)[number]

export interface ResearchWidgetViewParams {
  period?: string
  topN?: number
}

export interface ResearchWidgetView extends ResearchWidgetViewParams {
  intent?: ResearchViewIntent
}

const INTENT_SET = new Set<string>(RESEARCH_VIEW_INTENTS)
const YEAR_RE = /^\d{4}$/
const TOP_N_MAX = 20

export function isResearchViewIntent(value: unknown): value is ResearchViewIntent {
  return typeof value === 'string' && INTENT_SET.has(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseTopN(raw: unknown): number | undefined {
  const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN
  if (!Number.isInteger(value) || value < 1 || value > TOP_N_MAX) return undefined
  return value
}

function parsePeriod(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const period = raw.trim()
  return YEAR_RE.test(period) ? period : undefined
}

export function sanitizeResearchWidgetView(raw: unknown): ResearchWidgetView | undefined {
  if (!isRecord(raw)) return undefined
  const view: ResearchWidgetView = {}
  if (isResearchViewIntent(raw.intent)) view.intent = raw.intent
  const period = parsePeriod(raw.period)
  if (period) view.period = period
  const topN = parseTopN(raw.topN)
  if (topN) view.topN = topN
  return view.intent || view.period || view.topN ? view : undefined
}

export function compactResearchWidgetView(
  view: ResearchWidgetView | undefined,
): ResearchWidgetView | undefined {
  if (!view) return undefined
  const next: ResearchWidgetView = {}
  if (view.intent) next.intent = view.intent
  if (view.period) next.period = view.period
  if (view.topN) next.topN = view.topN
  return next.intent || next.period || next.topN ? next : undefined
}
