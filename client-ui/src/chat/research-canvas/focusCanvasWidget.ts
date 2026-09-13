import type { ProposalFingerprint } from './proposalCanvasLink'
import { widgetMatchesProposal } from './proposalCanvasLink'
import type { Widget } from './types'

export function findWidgetForProposal(
  widgets: readonly Widget[],
  proposal: ProposalFingerprint,
): Widget | undefined {
  return widgets.find(widget => widgetMatchesProposal(widget, proposal))
}
