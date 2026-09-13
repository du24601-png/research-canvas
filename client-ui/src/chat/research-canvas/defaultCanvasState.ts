import { autoArrangeLayout } from './layoutPlacement'
import { MOCK_GROSS_MARGIN_DATASET } from './mockGrossMarginDataset'
import type { PersistedCanvasState, Widget } from './types'

const DEFAULT_WIDGETS: Widget[] = [
  {
    id: 'rc-line-gross-margin',
    type: 'line_chart',
    title: '毛利率趋势',
    datasetId: MOCK_GROSS_MARGIN_DATASET.id,
  },
  {
    id: 'rc-bar-gross-margin-2025',
    type: 'bar_chart',
    title: '2025 毛利率排名',
    datasetId: MOCK_GROSS_MARGIN_DATASET.id,
  },
  {
    id: 'rc-table-gross-margin',
    type: 'table',
    title: '数据明细',
    datasetId: MOCK_GROSS_MARGIN_DATASET.id,
  },
  {
    id: 'rc-sources-gross-margin',
    type: 'sources',
    title: '数据来源',
    datasetId: MOCK_GROSS_MARGIN_DATASET.id,
  },
]

export const DEFAULT_CANVAS_STATE: PersistedCanvasState = {
  version: 2,
  widgets: DEFAULT_WIDGETS,
  layout: autoArrangeLayout(DEFAULT_WIDGETS),
  datasets: [],
  acceptedProposalIds: [],
}
