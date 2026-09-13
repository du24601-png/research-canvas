import type { WidgetType } from './types'

export interface ResearchAdjustProposal {
  proposalId: string
  type: WidgetType
  title: string
  datasetId: string
}

const draftSinks = new Set<(text: string) => void>()
let pendingAdjust: ResearchAdjustProposal | null = null

export function registerResearchAdjustDraftSink(
  sink: (text: string) => void,
): () => void {
  draftSinks.add(sink)
  return () => {
    draftSinks.delete(sink)
  }
}

export function requestAdjustResearchProposal(proposal: ResearchAdjustProposal): void {
  pendingAdjust = proposal
  const text = `调整「${proposal.title}」：`
  for (const sink of draftSinks) sink(text)
}

export function consumePendingAdjustProposal(): ResearchAdjustProposal | null {
  const next = pendingAdjust
  pendingAdjust = null
  return next
}

export function requestResearchRecovery(title?: string): void {
  pendingAdjust = null
  const text = title
    ? `请重新查询「${title}」所需的真实数据，生成新的研究预览供我确认。`
    : '请重新查询上一条研究问题所需的真实数据，生成新的研究预览供我确认。'
  for (const sink of draftSinks) sink(text)
}
