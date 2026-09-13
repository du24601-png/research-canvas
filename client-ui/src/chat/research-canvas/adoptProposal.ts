import { placeNewWidgetLayout } from './layoutPlacement'
import { hasLiveWidgetForProposal } from './proposalCanvasLink'
import { cloneDataset } from './sessionDatasetSnapshot'
import { resolveLiveResearchDataset } from './layoutStorage'
import type { ChartStyle } from '@opptrix/shared/research-chart-style'
import type { PersistedCanvasState, Widget, WidgetType } from './types'
import { WIDGET_TYPE_SET } from './types'

const WIDGET_TYPES = WIDGET_TYPE_SET

export interface ResearchWidgetProposalInput {
  id: string
  type: WidgetType
  title: string
  datasetId: string
  view?: Widget['view']
  style?: ChartStyle
}

export function adoptProposalIntoState(
  state: PersistedCanvasState,
  proposal: ResearchWidgetProposalInput,
): PersistedCanvasState | null {
  if (!WIDGET_TYPES.has(proposal.type)) return null
  const accepted = state.acceptedProposalIds ?? []
  if (accepted.includes(proposal.id) && hasLiveWidgetForProposal(state, proposal)) return null
  if (!resolveLiveResearchDataset(state, proposal.datasetId)) return null
  const widget: Widget = {
    id: `rc-${crypto.randomUUID()}`,
    type: proposal.type,
    title: proposal.title,
    datasetId: proposal.datasetId,
    sourceProposalId: proposal.id,
    ...(proposal.view ? { view: proposal.view } : {}),
    ...(proposal.style ? { style: proposal.style } : {}),
  }
  const nextAccepted = accepted.includes(proposal.id) ? accepted : [...accepted, proposal.id]
  return {
    version: 2,
    widgets: [...state.widgets, widget],
    layout: [...state.layout, placeNewWidgetLayout(state.layout, widget)],
    datasets: state.datasets.map(dataset => cloneDataset(dataset)),
    acceptedProposalIds: nextAccepted,
  }
}
