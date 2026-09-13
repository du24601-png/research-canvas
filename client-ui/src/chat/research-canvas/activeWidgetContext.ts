import type { Dataset, Widget } from './types'

export interface ActiveWidgetContext {
  widgetId: string
  type: string
  title: string
  datasetId?: string
  subject?: {
    ticker?: string
    companyName?: string
  }
  period?: {
    from?: string
    to?: string
  }
  metrics?: string[]
}

export function findAddedWidgetId(
  previous: readonly Pick<Widget, 'id'>[],
  next: readonly Pick<Widget, 'id'>[],
): string | null {
  const prevIds = new Set(previous.map(item => item.id))
  const added = next.filter(item => !prevIds.has(item.id))
  return added.length === 1 ? added[0].id : null
}

export function shouldClearSelectionOnCanvasClick(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return !target.closest(
    '.research-canvas-widget, .research-canvas-toolbar, .react-resizable-handle',
  )
}

export function isWidgetSelectionIgnoreTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest('.research-canvas-drag-handle, .research-canvas-no-drag'))
}

function optionalSubject(dataset: Dataset): ActiveWidgetContext['subject'] {
  const entity = dataset.entities[0]
  if (!entity) return undefined
  const ticker = entity.ticker.trim()
  const companyName = entity.name.trim()
  if (!ticker && !companyName) return undefined
  return {
    ...(ticker ? { ticker } : {}),
    ...(companyName ? { companyName } : {}),
  }
}

function optionalPeriod(dataset: Dataset): ActiveWidgetContext['period'] {
  const from = dataset.periods[0]?.trim() ?? ''
  const to = (dataset.periods[dataset.periods.length - 1] ?? from).trim()
  if (!from && !to) return undefined
  return {
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  }
}

export function getActiveWidgetContext(
  widgets: readonly Widget[],
  datasets: readonly Dataset[],
  activeWidgetId: string | null,
): ActiveWidgetContext | null {
  if (!activeWidgetId) return null
  const widget = widgets.find(item => item.id === activeWidgetId)
  if (!widget) return null
  const dataset = datasets.find(item => item.id === widget.datasetId)
  const context: ActiveWidgetContext = {
    widgetId: widget.id,
    type: widget.type,
    title: widget.title,
  }
  if (widget.datasetId) context.datasetId = widget.datasetId
  if (!dataset) return context
  const subject = optionalSubject(dataset)
  if (subject) context.subject = subject
  const period = optionalPeriod(dataset)
  if (period) context.period = period
  const metric = dataset.metric.trim()
  if (metric) context.metrics = [metric]
  return context
}
