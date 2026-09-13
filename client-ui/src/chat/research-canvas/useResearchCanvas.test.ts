import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useResearchCanvas } from './useResearchCanvas'
import { getActiveWidgetId, resetActiveWidgetForTests } from './activeWidgetSelection'
import { writePersistedCanvasState, readPersistedCanvasState } from './layoutStorage'
import { publishResearchCanvasEvent } from './researchCanvasBus'
import type { Dataset, PersistedCanvasState } from './types'

const DATASET_ID = 'research-ds-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function dataset(): Dataset {
  return {
    id: DATASET_ID,
    title: 'Operating margin',
    metric: 'gross_margin',
    unit: '%',
    entities: [{
      id: 'CN:SH.601058',
      name: '赛轮轮胎',
      ticker: '601058.SH',
      market: 'CN',
      type: 'equity',
    }],
    periods: ['2022', '2026'],
    data: [{ entityId: 'CN:SH.601058', period: '2022', value: 21 }],
    sources: [],
  }
}

function seededState(): PersistedCanvasState {
  return {
    version: 2,
    widgets: [
      { id: 'rc-a', type: 'line_chart', title: 'A', datasetId: DATASET_ID },
      { id: 'rc-b', type: 'bar_chart', title: 'B', datasetId: DATASET_ID },
    ],
    layout: [
      { i: 'rc-a', x: 0, y: 0, w: 8, h: 6, minW: 5, minH: 4 },
      { i: 'rc-b', x: 8, y: 0, w: 4, h: 6, minW: 3, minH: 4 },
    ],
    datasets: [dataset()],
  }
}

describe('useResearchCanvas active widget', () => {
  beforeEach(() => {
    window.localStorage.clear()
    resetActiveWidgetForTests()
    writePersistedCanvasState(seededState())
  })

  it('selects one widget at a time and clears after delete', () => {
    const { result } = renderHook(() => useResearchCanvas())
    act(() => {
      result.current.handleSelectWidget(result.current.widgets[0]!)
    })
    expect(result.current.activeWidgetId).toBe('rc-a')
    act(() => {
      result.current.handleSelectWidget(result.current.widgets[1]!)
    })
    expect(result.current.activeWidgetId).toBe('rc-b')
    act(() => {
      result.current.handleDeleteWidget('rc-b')
    })
    expect(result.current.activeWidgetId).toBeNull()
    expect(result.current.widgets.some(widget => widget.id === 'rc-b')).toBe(false)
  })

  it('keeps selection through auto arrange', () => {
    const { result } = renderHook(() => useResearchCanvas())
    act(() => {
      result.current.handleSelectWidget(result.current.widgets[0]!)
    })
    act(() => {
      result.current.handleAutoArrange()
    })
    expect(getActiveWidgetId()).toBe('rc-a')
    expect(result.current.activeWidgetId).toBe('rc-a')
  })

  it('undo restores the same widget, data reference, order and layout after compaction', () => {
    const { result } = renderHook(() => useResearchCanvas())
    const beforeWidgets = result.current.widgets
    const beforeLayout = result.current.layout
    const beforeData = readPersistedCanvasState().datasets
    act(() => result.current.handleDeleteWidget('rc-a'))
    act(() => result.current.handleLayoutChange(result.current.layout.map(item => ({ ...item, x: 0, y: 0 }))))
    expect(result.current.removedTitle).toBe('A')
    act(() => result.current.undoRemoval())
    expect(result.current.widgets).toEqual(beforeWidgets)
    expect(result.current.layout).toEqual(beforeLayout)
    expect(readPersistedCanvasState().datasets).toEqual(beforeData)
    expect(readPersistedCanvasState().widgets).toEqual(beforeWidgets)
    expect(result.current.activeWidgetId).toBe('rc-a')
    expect(result.current.removedTitle).toBeNull()
  })

  it('does not roll back newer canvas work with a stale undo', () => {
    const { result } = renderHook(() => useResearchCanvas())
    act(() => result.current.handleDeleteWidget('rc-a'))
    act(() => publishResearchCanvasEvent({ type: 'widget_created', widget: {
      id: 'rc-new', title: 'New research', type: 'line_chart', datasetId: DATASET_ID,
    } }))
    expect(result.current.removedTitle).toBeNull()
    act(() => result.current.undoRemoval())
    expect(result.current.widgets.map(widget => widget.id)).toEqual(['rc-b', 'rc-new'])
  })
})
