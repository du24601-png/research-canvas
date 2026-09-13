import { useEffect, useState, type MouseEvent } from 'react'
import { GridRegular } from '@fluentui/react-icons'
import type { EventCallback } from 'react-grid-layout'
import ReactGridLayout, { useContainerWidth, verticalCompactor } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import './researchCanvas.css'
import ChromeToolButton from '../../desktop/ChromeToolButton'
import { DESKTOP_SIDEBAR_TOOL_ICON_PADDING } from '../../desktop/constants'
import ResearchCanvasWidget from './ResearchCanvasWidget'
import ResearchCanvasToast from './ResearchCanvasToast'
import { shouldClearSelectionOnCanvasClick } from './activeWidgetContext'
import { setActiveWidget } from './activeWidgetSelection'
import { findWidgetForProposal } from './focusCanvasWidget'
import { readPersistedCanvasState } from './layoutStorage'
import { asWidgetType } from './proposalFromToolStep'
import { subscribeResearchCanvasEvents } from './researchCanvasBus'
import { useResearchCanvas } from './useResearchCanvas'
import CanvasEmptyState from './CanvasEmptyState'
import { compactCanvasLayout } from './compactCanvasLayout'

export default function ResearchCanvas() {
  const { width, containerRef, mounted } = useContainerWidth()
  const {
    widgets,
    layout,
    getDataset,
    activeWidgetId,
    handleSelectWidget,
    handleLayoutChange,
    handleInteractionStart,
    handleInteractionStop,
    handleAutoArrange,
    handleDeleteWidget,
    handleChangeWidgetView,
    removedTitle,
    undoRemoval,
    clearUndo,
  } = useResearchCanvas()
  const [focusPulseId, setFocusPulseId] = useState<string | null>(null)
  const compact = width < 600
  const displayLayout = compact ? compactCanvasLayout(layout, widgets) : layout

  useEffect(() => subscribeResearchCanvasEvents((event) => {
    if (typeof event !== 'object' || event === null) return
    const record = event as Record<string, unknown>
    if (record.type !== 'focus_widget' || typeof record.proposal !== 'object' || !record.proposal) {
      return
    }
    const proposal = record.proposal as Record<string, unknown>
    const id = typeof proposal.id === 'string' ? proposal.id.trim() : ''
    const type = asWidgetType(proposal.type)
    const title = typeof proposal.title === 'string' ? proposal.title.trim() : ''
    const datasetId = typeof proposal.datasetId === 'string' ? proposal.datasetId.trim() : ''
    if (!id || !type || !title || !datasetId) return
    const target = findWidgetForProposal(readPersistedCanvasState().widgets, { id, type, title, datasetId })
    if (!target) return
    setActiveWidget({ id: target.id, title: target.title })
    setFocusPulseId(target.id)
    window.setTimeout(() => setFocusPulseId(null), 2400)
    window.requestAnimationFrame(() => {
      containerRef.current
        ?.querySelector(`[data-canvas-widget-id="${target.id}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }), [containerRef])

  const onDragStart: EventCallback = () => {
    const root = containerRef.current
    if (root) root.dataset.interacting = 'drag'
    handleInteractionStart()
  }

  const onResizeStart: EventCallback = () => {
    const root = containerRef.current
    if (root) root.dataset.interacting = 'resize'
    handleInteractionStart()
  }

  const onDragStop: EventCallback = (next) => {
    const root = containerRef.current
    if (root) delete root.dataset.interacting
    handleInteractionStop(next)
  }

  const onResizeStop: EventCallback = (next) => {
    const root = containerRef.current
    if (root) delete root.dataset.interacting
    handleInteractionStop(next)
  }

  const onCanvasClick = (event: MouseEvent<HTMLDivElement>) => {
    if (shouldClearSelectionOnCanvasClick(event.target)) setActiveWidget(null)
  }

  return (
    <div ref={containerRef} className="research-canvas-root" data-compact={compact || undefined} onClick={onCanvasClick}>
      <ResearchCanvasToast removedTitle={removedTitle} onUndo={undoRemoval} onDismiss={clearUndo} />
      {widgets.length > 0 && !compact ? (
        <div className="research-canvas-toolbar">
          <ChromeToolButton
            className="research-canvas-no-drag"
            label="整理布局"
            iconPadding={DESKTOP_SIDEBAR_TOOL_ICON_PADDING}
            onClick={handleAutoArrange}
          >
            <GridRegular fontSize={14} />
          </ChromeToolButton>
        </div>
      ) : null}
      {!widgets.length ? <CanvasEmptyState /> : null}
      {mounted && widgets.length > 0 ? (
        <ReactGridLayout
          width={width}
          layout={displayLayout}
          compactor={verticalCompactor}
          gridConfig={{
            cols: 12,
            rowHeight: 28,
            margin: [8, 8] as const,
            containerPadding: [8, 8] as const,
            maxRows: Infinity,
          }}
          dragConfig={{
            enabled: !compact,
            bounded: false,
            handle: '.research-canvas-drag-handle',
            cancel: '.research-canvas-no-drag',
            threshold: 3,
          }}
          resizeConfig={{
            enabled: !compact,
            handles: ['se'] as const,
          }}
          onLayoutChange={compact ? undefined : handleLayoutChange}
          onDragStart={onDragStart}
          onDragStop={onDragStop}
          onResizeStart={onResizeStart}
          onResizeStop={onResizeStop}
        >
          {widgets.map(widget => (
            <div key={widget.id} data-canvas-widget-id={widget.id}>
              <ResearchCanvasWidget
                widget={widget}
                dataset={getDataset(widget.datasetId)}
                selected={activeWidgetId === widget.id}
                focusPulse={focusPulseId === widget.id}
                onSelect={handleSelectWidget}
                onDelete={handleDeleteWidget}
                onChangeView={handleChangeWidgetView}
              />
            </div>
          ))}
        </ReactGridLayout>
      ) : null}
    </div>
  )
}
