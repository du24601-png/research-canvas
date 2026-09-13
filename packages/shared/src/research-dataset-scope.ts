import { isResearchDatasetId } from './research-dataset.js'

export const RESEARCH_CANVAS_DATASET_RECORD_LIMIT = 32

export interface ScopedDatasetIdInput {
  activeProposalDatasetId?: string
  widgetDatasetIds?: readonly string[]
  sessionDatasetIds?: readonly string[]
}

function pushUnique(out: string[], seen: Set<string>, raw: unknown): void {
  if (!isResearchDatasetId(raw) || seen.has(raw)) return
  seen.add(raw)
  out.push(raw)
}

/** Priority: active proposal → canvas widgets → session recency (newest first). */
export function rankScopedDatasetIds(input: ScopedDatasetIdInput): string[] {
  const ranked: string[] = []
  const seen = new Set<string>()
  pushUnique(ranked, seen, input.activeProposalDatasetId)
  for (const id of input.widgetDatasetIds ?? []) pushUnique(ranked, seen, id)
  const session = [...(input.sessionDatasetIds ?? [])]
  for (let i = session.length - 1; i >= 0; i -= 1) pushUnique(ranked, seen, session[i])
  return ranked
}

export function selectScopedDatasetIds(
  input: ScopedDatasetIdInput,
  limit: number,
): string[] {
  const cap = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0
  if (cap <= 0) return []
  return rankScopedDatasetIds(input).slice(0, cap)
}
