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
import ResearchCanvasToolbar from './ResearchCanvasToolbar'
import { shouldClearSelectionOnCanvasClick } from './activeWidgetContext'
import { setActiveWidget } from './activeWidgetSelection'
import { findWidgetForProposal } from './focusCanvasWidget'
import { readPersistedCanvasState } from './layoutStorage'
import { asWidgetType } from './proposalFromToolStep'
import { subscribeResearchCanvasEvents } from './researchCanvasBus'
import { useResearchCanvas, type UseResearchCanvasOptions } from './useResearchCanvas'
import CanvasEmptyState from './CanvasEmptyState'
import { compactCanvasLayout } from './compactCanvasLayout'
import { useWorkspaceUi } from '../workspace/WorkspaceUiContext'
import { DEFAULT_SESSION_DISPLAY_TITLE } from '../sessionSidebarPresentation'
import type { PersistedCanvasState } from './types'

export interface ResearchCanvasProps {
  sessionId?: string | null
  sessionTitle?: string
  readonly?: boolean
  frozenState?: PersistedCanvasState
}

export default function ResearchCanvas({
  sessionId = null,
  sessionTitle = DEFAULT_SESSION_DISPLAY_TITLE,
  readonly: readonlyProp = false,
  frozenState,
}: ResearchCanvasProps) {
  const ui = useWorkspaceUi()
  const presentMode = ui.presentMode
  const canvasOptions: UseResearchCanvasOptions = {
    readonly: readonlyProp,
    ...(frozenState ? { frozenState } : {}),
  }
  const { width, containerRef, mounted } = useContainerWidth()
  const {
    widgets,
    layout,
    datasets,
    getDataset,
    activeWidgetId,
    handleSelectWidget,
    handleLayoutChange,
    handleInteractionStart,
    handleInteractionStop,
    handleAutoArrange,
    handleDeleteWidget,
    handleChangeWidgetView,
    buildPublishPayload,
    removedTitle,
    undoRemoval,
    clearUndo,
  } = useResearchCanvas(sessionId, canvasOptions)
  const [focusPulseId, setFocusPulseId] = useState<string | null>(null)
  const [adoptEnterId, setAdoptEnterId] = useState<string | null>(null)
  const compact = width < 600
  const displayLayout = compact ? compactCanvasLayout(layout, widgets) : layout
  const readonly = readonlyProp
  const boardTitle = sessionTitle.trim() || DEFAULT_SESSION_DISPLAY_TITLE

  useEffect(() => {
    if (readonly) return
    return subscribeResearchCanvasEvents((event) => {
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
      const target = findWidgetForProposal(readPersistedCanvasState(sessionId).widgets, { id, type, title, datasetId })
      if (!target) return
      setActiveWidget({ id: target.id, title: target.title })
      setFocusPulseId(target.id)
      setAdoptEnterId(target.id)
      window.setTimeout(() => setAdoptEnterId(current => (current === target.id ? null : current)), 480)
      window.setTimeout(() => setFocusPulseId(null), 2400)
      window.requestAnimationFrame(() => {
        containerRef.current
          ?.querySelector(`[data-canvas-widget-id="${target.id}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    })
  }, [containerRef, readonly, sessionId])

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
    <div
      ref={containerRef}
      className="research-canvas-root"
      data-compact={compact || undefined}
      data-present={presentMode || undefined}
      data-readonly={readonly || undefined}
      onClick={onCanvasClick}
    >
      {!readonly ? (
        <ResearchCanvasToast removedTitle={removedTitle} onUndo={undoRemoval} onDismiss={clearUndo} />
      ) : null}
      <div className="research-canvas-board-header">
        <h2 className="research-canvas-board-title">{boardTitle}</h2>
        <div className="research-canvas-board-header__actions">
          {widgets.length > 0 && !compact && !readonly ? (
            <ChromeToolButton
              className="research-canvas-no-drag"
              label="整理布局"
              iconPadding={DESKTOP_SIDEBAR_TOOL_ICON_PADDING}
              onClick={handleAutoArrange}
            >
              <GridRegular fontSize={14} />
            </ChromeToolButton>
          ) : null}
          {widgets.length > 0 ? (
            <ResearchCanvasToolbar
              boardRoot={containerRef.current}
              boardTitle={boardTitle}
              sessionId={sessionId}
              datasets={datasets}
              presentMode={presentMode}
              readonly={readonly}
              onEnterPresent={ui.enterPresentMode}
              onExitPresent={ui.exitPresentMode}
              buildPublishPayload={buildPublishPayload}
            />
          ) : null}
        </div>
      </div>
      {!widgets.length ? <CanvasEmptyState muted={presentMode} /> : null}
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
            enabled: !compact && !readonly,
            bounded: false,
            handle: '.research-canvas-drag-handle',
            cancel: '.research-canvas-no-drag',
            threshold: 3,
          }}
          resizeConfig={{
            enabled: !compact && !readonly,
            handles: ['se'] as const,
          }}
          onLayoutChange={readonly || compact ? undefined : handleLayoutChange}
          onDragStart={readonly ? undefined : onDragStart}
          onDragStop={readonly ? undefined : onDragStop}
          onResizeStart={readonly ? undefined : onResizeStart}
          onResizeStop={readonly ? undefined : onResizeStop}
        >
          {widgets.map(widget => (
            <div key={widget.id} data-canvas-widget-id={widget.id}>
              <ResearchCanvasWidget
                widget={widget}
                dataset={getDataset(widget.datasetId)}
                selected={activeWidgetId === widget.id}
                focusPulse={focusPulseId === widget.id}
                adoptEnter={adoptEnterId === widget.id}
                readonly={readonly}
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
