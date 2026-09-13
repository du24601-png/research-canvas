import { beforeEach, describe, expect, it } from 'vitest'
import {
  getActiveWidgetId,
  getActiveWidgetSelection,
  resetActiveWidgetForTests,
  setActiveWidget,
  subscribeActiveWidget,
} from './activeWidgetSelection'
import { applyResearchCanvasEvent } from './canvasController'
import { findAddedWidgetId } from './activeWidgetContext'
import {
  readPersistedCanvasState,
  RESEARCH_CANVAS_STORAGE_KEY,
  writePersistedCanvasState,
} from './layoutStorage'
import { WIDGET_SIZE_PRESETS } from './widgetSizePresets'
import type { Dataset, PersistedCanvasState } from './types'

const DATASET_ID = 'research-ds-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function researchDataset(): Dataset {
  return {
    id: DATASET_ID,
    title: 'Operating margin',
    metric: 'operating_margin',
    unit: '%',
    entities: [{
      id: 'US:MSFT',
      name: 'Microsoft',
      ticker: 'MSFT',
      market: 'CN',
      type: 'equity',
    }],
    periods: ['2022', '2026'],
    data: [{ entityId: 'US:MSFT', period: '2022', value: 40 }],
    sources: [{
      provider: 'tushare',
      entityId: 'US:MSFT',
      metric: 'operating_margin',
      fetchedAt: '2026-09-10T00:00:00.000Z',
    }],
  }
}

function emptyState(): PersistedCanvasState {
  return { version: 2, widgets: [], layout: [], datasets: [researchDataset()] }
}

describe('active widget selection', () => {
  beforeEach(() => {
    window.localStorage.clear()
    resetActiveWidgetForTests()
  })

  it('sets, replaces, and clears the active widget', () => {
    const seen: Array<string | null> = []
    const stop = subscribeActiveWidget(() => seen.push(getActiveWidgetId()))
    setActiveWidget({ id: 'a', title: 'A' })
    expect(getActiveWidgetId()).toBe('a')
    setActiveWidget({ id: 'b', title: 'B' })
    expect(getActiveWidgetId()).toBe('b')
    expect(getActiveWidgetSelection()?.title).toBe('B')
    setActiveWidget(null)
    expect(getActiveWidgetId()).toBeNull()
    stop()
    expect(seen).toEqual(['a', 'b', null])
  })

  it('does not persist selection', () => {
    setActiveWidget({ id: 'rc-line', title: '趋势' })
    writePersistedCanvasState({
      version: 2,
      widgets: [{ id: 'rc-line', type: 'line_chart', title: '趋势', datasetId: DATASET_ID }],
      layout: [{ i: 'rc-line', x: 0, y: 0, w: 8, h: 6 }],
      datasets: [researchDataset()],
    })
    const raw = window.localStorage.getItem(RESEARCH_CANVAS_STORAGE_KEY) ?? ''
    expect(raw).not.toContain('activeWidget')
    expect(JSON.parse(raw)).not.toHaveProperty('activeWidgetId')
    resetActiveWidgetForTests()
    const restored = readPersistedCanvasState()
    expect(restored.widgets).toHaveLength(1)
    expect(getActiveWidgetId()).toBeNull()
  })

  it('keeps selection across layout-only commits', () => {
    setActiveWidget({ id: 'rc-line', title: '趋势' })
    writePersistedCanvasState({
      version: 2,
      widgets: [{ id: 'rc-line', type: 'line_chart', title: '趋势', datasetId: DATASET_ID }],
      layout: [{ i: 'rc-line', x: 1, y: 2, w: 8, h: 6 }],
      datasets: [researchDataset()],
    })
    expect(getActiveWidgetId()).toBe('rc-line')
  })
})

describe('create widget proposal adopt', () => {
  beforeEach(() => {
    window.localStorage.clear()
    resetActiveWidgetForTests()
  })

  it('confirm places with first-fit preferred size and can select the new widget', () => {
    const before = emptyState()
    const proposed = applyResearchCanvasEvent(before, {
      type: 'widget_proposed',
      proposal: {
        id: 'call_compare_google',
        type: 'line_chart',
        title: 'Microsoft vs Google Operating Margin',
        datasetId: DATASET_ID,
      },
    })
    expect(proposed).toBeNull()
    expect(before.widgets).toHaveLength(0)

    const adopted = applyResearchCanvasEvent(before, {
      type: 'widget_adopted',
      proposal: {
        id: 'call_compare_google',
        type: 'line_chart',
        title: 'Microsoft vs Google Operating Margin',
        datasetId: DATASET_ID,
      },
    })
    expect(adopted).not.toBeNull()
    expect(adopted?.widgets).toHaveLength(1)
    expect(adopted?.layout[0]).toMatchObject({
      x: 0,
      y: 0,
      w: Math.max(WIDGET_SIZE_PRESETS.line_chart.preferredW, 8),
      h: Math.max(WIDGET_SIZE_PRESETS.line_chart.preferredH, 10),
    })
    const addedId = findAddedWidgetId(before.widgets, adopted?.widgets ?? [])
    expect(addedId).toBe(adopted?.widgets[0]?.id)
    setActiveWidget({
      id: addedId ?? '',
      title: adopted?.widgets[0]?.title ?? '',
    })
    expect(getActiveWidgetId()).toBe(addedId)

    writePersistedCanvasState(adopted!)
    resetActiveWidgetForTests()
    const restored = readPersistedCanvasState()
    expect(restored.widgets).toHaveLength(1)
    expect(restored.widgets[0]?.title).toBe('Microsoft vs Google Operating Margin')
    expect(getActiveWidgetId()).toBeNull()
  })

  it('cancel leaves canvas unchanged', () => {
    const before = emptyState()
    expect(applyResearchCanvasEvent(before, {
      type: 'widget_proposed',
      proposal: {
        id: 'call_cancel',
        type: 'line_chart',
        title: 'Microsoft vs Google Operating Margin',
        datasetId: DATASET_ID,
      },
    })).toBeNull()
    expect(before.widgets).toEqual([])
    expect(before.layout).toEqual([])
  })
})
