import { memo } from 'react'
import WidgetFrame from './WidgetFrame'
import BarChartWidget from './BarChartWidget'
import GroupedBarChartWidget from './GroupedBarChartWidget'
import HeatmapWidget from './HeatmapWidget'
import LineChartWidget from './LineChartWidget'
import SourcesWidget from './SourcesWidget'
import TableWidget from './TableWidget'
import { ViewSwitcher, type ViewSwitchValue } from './ViewSwitcher'
import {
  CandlestickChartWidget,
  ComboBarLineChartWidget,
  PieDonutChartWidget,
  StackedBarChartWidget,
} from './ExtraChartWidgets'
import { datasetMetaLine } from './datasetLabels'
import DatasetEvidence from './DatasetEvidence'
import ResearchRecovery from './ResearchRecovery'
import type { Dataset, Widget } from './types'

interface Props {
  widget: Widget
  dataset: Dataset | undefined
  selected?: boolean
  focusPulse?: boolean
  adoptEnter?: boolean
  readonly?: boolean
  onSelect: (widget: Widget) => void
  onDelete: (widgetId: string) => void
  onChangeView?: (widgetId: string, next: ViewSwitchValue) => void
}

function renderChartBody(widget: Widget, dataset: Dataset) {
  const period = widget.view?.period
  const topN = widget.view?.topN
  const style = widget.style
  switch (widget.type) {
    case 'line_chart':
      return <LineChartWidget dataset={dataset} topN={topN} style={style} />
    case 'bar_chart':
      return <BarChartWidget dataset={dataset} period={period} style={style} />
    case 'grouped_bar':
      return <GroupedBarChartWidget dataset={dataset} style={style} />
    case 'stacked_bar':
      return <StackedBarChartWidget dataset={dataset} percent={false} />
    case 'stacked_bar_percent':
      return <StackedBarChartWidget dataset={dataset} percent />
    case 'combo_bar_line':
      return <ComboBarLineChartWidget dataset={dataset} />
    case 'pie_chart':
      return <PieDonutChartWidget dataset={dataset} donut={false} period={period} />
    case 'donut_chart':
      return <PieDonutChartWidget dataset={dataset} donut period={period} />
    case 'candlestick':
      return <CandlestickChartWidget dataset={dataset} />
    case 'heatmap_table':
      return <HeatmapWidget dataset={dataset} />
    case 'table':
      return <TableWidget dataset={dataset} />
    case 'sources':
      return <SourcesWidget dataset={dataset} />
  }
}

function ResearchCanvasWidget({
  widget,
  dataset,
  selected = false,
  focusPulse = false,
  adoptEnter = false,
  readonly = false,
  onSelect,
  onDelete,
  onChangeView,
}: Props) {
  if (!dataset) {
    return (
      <WidgetFrame
        title={widget.title}
        selected={selected}
        focusPulse={focusPulse}
        adoptEnter={adoptEnter}
        readonly={readonly}
        onSelect={() => onSelect(widget)}
        onDelete={readonly ? undefined : () => onDelete(widget.id)}
      >
        <ResearchRecovery title={widget.title} missingData />
      </WidgetFrame>
    )
  }

  const metaLine = datasetMetaLine(dataset)
  return (
    <WidgetFrame
      title={widget.title}
      metaLine={metaLine || undefined}
      selected={selected}
      focusPulse={focusPulse}
      adoptEnter={adoptEnter}
      readonly={readonly}
      onSelect={() => onSelect(widget)}
      onDelete={readonly ? undefined : () => onDelete(widget.id)}
      toolbar={widget.type === 'sources' ? undefined : (
        <>
          {!readonly && onChangeView ? (
            <ViewSwitcher
              dataset={dataset}
              type={widget.type}
              period={widget.view?.period}
              onChange={next => onChangeView(widget.id, next)}
            />
          ) : null}
          <DatasetEvidence dataset={dataset} />
        </>
      )}
    >
      {renderChartBody(widget, dataset)}
    </WidgetFrame>
  )
}

export default memo(ResearchCanvasWidget)
