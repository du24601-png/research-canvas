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
import { getChartRendererOnce } from './chartRendererFlag'
import VegaChart from './vega/VegaChart'
import { isVegaSupported } from './vega/buildVegaSpec'
import type { Dataset, Widget, WidgetType } from './types'

interface Props {
  type: WidgetType
  dataset: Dataset
  period?: string
  topN?: number
  style?: Widget['style']
}

/** 默认 ECharts；localStorage `finframe.chartRenderer`='vega'（页面加载时读取一次）时受支持的图种改用 Vega-Lite（失败自动退回） */
export default function PreviewPlot(props: Props) {
  const echarts = <EchartsPlot {...props} />
  if (!isVegaSupported(props.type) || getChartRendererOnce() !== 'vega') return echarts
  return <VegaChart {...props} fallback={echarts} />
}

function EchartsPlot({ type, dataset, period, topN, style }: Props) {
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
