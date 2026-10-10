import { memo } from 'react'
import WidgetFrame from './WidgetFrame'
import PreviewPlot from './PreviewPlot'
import { ViewSwitcher, type ViewSwitchValue } from './ViewSwitcher'
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
      <PreviewPlot
        type={widget.type}
        dataset={dataset}
        period={widget.view?.period}
        topN={widget.view?.topN}
        style={widget.style}
      />
    </WidgetFrame>
  )
}

export default memo(ResearchCanvasWidget)
