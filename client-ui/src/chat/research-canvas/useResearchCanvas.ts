import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { Layout } from 'react-grid-layout'
import { findAddedWidgetId } from './activeWidgetContext'
import {
  getActiveWidgetId,
  setActiveWidget,
  subscribeActiveWidget,
} from './activeWidgetSelection'
import { applyResearchCanvasEvent } from './canvasController'
import { publishResearchCanvasEvent, subscribeResearchCanvasEvents } from './researchCanvasBus'
import { nextCommittedLayout } from './layoutCommit'
import { useCanvasRemovalUndo } from './useCanvasRemovalUndo'
import { applyPresetConstraints, autoArrangeLayout } from './layoutPlacement'
import {
  readPersistedCanvasState,
  resolveDatasetFromState,
  syncLayoutItems,
  writePersistedCanvasState,
} from './layoutStorage'
import type { CanvasLayoutItem, Dataset, PersistedCanvasState, Widget } from './types'

export interface UseResearchCanvasOptions {
  readonly?: boolean
  frozenState?: PersistedCanvasState
}

function persistState(sessionId: string | null | undefined, state: PersistedCanvasState): void {
  writePersistedCanvasState(sessionId, {
    version: 2,
    widgets: state.widgets.map(widget => ({ ...widget })),
    layout: state.layout.map(item => ({ ...item })),
    datasets: state.datasets,
    acceptedProposalIds: [...(state.acceptedProposalIds ?? [])],
  })
}

function toRglLayout(layout: readonly CanvasLayoutItem[]): Layout {
  return layout.map(item => ({ ...item }))
}

function fromRglLayout(layout: Layout): CanvasLayoutItem[] {
  return layout.map(item => ({
    i: item.i,
    x: item.x,
    y: item.y,
    w: item.w,
    h: item.h,
    minW: item.minW,
    minH: item.minH,
  }))
}

