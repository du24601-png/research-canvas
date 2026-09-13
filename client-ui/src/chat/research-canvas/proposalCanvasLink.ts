import type { PersistedCanvasState, Widget } from './types'

export interface ProposalFingerprint {
  id: string
  type: Widget['type']
  title: string
  datasetId: string
}

export function widgetMatchesProposal(widget: Widget, proposal: ProposalFingerprint): boolean {
  if (widget.sourceProposalId === proposal.id) return true
  return widget.datasetId === proposal.datasetId
    && widget.type === proposal.type
    && widget.title === proposal.title
}

export function hasLiveWidgetForProposal(
  state: Pick<PersistedCanvasState, 'widgets'>,
  proposal: ProposalFingerprint,
): boolean {
  return state.widgets.some(widget => widgetMatchesProposal(widget, proposal))
}
