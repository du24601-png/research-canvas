/** 按图种渲染一个数据集；对话预览卡与回答里的组件共用（只换视图，不改数据） */
import BarChartWidget from './BarChartWidget'
import GroupedBarChartWidget from './GroupedBarChartWidget'
import LineChartWidget from './LineChartWidget'
import SourcesWidget from './SourcesWidget'
import TableWidget from './TableWidget'
import {
  CandlestickChartWidget,
  ComboBarLineChartWidget,
  PieDonutChartWidget,
  StackedBarChartWidget,
} from './ExtraChartWidgets'
import HeatmapWidget from './HeatmapWidget'
import type { Dataset, Widget, WidgetType } from './types'

export default function PreviewPlot({ type, dataset, period, topN, style }: {
  type: WidgetType
  dataset: Dataset
  period?: string
  topN?: number
  style?: Widget['style']
}) {
  if (type === 'line_chart') return <LineChartWidget dataset={dataset} topN={topN} style={style} />
  if (type === 'bar_chart') return <BarChartWidget dataset={dataset} period={period} style={style} />
  if (type === 'grouped_bar') return <GroupedBarChartWidget dataset={dataset} style={style} />
  if (type === 'stacked_bar') return <StackedBarChartWidget dataset={dataset} percent={false} />
  if (type === 'stacked_bar_percent') return <StackedBarChartWidget dataset={dataset} percent />
  if (type === 'combo_bar_line') return <ComboBarLineChartWidget dataset={dataset} />
  if (type === 'pie_chart') return <PieDonutChartWidget dataset={dataset} donut={false} period={period} />
  if (type === 'donut_chart') return <PieDonutChartWidget dataset={dataset} donut period={period} />
  if (type === 'candlestick') return <CandlestickChartWidget dataset={dataset} />
  if (type === 'heatmap_table') return <HeatmapWidget dataset={dataset} />
  if (type === 'table') return <TableWidget dataset={dataset} />
  return <SourcesWidget dataset={dataset} />
}