export function useResearchCanvas(
  sessionId?: string | null,
  options?: UseResearchCanvasOptions,
) {
  const readonly = options?.readonly ?? false
  const initial = useMemo(() => {
    if (options?.frozenState) return options.frozenState
    return readPersistedCanvasState(sessionId)
  }, [options?.frozenState, sessionId])
  const [widgets, setWidgets] = useState<Widget[]>(() => initial.widgets.map(widget => ({ ...widget })))
  const [layout, setLayout] = useState<CanvasLayoutItem[]>(() => (
    applyPresetConstraints(initial.layout, initial.widgets)
  ))
  const [datasets, setDatasets] = useState<Dataset[]>(() => initial.datasets)
  const [acceptedProposalIds, setAcceptedProposalIds] = useState<string[]>(
    () => [...(initial.acceptedProposalIds ?? [])],
  )
  const widgetsRef = useRef(widgets)
  widgetsRef.current = widgets
  const layoutRef = useRef(layout)
  layoutRef.current = layout
  const datasetsRef = useRef(datasets)
  datasetsRef.current = datasets
  const acceptedRef = useRef(acceptedProposalIds)
  acceptedRef.current = acceptedProposalIds
  const sessionIdRef = useRef(sessionId)
  sessionIdRef.current = sessionId
  const interactionRef = useRef(false)
  const persistLive = useCallback((state: PersistedCanvasState) => {
    if (readonly) return
    persistState(sessionIdRef.current, state)
  }, [readonly])

  useEffect(() => {
    if (options?.frozenState) return
    const next = readPersistedCanvasState(sessionId)
    const nextLayout = applyPresetConstraints(next.layout, next.widgets)
    widgetsRef.current = next.widgets.map(widget => ({ ...widget }))
    layoutRef.current = nextLayout
    datasetsRef.current = next.datasets
    acceptedRef.current = [...(next.acceptedProposalIds ?? [])]
    setWidgets(widgetsRef.current)
    setLayout(nextLayout)
    setDatasets(next.datasets)
    setAcceptedProposalIds(acceptedRef.current)
    if (getActiveWidgetId() && !next.widgets.some(widget => widget.id === getActiveWidgetId())) {
      setActiveWidget(null)
    }
  }, [sessionId, options?.frozenState])
  const activeWidgetId = useSyncExternalStore(
    subscribeActiveWidget,
    getActiveWidgetId,
    getActiveWidgetId,
  )

  const snapshotState = useCallback((
    nextWidgets: Widget[],
    nextLayout: CanvasLayoutItem[],
  ): PersistedCanvasState => ({
    version: 2,
    widgets: nextWidgets.map(widget => ({ ...widget })),
    layout: nextLayout,
    datasets: datasetsRef.current,
    acceptedProposalIds: acceptedRef.current,
  }), [])

  const restoreRemoval = useCallback((saved: {
    widgets: Widget[]; layout: CanvasLayoutItem[]; widgetId: string
  }) => {
    widgetsRef.current = saved.widgets
    layoutRef.current = saved.layout
    setWidgets(saved.widgets)
    setLayout(saved.layout)
    persistLive(snapshotState(saved.widgets, saved.layout))
    const restored = saved.widgets.find(widget => widget.id === saved.widgetId)
    if (restored) setActiveWidget({ id: restored.id, title: restored.title })
    publishResearchCanvasEvent({ type: 'canvas_restored' })
  }, [snapshotState, persistLive])
  const { removedTitle, rememberRemoval, clearUndo, undoRemoval } = useCanvasRemovalUndo(restoreRemoval)

  const commitLayout = useCallback((nextLayout: Layout) => {
    if (interactionRef.current) return
    const currentWidgets = widgetsRef.current
    if (currentWidgets.length === 0) {
      if (layoutRef.current.length === 0) return
      layoutRef.current = []
      setLayout([])
      persistLive(snapshotState([], []))
      return
    }

    const synced = applyPresetConstraints(
      syncLayoutItems(fromRglLayout(nextLayout), currentWidgets),
      currentWidgets,
    )
    if (synced.length !== currentWidgets.length) return
    const committed = nextCommittedLayout({
      interactionActive: interactionRef.current,
      current: layoutRef.current,
      incoming: synced,
    })
    if (!committed) return
    layoutRef.current = committed
    setLayout(committed)
    persistLive(snapshotState(currentWidgets, committed))
  }, [snapshotState, persistLive])

  useEffect(() => {
    if (readonly) return () => {}
    return subscribeResearchCanvasEvents((event) => {
      const applied = applyResearchCanvasEvent({
        version: 2,
        widgets: widgetsRef.current,
        layout: layoutRef.current,
        datasets: datasetsRef.current,
        acceptedProposalIds: acceptedRef.current,
      }, event)
      if (!applied) return
      if (applied.widgets.length !== widgetsRef.current.length
        || applied.widgets.some((widget, i) => JSON.stringify(widget) !== JSON.stringify(widgetsRef.current[i]))) clearUndo()
      const addedId = findAddedWidgetId(widgetsRef.current, applied.widgets)
      const nextLayout = applyPresetConstraints(applied.layout, applied.widgets)
      widgetsRef.current = applied.widgets
      layoutRef.current = nextLayout
      datasetsRef.current = applied.datasets
      acceptedRef.current = applied.acceptedProposalIds ?? []
      setWidgets(applied.widgets)
      setLayout(nextLayout)
      setDatasets(applied.datasets)
      setAcceptedProposalIds(applied.acceptedProposalIds ?? [])
      persistLive({ ...applied, layout: nextLayout })
      if (addedId) {
        const added = applied.widgets.find(widget => widget.id === addedId)
        if (added) setActiveWidget({ id: added.id, title: added.title })
      } else if (getActiveWidgetId() && !applied.widgets.some(widget => widget.id === getActiveWidgetId())) {
        setActiveWidget(null)
      }
    })
  }, [clearUndo, persistLive, readonly])

  const handleLayoutChange = useCallback((nextLayout: Layout) => {
    commitLayout(nextLayout)
  }, [commitLayout])

  const handleInteractionStart = useCallback(() => {
    clearUndo()
    interactionRef.current = true
  }, [clearUndo])

  const handleInteractionStop = useCallback((nextLayout: Layout) => {
    interactionRef.current = false
    commitLayout(nextLayout)
  }, [commitLayout])

  const handleAutoArrange = useCallback(() => {
    clearUndo()
    interactionRef.current = false
    const arranged = autoArrangeLayout(widgetsRef.current)
    commitLayout(toRglLayout(arranged))
  }, [commitLayout, clearUndo])

  const handleSelectWidget = useCallback((widget: Widget) => {
    setActiveWidget({ id: widget.id, title: widget.title })
  }, [])

  const handleDeleteWidget = useCallback((widgetId: string) => {
    const widget = widgetsRef.current.find(item => item.id === widgetId)
    if (!widget) return
    const snapshot = {
      title: widget.title, widgetId,
      widgets: widgetsRef.current.map(item => ({ ...item })),
      layout: layoutRef.current.map(item => ({ ...item })),
    }
    publishResearchCanvasEvent({ type: 'widget_deleted', id: widgetId })
    rememberRemoval(snapshot)
  }, [rememberRemoval])

  const handleChangeWidgetView = useCallback((widgetId: string, next: {
    type: Widget['type']
    title: string
    period?: string
    topN?: number
  }) => {
    clearUndo()
    const current = widgetsRef.current
    const widgets = current.map(widget => {
      if (widget.id !== widgetId) return widget
      const view = {
        ...(widget.view ?? {}),
        ...(next.period ? { period: next.period } : {}),
        ...(next.topN ? { topN: next.topN } : {}),
      }
      const patched: Widget = { ...widget, type: next.type, title: next.title }
      if (view.period || view.topN || view.intent) patched.view = view
      return patched
    })
    widgetsRef.current = widgets
    setWidgets(widgets)
    persistLive(snapshotState(widgets, layoutRef.current))
  }, [snapshotState, clearUndo, persistLive])

  const rglLayout = useMemo(() => toRglLayout(layout), [layout])
  const getDataset = useCallback((datasetId: string) => (
    resolveDatasetFromState({ datasets: datasetsRef.current }, datasetId)
  ), [])

  const buildPublishPayload = useCallback((title: string) => ({
    title,
    widgets: widgetsRef.current.map(widget => ({ ...widget })),
    layout: layoutRef.current.map(item => ({ ...item })),
    datasets: datasetsRef.current,
  }), [])

  return {
    widgets,
    layout: rglLayout,
    datasets,
    readonly,
    activeWidgetId,
    getDataset,
    buildPublishPayload,
    handleSelectWidget,
    canvasSnapshot: {
      widgets: widgets.map(widget => ({
        id: widget.id,
        type: widget.type,
        title: widget.title,
        datasetId: widget.datasetId,
      })),
      datasets: datasets.map(dataset => ({
        id: dataset.id,
        metric: dataset.metric,
        title: dataset.title,
        entityNames: dataset.entities.map(entity => entity.name),
        periodRange: dataset.periods.length
          ? `${dataset.periods[0]}–${dataset.periods[dataset.periods.length - 1]}`
          : '',
      })),
    },
    handleLayoutChange,
    handleInteractionStart,
    handleInteractionStop,
    handleAutoArrange,
    handleDeleteWidget,
    handleChangeWidgetView,
    removedTitle,
    undoRemoval,
    clearUndo,
  }
}
