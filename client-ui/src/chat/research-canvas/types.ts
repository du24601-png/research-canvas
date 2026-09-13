import type { ChartStyle } from '@opptrix/shared/research-chart-style'

export type WidgetType =
  | 'line_chart'
  | 'bar_chart'
  | 'grouped_bar'
  | 'stacked_bar'
  | 'stacked_bar_percent'
  | 'combo_bar_line'
  | 'pie_chart'
  | 'donut_chart'
  | 'candlestick'
  | 'heatmap_table'
  | 'table'
  | 'sources'

export const WIDGET_TYPE_LIST: readonly WidgetType[] = [
  'line_chart',
  'bar_chart',
  'grouped_bar',
  'stacked_bar',
  'stacked_bar_percent',
  'combo_bar_line',
  'pie_chart',
  'donut_chart',
  'candlestick',
  'heatmap_table',
  'table',
  'sources',
]

export const WIDGET_TYPE_SET = new Set<WidgetType>(WIDGET_TYPE_LIST)

export interface Widget {
  id: string
  type: WidgetType
  title: string
  datasetId: string
  /** 聊天预览 adopt 来源；画布删除后可据此恢复「添加到画布」 */
  sourceProposalId?: string
  view?: {
    intent?: 'trend' | 'rank' | 'compare' | 'composition' | 'price'
    period?: string
    topN?: number
  }
  style?: ChartStyle
}

export interface CanvasLayoutItem {
  i: string
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
}

export interface ResearchEntity {
  id: string
  name: string
  ticker: string
  market: 'CN'
  type: 'equity' | 'group'
  memberIds?: string[]
}

export interface ResearchDataPoint {
  entityId: string
  period: string
  value: number | null
}

export interface ResearchOhlcBar {
  entityId: string
  time: string
  open: number
  high: number
  low: number
  close: number
  volume?: number | null
}

export interface ResearchSource {
  provider: string
  entityId: string
  metric: string
  period?: string
  fetchedAt: string
  sourceUrl?: string
  fieldLabel?: string
}

export interface ResearchDatasetQuery {
  entities: string[]
  metric: string
  start: string
  end: string
}

export type DatasetTransform =
  | { type: 'filter_entities'; removedEntityIds: string[] }
  | { type: 'add_entities'; addedEntityIds: string[] }
  | { type: 'filter_period'; start: string; end: string }
  | {
    type: 'aggregate_groups'
    method: 'arithmetic_mean'
    groups: Array<{ id: string; name: string; memberIds: string[] }>
  }

export interface Dataset {
  id: string
  title: string
  metric: string
  unit: string
  entities: ResearchEntity[]
  periods: string[]
  data: ResearchDataPoint[]
  ohlc?: ResearchOhlcBar[]
  sources: ResearchSource[]
  query?: ResearchDatasetQuery
  parentDatasetId?: string
  transform?: DatasetTransform
  createdAt?: string
}

export interface PersistedCanvasState {
  version: 2
  widgets: Widget[]
  layout: CanvasLayoutItem[]
  datasets: Dataset[]
  acceptedProposalIds?: string[]
}
